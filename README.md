# Brainy Dec — single-vendor e-commerce (Django + React)

See DEVELOPMENT_STATUS.md for exactly what is verified and what remains.

## Local (Windows PowerShell)
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DEBUG="True"            # uses SQLite unless DATABASE_URL is set
python manage.py migrate
python manage.py create_initial_admin --email you@example.com --password "Str0ng!Pass#1"
python manage.py seed_demo   # optional: 14 categories + sample products
python manage.py runserver   # http://localhost:8000  (API docs: /api/docs/)

cd ..\frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api to :8000)
```
PostgreSQL: set `DATABASE_URL=postgres://user:pass@localhost:5432/brainydec`.

## Docker
`copy .env.example .env`, edit it, then `docker compose up --build`.
Then: `docker compose exec backend python manage.py create_initial_admin --email ... --password ...`

## Tests
`cd backend; $env:DEBUG="True"; python manage.py test tests` · `cd frontend; npm test`

## Payments
Set `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH` (test keys first). Webhook URLs:
`/api/payments/webhook/paystack/` and `/api/payments/webhook/flutterwave/`. Without keys, init returns HTTP 503.
Amounts are integer minor units (kobo) everywhere.

## Roles & creating staff
Super admin creates store admins / delivery agents / support agents in Admin > Staff. Public registration only creates customers.

## Production
Linux + Gunicorn + Nginx + HTTPS (e.g. certbot), PostgreSQL, Redis, `DEBUG=False`, strong `SECRET_KEY`, `SECURE_SSL_REDIRECT=True`,
`python manage.py collectstatic`, run Celery worker, schedule `pg_dump` backups, serve /media or switch to Cloudinary.
API docs: `/api/docs/`.
