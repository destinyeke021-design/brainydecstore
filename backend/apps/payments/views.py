import json
import secrets
from django.conf import settings
from django.db import transaction
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView

from apps.accounts.models import audit
from apps.accounts.permissions import IsCustomer, IsStoreStaff
from apps.orders.models import Order, OrderStatus
from apps.orders.services import transition
from apps.storeconfig.models import StoreSettings
from . import wallet as wallet_svc
from .models import Payment, PaymentWebhookEvent
from .providers import ProviderError, ProviderNotConfigured, get_gateway
from .services import fail_payment, settle_payment


def _ref(prefix):
    return f"{prefix}-{secrets.token_hex(8).upper()}"


def _initialize(user, provider, amount, purpose, order=None):
    s = StoreSettings.load()
    if provider not in s.enabled_payment_methods:
        return Response({"detail": "Payment method not available."}, status=400)
    try:
        gw = get_gateway(provider)
        gw.key  # raises if not configured
    except ProviderNotConfigured as e:
        return Response({"detail": str(e), "code": "provider_not_configured"}, status=503)
    p = Payment.objects.create(user=user, order=order, purpose=purpose, provider=provider,
                               reference=_ref("BDP"), amount=amount, currency=s.currency)
    try:
        out = gw.initialize(user.email, amount, p.reference, s.currency, f"{settings.FRONTEND_URL}/payment/callback?provider={provider}")
    except ProviderError as e:
        p.status = Payment.Status.FAILED
        p.save(update_fields=["status"])
        return Response({"detail": str(e)}, status=502)
    except Exception:
        p.status = Payment.Status.FAILED
        p.save(update_fields=["status"])
        return Response({"detail": "Could not reach the payment provider."}, status=502)
    return Response({"reference": p.reference, **out}, status=201)


class InitializeOrderPayment(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        try:
            order = Order.objects.get(number=request.data.get("order"), user=request.user)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=404)
        if order.status != OrderStatus.PENDING_PAYMENT or order.is_paid:
            return Response({"detail": "Order is not awaiting payment."}, status=400)
        provider = request.data.get("provider")
        if provider not in ("paystack", "flutterwave"):
            return Response({"detail": "Unsupported gateway."}, status=400)
        return _initialize(request.user, provider, order.total, Payment.Purpose.ORDER, order)


class VerifyPayment(APIView):
    """Server-side verification against the provider API. The frontend's 'success' redirect is never trusted."""
    def get(self, request):
        p = Payment.objects.filter(reference=request.query_params.get("reference"), user=request.user).first()
        if not p or p.provider not in ("paystack", "flutterwave"):
            return Response({"detail": "Payment not found."}, status=404)
        return _verify_and_settle(p)


def _verify_and_settle(p):
    if p.status == Payment.Status.SUCCESS:
        return Response({"status": p.status})
    try:
        v = get_gateway(p.provider).verify(p.reference)
    except ProviderNotConfigured as e:
        return Response({"detail": str(e)}, status=503)
    except Exception:
        return Response({"detail": "Verification failed; try again shortly."}, status=502)
    if v["success"]:
        p = settle_payment(p.pk, v["amount"], v["currency"])
    else:
        p.raw = v["raw"]
        p.save(update_fields=["raw"])
        p = fail_payment(p.pk) if v["raw"].get("status") in ("failed", "abandoned", "reversed") else p
    return Response({"status": p.status})


class WebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    provider = None

    def post(self, request):
        gw = get_gateway(self.provider)
        body = request.body
        sig = request.headers.get("x-paystack-signature" if self.provider == "paystack" else "verif-hash", "")
        try:
            ok = gw.valid_signature(body, sig)
        except ProviderNotConfigured:
            return Response(status=503)
        if not ok:
            return Response(status=401)
        try:
            payload = json.loads(body or b"{}")
        except ValueError:
            return Response(status=400)
        data = payload.get("data", {})
        event_id = str(data.get("id") or data.get("reference") or data.get("tx_ref") or "")
        etype = payload.get("event", "")
        if not event_id:
            return Response(status=200)
        ev, created = PaymentWebhookEvent.objects.get_or_create(provider=self.provider, event_id=f"{etype}:{event_id}",
                                                                defaults={"payload": payload, "event_type": etype})
        if not created and ev.processed:
            return Response({"detail": "duplicate"}, status=200)  # idempotent
        ref = data.get("reference") or data.get("tx_ref")
        p = Payment.objects.filter(reference=ref).first()
        if p and etype in ("charge.success", "charge.completed"):
            # Re-verify with the provider rather than trusting webhook body amounts.
            try:
                v = gw.verify(p.reference)
                if v["success"]:
                    settle_payment(p.pk, v["amount"], v["currency"])
            except Exception:
                return Response(status=500)  # let provider retry
        ev.processed = True
        ev.save(update_fields=["processed"])
        return Response(status=200)


class PaystackWebhook(WebhookView):
    provider = "paystack"


