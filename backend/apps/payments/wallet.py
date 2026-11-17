from django.db import IntegrityError, transaction
from .models import Wallet, WalletTransaction


class InsufficientFunds(Exception):
    pass


def get_wallet(user):
    w, _ = Wallet.objects.get_or_create(user=user)
    return w


def credit(user, amount, reference, description=""):
    """Idempotent on `reference`: a repeated call returns the original transaction and does NOT credit twice."""
    if amount <= 0:
        raise ValueError("Amount must be positive")
    get_wallet(user)
    with transaction.atomic():
        existing = WalletTransaction.objects.filter(reference=reference).first()
        if existing:
            return existing
        w = Wallet.objects.select_for_update().get(user=user)
        w.balance += amount
        w.save(update_fields=["balance", "updated_at"])
        try:
            with transaction.atomic():
                return WalletTransaction.objects.create(wallet=w, kind="credit", amount=amount, balance_after=w.balance,
                                                        reference=reference, description=description)
        except IntegrityError:  # lost a race with another identical credit; roll back this balance change
            raise


def debit(user, amount, reference, description=""):
    if amount <= 0:
        raise ValueError("Amount must be positive")
    get_wallet(user)
    with transaction.atomic():
        existing = WalletTransaction.objects.filter(reference=reference).first()
        if existing:
            return existing
        w = Wallet.objects.select_for_update().get(user=user)
        if w.balance < amount:
            raise InsufficientFunds("Insufficient wallet balance.")
        w.balance -= amount
        w.save(update_fields=["balance", "updated_at"])
        return WalletTransaction.objects.create(wallet=w, kind="debit", amount=amount, balance_after=w.balance,
                                                reference=reference, description=description)
