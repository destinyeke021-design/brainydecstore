from django.db.models import Q
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import Role, User
from apps.accounts.permissions import IsStoreStaff
from apps.notifications.service import notify
from .models import Ticket, TicketMessage


class MsgSerializer(serializers.ModelSerializer):
    author_role = serializers.CharField(source="author.role", read_only=True)

    class Meta:
        model = TicketMessage
        fields = ["id", "body", "is_internal", "author_role", "created_at"]
        read_only_fields = ["is_internal"]


class TicketSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()
    order_summary = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = ["id", "order", "category", "subject", "status", "priority", "assigned_to", "resolution", "messages",
                  "order_summary", "created_at", "updated_at"]
        read_only_fields = ["status", "assigned_to", "resolution"]

    def get_messages(self, t):
        qs = t.messages.all()
        u = self.context["request"].user
        if u.role == Role.CUSTOMER:
            qs = qs.filter(is_internal=False)
        return MsgSerializer(qs, many=True).data

    def get_order_summary(self, t):
        u = self.context["request"].user
        if not t.order or u.role == Role.CUSTOMER:
            return None
        o = t.order  # relevant order info only (no payment/financial history)
        return {"number": o.number, "status": o.status, "total": o.total, "created_at": o.created_at}

    def validate_order(self, o):
        if o and o.user_id != self.context["request"].user.id:
            raise serializers.ValidationError("Invalid order.")
        return o


class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    http_method_names = ["get", "post"]

    def get_queryset(self):
        u = self.request.user
        qs = Ticket.objects.select_related("order").prefetch_related("messages")
        if u.role == Role.CUSTOMER:
            return qs.filter(customer=u)
        if u.is_store_staff:
            return qs
        if u.role == Role.SUPPORT_AGENT:
            return qs.filter(assigned_to=u)  # assigned complaints only
        return qs.none()

    def perform_create(self, s):
        if self.request.user.role != Role.CUSTOMER:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only customers can open tickets.")
        s.save(customer=self.request.user)

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        t = self.get_object()
        internal = request.data.get("internal") in (True, "true", 1) and request.user.role != Role.CUSTOMER
        TicketMessage.objects.create(ticket=t, author=request.user, body=request.data.get("body", ""), is_internal=internal)
        if request.user.role != Role.CUSTOMER and not internal:
            notify(t.customer, f"New reply on ticket #{t.pk}", request.data.get("body", "")[:200], kind="support")
            if t.status == Ticket.Status.OPEN:
                t.status = Ticket.Status.IN_PROGRESS
                t.save(update_fields=["status"])
        return Response(TicketSerializer(t, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsStoreStaff])
    def assign(self, request, pk=None):
        t = self.get_object()
        t.assigned_to = User.objects.get(pk=request.data.get("agent"), role=Role.SUPPORT_AGENT)
        t.save(update_fields=["assigned_to"])
        return Response(TicketSerializer(t, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def escalate(self, request, pk=None):
        t = self.get_object()
        if request.user.role == Role.CUSTOMER:
            return Response(status=403)
        t.status, t.priority = Ticket.Status.ESCALATED, Ticket.Priority.URGENT
        t.save(update_fields=["status", "priority"])
        return Response({"status": t.status})

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        t = self.get_object()
        if request.user.role == Role.CUSTOMER:
            return Response(status=403)
        t.status, t.resolution = Ticket.Status.RESOLVED, request.data.get("resolution", "")
        t.save(update_fields=["status", "resolution"])
        notify(t.customer, f"Ticket #{t.pk} resolved", t.resolution[:200], kind="support")
        return Response({"status": t.status})
