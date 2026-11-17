# Brainy Dec — Launch Guide (step by step)

**Honest note first:** no website can be made "unhackable". This guide removes the common, avoidable holes and gives you a
process to stay safe. Do NOT take real customer money until you finish Phase 6 (sandbox testing) and Phase 8 (go-live checklist).

---
## Phase 1 — What you need to buy / create
1. **Domain name** (e.g. brainydec.com) from any registrar (Namecheap, Whogohost, Qservers…). Turn on registrar 2FA.
2. **A Linux VPS** (Ubuntu 24.04 LTS, minimum 2 vCPU / 4 GB RAM / 40 GB disk). Providers: Hetzner, DigitalOcean, Contabo, or a
   Nigerian host if you want local latency. Do not use cheap shared hosting — this stack needs Docker.
3. **Paystack and/or Flutterwave business accounts.** Live mode requires business verification; start now, it can take days.
4. **Email sender** (e.g. Zoho Mail SMTP, Brevo, Mailgun, Resend) for order/password-reset emails.
5. **Cloudinary account** (optional, for product images) and an **SMS provider** (e.g. Termii) if you want SMS.
6. **Error/uptime monitoring:** free Sentry + UptimeRobot.

## Phase 2 — Prepare the server (do these in order)
```bash
ssh root@YOUR_SERVER_IP
adduser deploy && usermod -aG sudo deploy
# On YOUR computer: ssh-keygen (if you have none) then:  ssh-copy-id deploy@YOUR_SERVER_IP
```
Then as `deploy` (`ssh deploy@YOUR_SERVER_IP`):
```bash
sudo nano /etc/ssh/sshd_config      # set:  PermitRootLogin no   and   PasswordAuthentication no
sudo systemctl restart ssh          # KEEP your current session open and test a 2nd login before closing
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw fail2ban unattended-upgrades
sudo ufw default deny incoming && sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades   # automatic security updates
# Docker
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker deploy && newgrp docker
```
Never expose PostgreSQL (5432) or Redis (6379) to the internet — the compose file keeps them internal. Keep it that way.

## Phase 3 — Point your domain
At your registrar/DNS add an **A record**: `shop` (or `@`) → your server IP. Wait until `ping shop.yourdomain.com` shows the IP.

## Phase 4 — Deploy the app
```bash
# from your computer
scp brainy-dec.zip deploy@YOUR_SERVER_IP:~
# on the server
sudo apt -y install unzip && unzip brainy-dec.zip && cd brainy-dec
cp .env.example .env && nano .env
```
Fill `.env` (every value matters):
| Key | Value |
|---|---|
| `DEBUG` | `False` (never True in production) |
| `SECRET_KEY` | run `python3 -c "import secrets;print(secrets.token_urlsafe(64))"` and paste |
| `DB_PASSWORD`, `REDIS_PASSWORD` | long random strings (use the same command) |
| `DOMAIN` | `shop.yourdomain.com` |
| `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL` | your domain; origins/URL start with `https://` |
| `NUM_PROXIES` | `2` (Caddy + nginx; makes rate-limiting use real client IPs) |
| `PAYSTACK_*`, `FLUTTERWAVE_*` | **test** keys for now |
| `EMAIL_BACKEND` + SMTP vars | your email provider (the console backend sends nothing) |

```bash
chmod 600 .env
docker compose up -d --build
docker compose logs -f backend          # wait until migrations finish, Ctrl+C
docker compose exec backend python manage.py create_initial_admin --email you@yourdomain.com --password 'A-very-long-unique-passphrase'
docker compose exec backend python manage.py seed_demo   # optional: creates the 14 categories (+ demo products; delete those later)
```
Caddy obtains the HTTPS certificate automatically. Open `https://shop.yourdomain.com`. Use a password manager; the super-admin
password must be long and unique.

## Phase 5 — Configure the store
1. Log in → **Admin → Settings**: set bank-transfer details, COD rules.
2. **Admin → Staff**: create store admins / delivery agents / support agents (each with their own email — never share accounts).
3. Add delivery zones (state + fee) via `/api/delivery-zones/` (Swagger UI at `/api/docs/` is available while testing; see Phase 7 to lock it).
4. Add real products, upload images, set stock. Delete demo products.

## Phase 6 — Sandbox payment testing (mandatory)
1. In Paystack dashboard (test mode) set the webhook URL to `https://shop.yourdomain.com/api/payments/webhook/paystack/`.
   In Flutterwave set `https://shop.yourdomain.com/api/payments/webhook/flutterwave/` and the **secret hash** = `FLUTTERWAVE_SECRET_HASH` in `.env`.
