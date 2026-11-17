from rest_framework import serializers
from .models import Order, OrderItem, OrderStatusHistory


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "name", "sku", "unit_price", "quantity", "line_total"]


class HistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ["from_status", "to_status", "note", "created_at"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    history = HistorySerializer(many=True, read_only=True)
    customer_email = serializers.EmailField(source="user.email", read_only=True)
    delivery = serializers.SerializerMethodField()

    class Meta:
        model = Order
        exclude = ["idempotency_key", "stock_released"]

    def get_delivery(self, o):
        d = getattr(o, "delivery", None)
        return {"status": d.status, "tracking_number": d.tracking_number} if d else None


class CheckoutSerializer(serializers.Serializer):
    address_id = serializers.IntegerField()
    payment_method = serializers.CharField()
    coupon_code = serializers.CharField(required=False, allow_blank=True, default="")
    idempotency_key = serializers.CharField(required=False, allow_blank=True, max_length=64, default="")
    delivery_method = serializers.CharField(required=False, default="platform")