class FlutterwaveWebhook(WebhookView):
    provider = "flutterwave"


class BankTransferSubmit(APIView):
    permission_classes = [IsCustomer]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().get(number=request.data.get("order"), user=request.user)
            except Order.DoesNotExist:
                return Response({"detail": "Order not found."}, status=404)
            if order.payment_method != "bank_transfer" or order.status != OrderStatus.PENDING_PAYMENT:
                return Response({"detail": "Order is not awaiting a bank transfer."}, status=400)
            ref = str(request.data.get("reference", "")).strip()
            proof = request.FILES.get("proof")
            if not ref and not proof:
                return Response({"detail": "Provide a transfer reference or proof of payment."}, status=400)
            if proof and (proof.size > 5_000_000 or proof.content_type not in ("image/jpeg", "image/png", "application/pdf")):
                return Response({"detail": "Proof must be JPEG, PNG or PDF under 5MB."}, status=400)
            p = Payment.objects.create(user=request.user, order=order, provider="bank_transfer", reference=_ref("BT"),
                                       amount=order.total, currency=order.currency, status=Payment.Status.AWAITING_VERIFICATION,
                                       customer_reference=ref, proof=proof or "")
            transition(order, OrderStatus.PAYMENT_VERIFICATION, request.user, "Transfer submitted for verification")
        return Response({"reference": p.reference, "status": p.status}, status=201)


class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.number", default=None, read_only=True)
    customer_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Payment
        exclude = ["raw"]


class PaymentList(APIView):
    permission_classes = [IsStoreStaff]

    def get(self, request):
        qs = Payment.objects.select_related("order", "user")
        if st := request.query_params.get("status"):
            qs = qs.filter(status=st)
        if pv := request.query_params.get("provider"):
            qs = qs.filter(provider=pv)
        return Response(PaymentSerializer(qs[:200], many=True).data)


class ProofDownload(APIView):
    """Bank-transfer proofs are private: only store staff can fetch them (media path is blocked at the web server)."""
    permission_classes = [IsStoreStaff]

    def get(self, request, pk):
        from django.http import FileResponse, Http404
        p = Payment.objects.filter(pk=pk).exclude(proof="").first()
        if not p:
            raise Http404
        return FileResponse(p.proof.open("rb"))


class VerifyTransfer(APIView):
    permission_classes = [IsStoreStaff]

    def post(self, request, pk):
        p = Payment.objects.filter(pk=pk, provider="bank_transfer", status=Payment.Status.AWAITING_VERIFICATION).first()
        if not p:
            return Response({"detail": "No transfer awaiting verification."}, status=404)
        if request.data.get("approve") in (True, "true", "1", 1):
            settle_payment(p.pk, p.amount, p.currency)  # staff confirmed funds were received
            audit(request, "payment.transfer_approved", p)
        else:
            fail_payment(p.pk, request.data.get("note", "Transfer rejected"))
            audit(request, "payment.transfer_rejected", p)
        p.refresh_from_db()
        return Response({"status": p.status})


class CODCollect(APIView):
    """Staff records COD cash collected; reconciliation flag set separately."""
    permission_classes = [IsStoreStaff]

    def post(self, request, number):
        with transaction.atomic():
            p = Payment.objects.select_for_update().filter(order__number=number, provider="cod").first()
            if not p:
                return Response({"detail": "No COD payment on this order."}, status=404)
            if p.status != Payment.Status.SUCCESS:
                settle_payment(p.pk, p.amount, p.currency)
            p.refresh_from_db()
            if request.data.get("reconciled") in (True, "true", 1):
                p.reconciled = True
                p.save(update_fields=["reconciled"])
        return Response({"status": p.status, "reconciled": p.reconciled})


class CODReconciliation(APIView):
    permission_classes = [IsStoreStaff]

    def get(self, request):
        qs = Payment.objects.filter(provider="cod").select_related("order")
        return Response([{"order": p.order.number, "amount": p.amount, "status": p.status, "reconciled": p.reconciled}
                         for p in qs])


class WalletView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        w = wallet_svc.get_wallet(request.user)
        txs = w.transactions.all()[:100]
        return Response({"balance": w.balance, "currency": w.currency,
                         "transactions": [{"id": t.id, "kind": t.kind, "amount": t.amount, "balance_after": t.balance_after,
                                           "description": t.description, "created_at": t.created_at} for t in txs]})


class WalletFund(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        try:
            amount = int(request.data.get("amount"))
        except (TypeError, ValueError):
            return Response({"amount": "Integer minor units required."}, status=400)
        if amount < 10000 or amount > 100_000_000:
            return Response({"amount": "Amount out of allowed range."}, status=400)
        provider = request.data.get("provider")
        if provider not in ("paystack", "flutterwave"):
            return Response({"detail": "Unsupported gateway."}, status=400)
        return _initialize(request.user, provider, amount, Payment.Purpose.WALLET_FUNDING)