2. `docker compose up -d` after editing `.env`. Place a test order with a test card; confirm the order becomes *Confirmed*.
3. Re-deliver the same webhook from the dashboard — the order and wallet must NOT change twice.
4. Test: failed card, wallet funding, bank-transfer approval, COD + delivery agent flow, cancellation/refund, low stock.
5. Test from a real phone on mobile data.
6. Only then swap in **live** keys and webhook URLs, and run one small real purchase yourself, then refund it.

## Phase 7 — Lock down (security hardening checklist)
Already done in the code/config (verified by 48 automated tests where applicable):
- Public sign-up can only create customers; roles can't be self-assigned; every API endpoint checks the role on the server.
- Payment success is never trusted from the browser; webhooks are signature-checked, re-verified with the provider, idempotent; amount mismatches are never fulfilled.
- Wallet/stock changes use database locks; no negative stock/balance; staff can't manually set money states (paid/refunded).
- Refresh tokens are revoked on logout; login/registration/password-reset are rate limited; reset doesn't reveal which emails exist.
- Bank-transfer proofs are private (staff-only download; web server blocks the folder). Upload type/size/content checks.
- HTTPS-only, HSTS, secure cookies, CSP/anti-clickjacking headers, hidden server version, DB/Redis not exposed, Redis password.

You must still do:
1. **Restrict `/django-admin/`:** edit `frontend/docker/nginx.conf`, uncomment `allow YOUR_IP; deny all;` (or remove the block), then `docker compose up -d --build frontend`.
2. **Close the API docs in production:** in `config/urls.py` remove the `api/schema/` and `api/docs/` routes (or wrap them in `if settings.DEBUG`).
3. **Never** commit or email `.env`. Rotate any secret that was ever shared (SECRET_KEY, payment keys, DB password).
4. Turn on **2FA** on: your domain registrar, VPS provider, Paystack/Flutterwave, email, GitHub.
5. **Backups** (cron, daily) — and test a restore:
   ```bash
   crontab -e
   0 2 * * * cd ~/brainy-dec && docker compose exec -T db pg_dump -U brainydec brainydec | gzip > ~/backups/db-$(date +\%F).sql.gz && find ~/backups -mtime +14 -delete
   ```
   Copy backups off the server (another provider/bucket). Also back up the `media` volume.
6. **Updates:** monthly `sudo apt upgrade`; update dependencies (`pip list --outdated`, `npm audit`) and redeploy.
7. **Monitoring:** add Sentry DSN, UptimeRobot on the homepage and `/api/products/`; watch `docker compose logs`.
8. Staff hygiene: unique strong passwords, disable accounts the moment someone leaves (Admin → Staff), review **Audit logs** weekly.

Known remaining risks (be aware, plan to fix):
- Login tokens are kept in the browser's localStorage. A successful XSS bug would expose them. The strict CSP reduces this; moving
  tokens to httpOnly cookies is the stronger fix.
- No two-factor login for staff accounts and no automatic lockout after repeated failures (only IP rate limiting). Consider `django-axes` + TOTP for admins.
- Not yet tested on PostgreSQL under real parallel load, and not penetration-tested. Before significant volume, pay a professional to pen-test, or at least run OWASP ZAP against a staging copy.
- Cloudinary/local media: images are public by design; keep sensitive files out of `media/`.

## Phase 8 — Go-live checklist
- [ ] HTTPS padlock works on `https://shop.yourdomain.com`; `http://` redirects to https
- [ ] `DEBUG=False`, strong `SECRET_KEY`, live payment keys, live webhooks verified with a small real payment
- [ ] Real SMTP email works (register, reset password, order confirmation)
- [ ] Admin panel restricted, API docs closed, demo data removed
- [ ] Backups run AND a restore was tested
- [ ] Privacy policy, terms, delivery & refund policy pages published (Nigeria's data-protection law (NDPA) applies to customer data — get proper legal advice)
- [ ] Business/Paystack verification complete; bank account for settlements set
- [ ] You have tested the full order → delivery → refund flow on a phone

## Phase 9 — Operating it
- Updating: upload new code, `docker compose up -d --build`, migrations run automatically on backend start.
- Restart: `docker compose restart`. Logs: `docker compose logs -f backend`.
- If you suspect a breach: take the site offline (`docker compose stop caddy`), rotate ALL secrets, check Audit logs and `docker compose logs`, restore from a clean backup, then bring it back.

## Costs to expect (check current pricing yourself)
Domain (yearly), VPS (monthly), payment-gateway fees per transaction, SMS per message, optional Cloudinary/Sentry paid tiers.
