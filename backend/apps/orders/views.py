import io
from django.db import transaction
from django.http import HttpResponse
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import audit
from apps.accounts.permissions import IsCustomer, IsStoreStaff
from apps.payments.models import Payment, Refund
from apps.payments import wallet as wallet_svc
from .models import Order, OrderStatus
from .serializers import CheckoutSerializer, OrderSerializer
from .services import CheckoutError, cancel_order, create_order, transition


class CheckoutView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        s = CheckoutSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            order, created = create_order(request.user, **s.validated_data)
        except CheckoutError as e:
            return Response({"detail": e.message, "code": e.code}, status=400)
        return Response(OrderSerializer(order).data, status=201 if created else 200)


class OrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Customers: own orders only. Store staff: every order."""
    serializer_class = OrderSerializer
    lookup_field = "number"

    def get_queryset(self):
        qs = Order.objects.select_related("user", "delivery").prefetch_related("items", "history")
        u = self.request.user
        if u.is_store_staff:
            if st := self.request.query_params.get("status"):
                qs = qs.filter(status=st)
            return qs
        if u.role == "customer":
            return qs.filter(user=u)
        return qs.none()

    @action(detail=True, methods=["post"])
    def cancel(self, request, number=None):
        order = self.get_object()
        try:
            order = cancel_order(order, request.user, by_customer=not request.user.is_store_staff,
                                 note=request.data.get("reason", "Cancelled"))
        except CheckoutError as e:
            return Response({"detail": e.message}, status=400)
        audit(request, "order.cancel", order)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"], permission_classes=[IsStoreStaff])
    def set_status(self, request, number=None):
        order = self.get_object()
        target = request.data.get("status")
        # Money-affecting states are reachable ONLY through their own flows (payment, refund).
        if target not in ("processing", "ready_for_dispatch", "shipped", "out_for_delivery", "delivered", "cancelled"):
            return Response({"detail": "This status cannot be set manually."}, status=400)
        try:
            if target == "cancelled":
                order = cancel_order(order, request.user, by_customer=False, note=request.data.get("note", "Cancelled by staff"))
                audit(request, "order.cancel", order)
                return Response(OrderSerializer(order).data)
            with transaction.atomic():
                order = Order.objects.select_for_update().get(pk=order.pk)
                transition(order, target, request.user, request.data.get("note", ""))
        except (CheckoutError, ValueError) as e:
            return Response({"detail": getattr(e, "message", str(e))}, status=400)
        audit(request, "order.status", order, to=order.status)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"], permission_classes=[IsCustomer])
    def refund(self, request, number=None):
        order = self.get_object()
        if not order.is_paid or order.status not in (OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.READY_FOR_DISPATCH, OrderStatus.DELIVERED):
            return Response({"detail": "This order is not eligible for a refund request."}, status=400)
        if order.refunds.filter(status="requested").exists():
            return Response({"detail": "A refund request is already open."}, status=400)
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=order.pk)
            prev = order.status
            transition(order, OrderStatus.REFUND_REQUESTED, request.user, "Refund requested")
            Refund.objects.create(order=order, requested_by=request.user, amount=order.total, reason=request.data.get("reason", ""),
                                  previous_order_status=prev)
        return Response(OrderSerializer(order).data, status=201)

    @action(detail=True, methods=["get"])
    def invoice(self, request, number=None):
        order = self.get_object()
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        y = h - 60
        c.setFont("Helvetica-Bold", 18); c.drawString(50, y, "BRAINY DEC"); y -= 22
        c.setFont("Helvetica", 11)
        c.drawString(50, y, f"{'Receipt' if order.is_paid else 'Invoice'} for order {order.number}"); y -= 16
        c.drawString(50, y, f"Date: {order.created_at:%Y-%m-%d}   Status: {order.get_status_display()}"); y -= 16
        c.drawString(50, y, f"Bill to: {order.ship_name}, {order.ship_line1}, {order.ship_city}, {order.ship_state}"); y -= 30
        fmt = lambda m: f"{order.currency} {m / 100:,.2f}"
        c.setFont("Helvetica-Bold", 10); c.drawString(50, y, "Item"); c.drawString(330, y, "Qty"); c.drawString(380, y, "Unit"); c.drawString(470, y, "Total"); y -= 14
        c.setFont("Helvetica", 10)
        for it in order.items.all():
            c.drawString(50, y, it.name[:45]); c.drawString(330, y, str(it.quantity)); c.drawString(380, y, fmt(it.unit_price)); c.drawString(470, y, fmt(it.line_total)); y -= 14
            if y < 100:
                c.showPage(); y = h - 60
        y -= 10
        for label, v in (("Subtotal", order.subtotal), ("Discount", -order.discount), ("Shipping", order.shipping_fee), ("TOTAL", order.total)):
            c.drawString(380, y, label); c.drawString(470, y, fmt(v)); y -= 14
        c.save()
        r = HttpResponse(buf.getvalue(), content_type="application/pdf")
        r["Content-Disposition"] = f'attachment; filename="{order.number}.pdf"'
        return r


class RefundActionView(APIView):
    permission_classes = [IsStoreStaff]

    def post(self, request, pk, decision):
        if decision not in ("approve", "reject"):
            return Response({"detail": "Decision must be approve or reject."}, status=400)
        with transaction.atomic():
            r = Refund.objects.select_for_update().select_related("order").get(pk=pk)
            if r.status != Refund.Status.REQUESTED:
                return Response({"detail": "Refund already decided."}, status=400)
            order = Order.objects.select_for_update().get(pk=r.order_id)
            from django.utils import timezone
            r.processed_by, r.processed_at = request.user, timezone.now()
            if decision == "approve":
                r.status = Refund.Status.PROCESSED
                r.save()
                wallet_svc.credit(order.user, r.amount, f"refund-{r.pk}", f"Refund for order {order.number}")
                transition(order, OrderStatus.REFUNDED, request.user, "Refund approved")
                from apps.orders.services import release_stock
                if r.previous_order_status != OrderStatus.DELIVERED:
                    release_stock(order)
            else:
                r.status = Refund.Status.REJECTED
                r.save()
                transition(order, r.previous_order_status or OrderStatus.CONFIRMED, request.user, "Refund rejected")
        audit(request, f"refund.{decision}", r)
        return Response({"status": r.status})


class RefundListView(APIView):
    permission_classes = [IsStoreStaff]

    def get(self, request):
        return Response([{"id": r.id, "order": r.order.number, "amount": r.amount, "status": r.status, "reason": r.reason,
                          "created_at": r.created_at} for r in Refund.objects.select_related("order")])
