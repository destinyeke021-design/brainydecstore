from django.db import models


class Wallet(models.Model):
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="wallet")
    balance = models.BigIntegerField(default=0)  # minor units
    currency = models.CharField(max_length=3, default="NGN")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.CheckConstraint(check=models.Q(balance__gte=0), name="wallet_balance_nonneg")]


class WalletTransaction(models.Model):
    class Kind(models.TextChoices):
        CREDIT = "credit"
        DEBIT = "debit"

    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="transactions")
    kind = models.CharField(max_length=6, choices=Kind.choices)
    amount = models.BigIntegerField()
    balance_after = models.BigIntegerField()
    reference = models.CharField(max_length=80, unique=True)  # uniqueness == idempotency (no duplicate credits)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [models.CheckConstraint(check=models.Q(amount__gt=0), name="wtx_amount_pos")]


class Payment(models.Model):
    class Provider(models.TextChoices):
        PAYSTACK = "paystack"
        FLUTTERWAVE = "flutterwave"
        BANK_TRANSFER = "bank_transfer"
        COD = "cod"
        WALLET = "wallet"

    class Status(models.TextChoices):
        PENDING = "pending"
        AWAITING_VERIFICATION = "awaiting_verification"
        SUCCESS = "success"
        FAILED = "failed"
        MISMATCH = "mismatch"  # provider amount/currency differs: needs manual review, never auto-fulfilled

    class Purpose(models.TextChoices):
        ORDER = "order"
        WALLET_FUNDING = "wallet_funding"

    user = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="payments")
    order = models.ForeignKey("orders.Order", null=True, blank=True, on_delete=models.PROTECT, related_name="payments")
    purpose = models.CharField(max_length=15, choices=Purpose.choices, default=Purpose.ORDER)
    provider = models.CharField(max_length=15, choices=Provider.choices)
    reference = models.CharField(max_length=80, unique=True)
    amount = models.BigIntegerField()
    currency = models.CharField(max_length=3, default="NGN")
    status = models.CharField(max_length=22, choices=Status.choices, default=Status.PENDING, db_index=True)
    customer_reference = models.CharField(max_length=120, blank=True)  # bank transfer ref supplied by customer
    proof = models.FileField(upload_to="proofs/%Y/%m/", blank=True)
    raw = models.JSONField(default=dict, blank=True)
    reconciled = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class PaymentWebhookEvent(models.Model):
    provider = models.CharField(max_length=15)
    event_id = models.CharField(max_length=100)
    event_type = models.CharField(max_length=60, blank=True)
    payload = models.JSONField(default=dict)
    processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["provider", "event_id"], name="uniq_webhook_event")]


class Refund(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested"
        PROCESSED = "processed"
        REJECTED = "rejected"

    order = models.ForeignKey("orders.Order", on_delete=models.PROTECT, related_name="refunds")
    requested_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    amount = models.BigIntegerField()
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.REQUESTED)
    previous_order_status = models.CharField(max_length=24, blank=True)
    destination = models.CharField(max_length=10, default="wallet")
    processed_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
