from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role, User, audit
from apps.accounts.permissions import IsDeliveryAgent, IsStoreStaff
from apps.orders.models import Order, OrderStatus
from apps.orders.services import CheckoutError, transition
from apps.payments.models import Payment
from apps.payments.services import settle_payment
from .models import Delivery, DeliveryAgentProfile, DeliveryZone
from .providers import get_provider


class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryZone
        fields = "__all__"


class ZoneViewSet(viewsets.ModelViewSet):
    queryset = DeliveryZone.objects.all()
    serializer_class = ZoneSerializer
    pagination_class = None

    def get_permissions(self):
        return [IsStoreStaff()] if self.action != "list" else []


class DeliverySerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.number")
    order_status = serializers.CharField(source="order.status")
    agent_email = serializers.EmailField(source="agent.email", default=None)

    class Meta:
        model = Delivery
        fields = ["id", "order_number", "order_status", "status", "agent", "agent_email", "provider", "tracking_number",
                  "failure_reason", "attempts", "assigned_at", "delivered_at"]


class AgentDeliverySerializer(serializers.ModelSerializer):
    """Only the data an agent needs for fulfilment; no wallet/financial history, no email."""
    order_number = serializers.CharField(source="order.number")
    recipient = serializers.CharField(source="order.ship_name")
    phone = serializers.CharField(source="order.ship_phone")
    address = serializers.SerializerMethodField()
    cod_amount_due = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = ["id", "order_number", "status", "recipient", "phone", "address", "cod_amount_due", "items", "tracking_number"]

    def get_address(self, d):
        o = d.order
        return ", ".join(x for x in [o.ship_line1, o.ship_line2, o.ship_city, o.ship_state] if x)

    def get_cod_amount_due(self, d):
        return d.order.total if d.order.payment_method == "cod" and not d.order.is_paid else 0

    def get_items(self, d):
        return [{"name": i.name, "quantity": i.quantity} for i in d.order.items.all()]


class DeliveryAdminViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsStoreStaff]
    serializer_class = DeliverySerializer
    queryset = Delivery.objects.select_related("order", "agent").order_by("-id")

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        d = self.get_object()
        try:
            agent = User.objects.get(pk=request.data.get("agent"), role=Role.DELIVERY_AGENT, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "Invalid delivery agent."}, status=400)
        prof = DeliveryAgentProfile.objects.filter(user=agent).first()
        if prof and prof.is_suspended:
            return Response({"detail": "Agent is suspended."}, status=400)
        if d.status in (Delivery.Status.DELIVERED,):
            return Response({"detail": "Already delivered."}, status=400)
        d.agent, d.status, d.assigned_at = agent, Delivery.Status.ASSIGNED, timezone.now()
        d.tracking_number = d.tracking_number or get_provider(d.provider).create_shipment(d.order)["tracking_number"]
        d.save()
        audit(request, "delivery.assign", d, agent=agent.pk)
        return Response(DeliverySerializer(d).data)


class AgentSuspend(APIView):
    permission_classes = [IsStoreStaff]

    def post(self, request, user_id, state):
        prof, _ = DeliveryAgentProfile.objects.get_or_create(user_id=user_id)
        prof.is_suspended = state == "suspend"
        prof.save()
        audit(request, f"agent.{state}", prof)
        return Response({"is_suspended": prof.is_suspended})


class AgentPerformance(APIView):
    permission_classes = [IsStoreStaff]

    def get(self, request):
        from django.db.models import Count, Q
        rows = User.objects.filter(role=Role.DELIVERY_AGENT).annotate(
            assigned=Count("deliveries"), delivered=Count("deliveries", filter=Q(deliveries__status="delivered")),
            failed=Count("deliveries", filter=Q(deliveries__status="failed"))).values("id", "email", "assigned", "delivered", "failed")
        return Response(list(rows))


class MyDeliveries(viewsets.GenericViewSet):
    permission_classes = [IsDeliveryAgent]
    serializer_class = AgentDeliverySerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):  # strictly the agent's own deliveries
        return Delivery.objects.filter(agent=self.request.user).select_related("order").prefetch_related("order__items").order_by("-id")

    def list(self, request):
        qs = self.get_queryset()
        if request.query_params.get("history") != "1":
            qs = qs.exclude(status__in=["delivered", "failed"])
        return Response(AgentDeliverySerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        prof = DeliveryAgentProfile.objects.filter(user=request.user).first()
        if prof and prof.is_suspended:
            return Response({"detail": "Your account is suspended."}, status=403)
        new = request.data.get("status")
        order_target = {"picked_up": OrderStatus.SHIPPED, "out_for_delivery": OrderStatus.OUT_FOR_DELIVERY,
                        "delivered": OrderStatus.DELIVERED, "failed": OrderStatus.READY_FOR_DISPATCH}
        if new not in order_target:
            return Response({"detail": "Invalid status."}, status=400)
        with transaction.atomic():
            from django.shortcuts import get_object_or_404
            d = get_object_or_404(self.get_queryset().select_for_update(of=("self",)), pk=pk)
            if new == "failed" and not request.data.get("reason"):
                return Response({"detail": "Failure reason required."}, status=400)
            if new == "delivered" and d.order.payment_method == "cod" and not d.order.is_paid:
                p = Payment.objects.get(order=d.order, provider="cod")
                settle_payment(p.pk, p.amount, p.currency)  # cash collected on handover
            order = Order.objects.select_for_update().get(pk=d.order_id)
            try:
                if new == "delivered" and order.status == OrderStatus.SHIPPED:
                    pass
                transition(order, order_target[new], request.user, request.data.get("reason", ""))
            except CheckoutError as e:
                return Response({"detail": e.message}, status=400)
            d.status = new
            if new == "failed":
                d.failure_reason, d.attempts = request.data.get("reason", ""), d.attempts + 1
                d.agent = d.agent  # stays assigned for re-attempt
            if new == "delivered":
                d.delivered_at = timezone.now()
            if request.FILES.get("evidence"):
                d.evidence = request.FILES["evidence"]
            d.save()
        return Response(AgentDeliverySerializer(d).data)
