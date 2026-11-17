from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        ORDER = "order"
        PROMO = "promo"
        WALLET = "wallet"
        SUPPORT = "support"
        ACCOUNT = "account"

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.ORDER)
    title = models.CharField(max_length=150)
    body = models.TextField(blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
