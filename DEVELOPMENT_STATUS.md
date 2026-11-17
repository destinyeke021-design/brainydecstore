# Brainy Dec — Development Status

## Verified (actually executed)
- Backend: `python manage.py test tests` -> 41 tests passed (SQLite). Covers auth/role escalation, RBAC, catalog CRUD/search/import-export,
  cart & guest merge, checkout (wallet/COD), stock reservation/no-oversell, idempotent checkout, coupons, flash-sale quota,
  cancel/refund flows, wallet idempotency/overdraft, Paystack/Flutterwave init+verify+webhook (MOCKED provider HTTP), duplicate webhooks,
  amount-mismatch protection, bank-transfer approval, COD collection, delivery flow, agent isolation, support visibility, dashboard, invoice PDF.
- Frontend: `npm run build` (tsc + vite) succeeds; `npm test` -> 6 tests pass.

## NOT verified / not done
- Not run against PostgreSQL, Redis or Docker (not available in the build sandbox). Config is provided but untested.
- No live Paystack/Flutterwave calls (no credentials). Only mocked-HTTP tests. You must test in sandbox with your own test keys.
- Real concurrency (parallel threads) not tested; code uses select_for_update which SQLite ignores. Test on PostgreSQL.
- No end-to-end browser test (Playwright/Cypress), no component tests for cart/checkout/dashboards.
- SMS is console-only; no real SMS provider adapter. Third-party logistics: interface + manual provider only.
- Cloudinary configured by env only; images use local storage unless you wire django-cloudinary-storage.
- Not implemented / partial: product variant & bundle admin UI, review moderation UI, recently-viewed, "frequently bought together",
  multi-currency conversion logic (models Currency/ExchangeRate/Country exist, no conversion service), CustomerProfile/AdminProfile
  separate models (role on User instead), Celery tasks (Celery configured, notifications run synchronously), rate limiting is DRF throttling only,
  refresh-token blacklist, product search is DB icontains (no full-text/suggestions), review image upload UI.
- Admin Reviews tab is a placeholder; delivery assign uses a prompt for agent id.

## Next steps
1. Run `docker compose up --build` and fix anything that surfaces on PostgreSQL.
2. Add Paystack/Flutterwave test keys; run an end-to-end sandbox payment.
3. Build the missing UIs above; add Playwright E2E for the 16-step customer journey.

## Security hardening pass (latest)
- 48 backend tests pass (7 new hardening tests). Fixed: refresh-token revocation, 500 on weak reset password, review product re-assignment & duplicates,
  customer ticket PATCH, delivery 500 on foreign id, staff manual money-state changes, staff-cancel of paid orders (now refunds), webhook bad-JSON,
  private bank-transfer proofs, proxy-aware throttling, upload limits, prod SECRET_KEY enforcement, ALLOWED_HOSTS default.
- Infra: Caddy auto-HTTPS, nginx security headers + CSP, Redis password, private media paths.
- Still open: JWT in localStorage, no staff 2FA/lockout, no PostgreSQL/Docker run, no pen test. See docs/LAUNCH_GUIDE.md.
