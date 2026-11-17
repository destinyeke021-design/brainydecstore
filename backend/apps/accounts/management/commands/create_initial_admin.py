import os
from django.core.management.base import BaseCommand
from apps.accounts.models import Role, User
from apps.storeconfig.models import StoreSettings


class Command(BaseCommand):
    help = "Create the first super administrator: --email X --password Y (or ADMIN_EMAIL / ADMIN_PASSWORD env vars)."

    def add_arguments(self, p):
        p.add_argument("--email", default=os.environ.get("ADMIN_EMAIL"))
        p.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD"))

    def handle(self, *a, email=None, password=None, **kw):
        if not email or not password:
            self.stderr.write("Provide --email and --password"); return
        u, made = User.objects.get_or_create(email=email.lower(), defaults=dict(role=Role.SUPER_ADMIN, is_staff=True, is_superuser=True))
        u.set_password(password); u.role = Role.SUPER_ADMIN; u.is_staff = u.is_superuser = True; u.save()
        StoreSettings.load()
        self.stdout.write(self.style.SUCCESS(f"Super administrator {'created' if made else 'updated'}: {u.email}"))
