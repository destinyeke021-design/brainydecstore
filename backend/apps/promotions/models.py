from django.db import models
from django.utils import timezone


class Coupon(models.Model):
    class Kind(models.TextChoices):
        PERCENT = "percent", "Percentage"
        FIXED = "fixed", "Fixed amount"

    code = models.CharField(max_length=40, unique=True)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    value = models.BigIntegerField(help_text="Percent (1-100) or minor units")
    min_purchase = models.BigIntegerField(default=0)
    max_discount = models.BigIntegerField(null=True, blank=True)
    free_delivery = models.BooleanField(default=False)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    per_user_limit = models.PositiveIntegerField(default=1)
    used_count = models.PositiveIntegerField(default=0)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def save(self, *a, **kw):
        self.code = self.code.upper().strip()
        super().save(*a, **kw)

    def evaluate(self, subtotal, user, now=None):
        """Returns (discount_minor, free_delivery). Raises ValueError with a customer-safe message."""
        now = now or timezone.now()
        if not self.is_active or self.starts_at > now or (self.ends_at and self.ends_at <= now):
            raise ValueError("This coupon is not currently valid.")
        if self.max_uses is not None and self.used_count >= self.max_uses:
            raise ValueError("This coupon has reached its usage limit.")
        if subtotal < self.min_purchase:
            raise ValueError(f"Minimum purchase not met.")
        if user and user.is_authenticated and self.redemptions.filter(user=user).count() >= self.per_user_limit:
            raise ValueError("You have already used this coupon.")
        d = subtotal * self.value // 100 if self.kind == self.Kind.PERCENT else self.value
        if self.max_discount is not None:
            d = min(d, self.max_discount)
        return min(d, subtotal), self.free_delivery


class CouponRedemption(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="redemptions")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="+")
    order = models.ForeignKey("orders.Order", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)


class FlashSale(models.Model):
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="flash_sales")
    title = models.CharField(max_length=120, blank=True)
    sale_price = models.BigIntegerField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    quota = models.PositiveIntegerField(null=True, blank=True, help_text="Real max units at sale price; blank = unlimited")
    sold = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.CheckConstraint(check=models.Q(ends_at__gt=models.F("starts_at")), name="flash_end_after_start")]


class Banner(models.Model):
    title = models.CharField(max_length=150)
    subtitle = models.CharField(max_length=250, blank=True)
    image = models.ImageField(upload_to="banners/", blank=True)
    link = models.CharField(max_length=250, blank=True)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position"]


class Bundle(models.Model):
    name = models.CharField(max_length=150)
    products = models.ManyToManyField("catalog.Product", related_name="bundles")
    bundle_price = models.BigIntegerField()
    is_active = models.BooleanField(default=True)
