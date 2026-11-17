from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "super_admin", "Super administrator"
    STORE_ADMIN = "store_admin", "Store administrator"
    CUSTOMER = "customer", "Customer"
    DELIVERY_AGENT = "delivery_agent", "Delivery agent"
    SUPPORT_AGENT = "support_agent", "Customer support agent"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", Role.CUSTOMER)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=Role.SUPER_ADMIN, is_staff=True, is_superuser=True)
        return self._create(email, password, **extra)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER, db_index=True)
    country = models.CharField(max_length=2, default="NG")
    timezone = models.CharField(max_length=40, default="Africa/Lagos")
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    @property
    def is_store_staff(self):
        return self.role in (Role.SUPER_ADMIN, Role.STORE_ADMIN)

    def __str__(self):
        return self.email


class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=2, default="NG")
    postal_code = models.CharField(max_length=20, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "addresses"


class AuditLog(models.Model):
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="+")
    action = models.CharField(max_length=100, db_index=True)
    target_type = models.CharField(max_length=100, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    detail = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


def audit(request_or_user, action, target=None, **detail):
    user = getattr(request_or_user, "user", request_or_user)
    ip = None
    meta = getattr(request_or_user, "META", None)
    if meta:
        ip = (meta.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or meta.get("REMOTE_ADDR")) or None
    AuditLog.objects.create(
        actor=user if getattr(user, "pk", None) else None, action=action,
        target_type=target.__class__.__name__ if target is not None else "",
        target_id=str(getattr(target, "pk", "")) if target is not None else "", detail=detail, ip_address=ip)
