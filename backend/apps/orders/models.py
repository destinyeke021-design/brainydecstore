from django.db import models


class OrderStatus(models.TextChoices):
    PENDING_PAYMENT = "pending_payment", "Pending payment"
    PAYMENT_VERIFICATION = "payment_verification", "Payment verification"
    CONFIRMED = "confirmed", "Confirmed"
    PROCESSING = "processing", "Processing"
    READY_FOR_DISPATCH = "ready_for_dispatch", "Ready for dispatch"
    SHIPPED = "shipped", "Shipped"
    OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"
    FAILED = "failed", "Failed"
    REFUND_REQUESTED = "refund_requested", "Refund requested"
    REFUNDED = "refunded", "Refunded"


S = OrderStatus
TRANSITIONS = {
    S.PENDING_PAYMENT: {S.PAYMENT_VERIFICATION, S.CONFIRMED, S.CANCELLED, S.FAILED},
    S.PAYMENT_VERIFICATION: {S.CONFIRMED, S.FAILED, S.CANCELLED, S.PENDING_PAYMENT},
    S.CONFIRMED: {S.PROCESSING, S.CANCELLED, S.REFUND_REQUESTED},
    S.PROCESSING: {S.READY_FOR_DISPATCH, S.CANCELLED, S.REFUND_REQUESTED},
    S.READY_FOR_DISPATCH: {S.SHIPPED, S.CANCELLED, S.REFUND_REQUESTED},
    S.SHIPPED: {S.OUT_FOR_DELIVERY, S.DELIVERED, S.READY_FOR_DISPATCH},
    S.OUT_FOR_DELIVERY: {S.DELIVERED, S.READY_FOR_DISPATCH},
    S.DELIVERED: {S.REFUND_REQUESTED},
    S.REFUND_REQUESTED: {S.REFUNDED, S.CONFIRMED, S.PROCESSING, S.READY_FOR_DISPATCH, S.DELIVERED},
    S.CANCELLED: set(), S.FAILED: set(), S.REFUNDED: set(),
}
CUSTOMER_CANCELLABLE = {S.PENDING_PAYMENT, S.PAYMENT_VERIFICATION, S.CONFIRMED}


class PaymentMethod(models.TextChoices):
    PAYSTACK = "paystack", "Paystack"
    FLUTTERWAVE = "flutterwave", "Flutterwave"
    BANK_TRANSFER = "bank_transfer", "Bank transfer"
    COD = "cod", "Cash on delivery"
    WALLET = "wallet", "Wallet"


class Order(models.Model):
    number = models.CharField(max_length=20, unique=True)
    user = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=24, choices=OrderStatus.choices, default=OrderStatus.PENDING_PAYMENT, db_index=True)
    payment_method = models.CharField(max_length=15, choices=PaymentMethod.choices)
    currency = models.CharField(max_length=3, default="NGN")
    subtotal = models.BigIntegerField()
    discount = models.BigIntegerField(default=0)
    shipping_fee = models.BigIntegerField(default=0)
    total = models.BigIntegerField()
    coupon_code = models.CharField(max_length=40, blank=True)
    delivery_method = models.CharField(max_length=20, default="platform")
    ship_name = models.CharField(max_length=120)
    ship_phone = models.CharField(max_length=20)
    ship_line1 = models.CharField(max_length=255)
    ship_line2 = models.CharField(max_length=255, blank=True)
    ship_city = models.CharField(max_length=100)
    ship_state = models.CharField(max_length=100)
    ship_country = models.CharField(max_length=2, default="NG")
    idempotency_key = models.CharField(max_length=64, blank=True)
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    stock_released = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "idempotency_key"], condition=~models.Q(idempotency_key=""), name="uniq_order_idem"),
            models.CheckConstraint(check=models.Q(total__gte=0), name="order_total_nonneg"),
        ]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="order_items")
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64)
    unit_price = models.BigIntegerField()
    quantity = models.PositiveIntegerField()
    flash_sale = models.ForeignKey("promotions.FlashSale", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    @property
    def line_total(self):
        return self.unit_price * self.quantity


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="history")
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24)
    note = models.CharField(max_length=255, blank=True)
    changed_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
