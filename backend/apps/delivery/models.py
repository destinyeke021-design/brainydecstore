from django.db import models


class DeliveryZone(models.Model):
    state = models.CharField(max_length=100, unique=True)
    country = models.CharField(max_length=2, default="NG")
    fee = models.BigIntegerField()
    is_active = models.BooleanField(default=True)


class DeliveryProvider(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=80)
    is_active = models.BooleanField(default=False)  # activated only after credentials are configured


class DeliveryAgentProfile(models.Model):
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="agent_profile")
    vehicle = models.CharField(max_length=60, blank=True)
    is_suspended = models.BooleanField(default=False)


class Delivery(models.Model):
    class Status(models.TextChoices):
        UNASSIGNED = "unassigned"
        ASSIGNED = "assigned"
        PICKED_UP = "picked_up"
        OUT_FOR_DELIVERY = "out_for_delivery"
        DELIVERED = "delivered"
        FAILED = "failed"

    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="delivery")
    agent = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="deliveries")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNASSIGNED, db_index=True)
    provider = models.CharField(max_length=30, default="manual")
    tracking_number = models.CharField(max_length=60, blank=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    evidence = models.ImageField(upload_to="delivery_evidence/", blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    assigned_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
