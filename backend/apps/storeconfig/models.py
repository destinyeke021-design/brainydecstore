from django.db import models


class StoreSettings(models.Model):
    """Singleton (pk=1)."""
    store_name = models.CharField(max_length=100, default="Brainy Dec")
    currency = models.CharField(max_length=3, default="NGN")
    enabled_countries = models.JSONField(default=list)  # ["NG"]
    enabled_payment_methods = models.JSONField(default=list)
    cod_enabled = models.BooleanField(default=True)
    cod_max_amount = models.BigIntegerField(default=20_000_000)  # 200,000 NGN in kobo
    cod_allowed_states = models.JSONField(default=list, blank=True)  # empty = all enabled states
    default_shipping_fee = models.BigIntegerField(default=150_000)
    free_shipping_threshold = models.BigIntegerField(null=True, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=20, blank=True)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults=dict(
            enabled_countries=["NG"],
            enabled_payment_methods=["paystack", "flutterwave", "bank_transfer", "cod", "wallet"]))
        return obj


class Currency(models.Model):
    code = models.CharField(max_length=3, primary_key=True)
    name = models.CharField(max_length=50)
    symbol = models.CharField(max_length=5)
    minor_units = models.PositiveSmallIntegerField(default=2)
    is_enabled = models.BooleanField(default=False)


class ExchangeRate(models.Model):
    """Configurable, auditable rates. base->quote; source documents provenance."""
    base = models.CharField(max_length=3)
    quote = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=18, decimal_places=8)
    source = models.CharField(max_length=100)
    fetched_at = models.DateTimeField()

    class Meta:
        ordering = ["-fetched_at"]


class Country(models.Model):
    code = models.CharField(max_length=2, primary_key=True)
    name = models.CharField(max_length=80)
    phone_prefix = models.CharField(max_length=6)
    is_shipping_enabled = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "countries"


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
