from django.db import models


class Ticket(models.Model):
    class Status(models.TextChoices):
        OPEN = "open"
        IN_PROGRESS = "in_progress"
        ESCALATED = "escalated"
        RESOLVED = "resolved"
        CLOSED = "closed"

    class Priority(models.TextChoices):
        LOW = "low"
        NORMAL = "normal"
        HIGH = "high"
        URGENT = "urgent"

    customer = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="tickets")
    assigned_to = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tickets")
    order = models.ForeignKey("orders.Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    category = models.CharField(max_length=40, default="general")
    subject = models.CharField(max_length=200)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN, db_index=True)
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.NORMAL)
    resolution = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class TicketMessage(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="+")
    body = models.TextField()
    is_internal = models.BooleanField(default=False)  # staff-only notes
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
