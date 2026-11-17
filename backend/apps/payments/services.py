from django.db import transaction
from django.utils import timezone

from . import wallet as wallet_svc
from .models import Payment, Refund


def settle_payment(payment_id, paid_amount, paid_currency):
    """Idempotent. Marks payment successful and fulfils (order confirm / wallet credit) exactly once.
    A mismatching amount/currency is NEVER fulfilled; it is flagged for manual review."""
    from apps.orders.services import transition
    with transaction.atomic():
        p = Payment.objects.select_for_update().get(pk=payment_id)
        if p.status == Payment.Status.SUCCESS:
            return p
        if paid_amount != p.amount or paid_currency != p.currency:
            p.status = Payment.Status.MISMATCH
            p.save(update_fields=["status"])
            return p
        p.status = Payment.Status.SUCCESS
        p.verified_at = timezone.now()
        p.save(update_fields=["status", "verified_at"])
        if p.purpose == Payment.Purpose.WALLET_FUNDING:
            wallet_svc.credit(p.user, p.amount, f"fund-{p.reference}", f"Wallet funding via {p.provider}")
        elif p.order_id:
            from apps.orders.models import Order, OrderStatus
            o = Order.objects.select_for_update().get(pk=p.order_id)
            o.is_paid, o.paid_at = True, timezone.now()
            o.save(update_fields=["is_paid", "paid_at"])
            if o.status in (OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_VERIFICATION):
                transition(o, OrderStatus.CONFIRMED, None, f"Payment {p.reference} confirmed")
        return p


def fail_payment(payment_id, note=""):
    from apps.orders.services import transition
    from apps.orders.models import Order, OrderStatus
    with transaction.atomic():
        p = Payment.objects.select_for_update().get(pk=payment_id)
        if p.status == Payment.Status.SUCCESS:
            return p
        p.status = Payment.Status.FAILED
        p.save(update_fields=["status"])
        # Order stays open (customer may retry another method); transfer rejection moves it back to pending.
        if p.order_id and p.provider == Payment.Provider.BANK_TRANSFER:
            o = Order.objects.select_for_update().get(pk=p.order_id)
            if o.status == OrderStatus.PAYMENT_VERIFICATION:
                transition(o, OrderStatus.PENDING_PAYMENT, None, note or "Bank transfer rejected")
        return p


def refund_to_wallet(order, amount, requested_by, reason="", processed_by=None):
    """Creates a processed refund and credits the customer's wallet (idempotent per refund)."""
    with transaction.atomic():
        r = Refund.objects.create(order=order, requested_by=requested_by, amount=amount, reason=reason,
                                  status=Refund.Status.PROCESSED, processed_by=processed_by, processed_at=timezone.now())
        wallet_svc.credit(order.user, amount, f"refund-{r.pk}", f"Refund for order {order.number}")
        return r
