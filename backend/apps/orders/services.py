import secrets
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.accounts.models import Address
from apps.cart.models import Cart
from apps.catalog.models import Product, ProductStatus, StockMovement, change_stock
from apps.notifications.service import notify
from apps.promotions.models import Coupon, CouponRedemption, FlashSale
from apps.storeconfig.models import StoreSettings
from .models import CUSTOMER_CANCELLABLE, TRANSITIONS, Order, OrderItem, OrderStatus, OrderStatusHistory, PaymentMethod


class CheckoutError(Exception):
    def __init__(self, message, code="checkout_error"):
        super().__init__(message)
        self.message, self.code = message, code


def _order_number():
    return "BD" + timezone.now().strftime("%y%m%d") + secrets.token_hex(3).upper()


def shipping_fee_for(state, subtotal, free_delivery, settings_obj):
    from apps.delivery.models import DeliveryZone
    if free_delivery or (settings_obj.free_shipping_threshold and subtotal >= settings_obj.free_shipping_threshold):
        return 0
    z = DeliveryZone.objects.filter(state__iexact=state, is_active=True).first()
    return z.fee if z else settings_obj.default_shipping_fee


def transition(order, new_status, user=None, note=""):
    """Validated state change + history + side-effects. Call inside transaction.atomic()."""
    cur = OrderStatus(order.status)
    new = OrderStatus(new_status)
    if new not in TRANSITIONS[cur]:
        raise CheckoutError(f"Cannot move order from {cur.label} to {new.label}.", "bad_transition")
    old = order.status
    order.status = new
    order.save(update_fields=["status", "updated_at"])
    OrderStatusHistory.objects.create(order=order, from_status=old, to_status=new, note=note, changed_by=user)
    if new in (OrderStatus.CANCELLED, OrderStatus.FAILED):
        release_stock(order)
    if new == OrderStatus.CONFIRMED and old in (OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_VERIFICATION):
        for it in order.items.all():
            Product.objects.filter(pk=it.product_id).update(sales_count=F("sales_count") + it.quantity)
        from apps.delivery.models import Delivery
        Delivery.objects.get_or_create(order=order)
        notify(order.user, f"Order {order.number} confirmed", "We have received your order and it is being prepared.", sms=True)
    elif new == OrderStatus.SHIPPED:
        notify(order.user, f"Order {order.number} dispatched", "Your order is on its way.", sms=True)
    elif new == OrderStatus.OUT_FOR_DELIVERY:
        notify(order.user, f"Order {order.number} out for delivery", "Your delivery agent is on the way.", sms=True)
    elif new == OrderStatus.DELIVERED:
        notify(order.user, f"Order {order.number} delivered", "Thank you for shopping with Brainy Dec.", sms=True)
    elif new in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
        notify(order.user, f"Order {order.number} {new.label.lower()}", note)
    return order


def release_stock(order):
    if order.stock_released:
        return
    for it in order.items.select_related("flash_sale"):
        change_stock(it.product_id, it.quantity, StockMovement.Kind.RELEASE, reference=order.number)
        if it.flash_sale_id:
            FlashSale.objects.filter(pk=it.flash_sale_id, sold__gte=it.quantity).update(sold=F("sold") - it.quantity)
    order.stock_released = True
    order.save(update_fields=["stock_released"])


def create_order(user, *, address_id, payment_method, coupon_code="", idempotency_key="", delivery_method="platform"):
    s = StoreSettings.load()
    if payment_method not in s.enabled_payment_methods or payment_method not in PaymentMethod.values:
        raise CheckoutError("This payment method is not available.", "payment_method")
    try:
        addr = Address.objects.get(pk=address_id, user=user)
    except Address.DoesNotExist:
        raise CheckoutError("Select a valid delivery address.", "address")
    if addr.country not in s.enabled_countries:
        raise CheckoutError("We do not currently deliver to this country.", "country")

    if idempotency_key:
        dup = Order.objects.filter(user=user, idempotency_key=idempotency_key).first()
        if dup:
            return dup, False

    try:
        with transaction.atomic():
            cart = Cart.objects.select_for_update().filter(user=user).first()
            items = list(cart.items.select_related("product").filter(saved_for_later=False)) if cart else []
            if not items:
                raise CheckoutError("Your cart is empty.", "empty_cart")

            order_items, subtotal = [], 0
            for ci in sorted(items, key=lambda i: i.product_id):  # stable lock ordering avoids deadlocks
                p = Product.objects.select_for_update().get(pk=ci.product_id)
                if p.status != ProductStatus.ACTIVE:
                    raise CheckoutError(f"{p.name} is no longer available.", "unavailable")
                if p.stock_quantity < ci.quantity:
                    raise CheckoutError(f"Insufficient stock for {p.name}.", "insufficient_stock")
                base = min(p.regular_price, p.discounted_price if p.discounted_price is not None else p.regular_price)
                price, fs = base, None
                cand = FlashSale.objects.select_for_update().filter(
                    product=p, is_active=True, starts_at__lte=timezone.now(), ends_at__gt=timezone.now()).order_by("sale_price").first()
                if cand and cand.sale_price < base and (cand.quota is None or cand.sold + ci.quantity <= cand.quota):
                    price, fs = cand.sale_price, cand
                    FlashSale.objects.filter(pk=cand.pk).update(sold=F("sold") + ci.quantity)
                subtotal += price * ci.quantity
                order_items.append((p, ci.quantity, price, fs))

            discount, free_ship, coupon = 0, False, None
            if coupon_code:
                try:
                    coupon = Coupon.objects.select_for_update().get(code=coupon_code.upper().strip())
                    discount, free_ship = coupon.evaluate(subtotal, user)
                except Coupon.DoesNotExist:
                    raise CheckoutError("Invalid coupon code.", "coupon")
                except ValueError as e:
                    raise CheckoutError(str(e), "coupon")

            shipping = shipping_fee_for(addr.state, subtotal, free_ship, s)
            total = subtotal - discount + shipping

            if payment_method == PaymentMethod.COD:
                if not s.cod_enabled:
                    raise CheckoutError("Cash on delivery is not available.", "cod")
                if total > s.cod_max_amount or (s.cod_allowed_states and addr.state.lower() not in [x.lower() for x in s.cod_allowed_states]):
                    raise CheckoutError("Cash on delivery is not available for this order or location.", "cod")

            order = Order.objects.create(
                number=_order_number(), user=user, payment_method=payment_method, currency=s.currency, subtotal=subtotal,
                discount=discount, shipping_fee=shipping, total=total, coupon_code=coupon.code if coupon else "",
                delivery_method=delivery_method, ship_name=addr.full_name, ship_phone=addr.phone, ship_line1=addr.line1,
                ship_line2=addr.line2, ship_city=addr.city, ship_state=addr.state, ship_country=addr.country,
                idempotency_key=idempotency_key)
            OrderStatusHistory.objects.create(order=order, to_status=order.status, note="Order placed", changed_by=user)
            for p, qty, price, fs in order_items:
                OrderItem.objects.create(order=order, product=p, name=p.name, sku=p.sku, unit_price=price, quantity=qty, flash_sale=fs)
                change_stock(p.pk, -qty, StockMovement.Kind.SALE, reference=order.number)  # reservation
            if coupon:
                Coupon.objects.filter(pk=coupon.pk).update(used_count=F("used_count") + 1)
                CouponRedemption.objects.create(coupon=coupon, user=user, order=order)
            cart.items.filter(saved_for_later=False).delete()

            from apps.payments.models import Payment
            from apps.payments import wallet
            if payment_method == PaymentMethod.WALLET:
                try:
                    wallet.debit(user, total, f"order-{order.number}", f"Payment for order {order.number}")
                except wallet.InsufficientFunds:
                    raise CheckoutError("Insufficient wallet balance.", "wallet")
                Payment.objects.create(user=user, order=order, provider="wallet", reference=f"W-{order.number}", amount=total,
                                       currency=s.currency, status="success", verified_at=timezone.now())
                order.is_paid, order.paid_at = True, timezone.now()
                order.save(update_fields=["is_paid", "paid_at"])
                transition(order, OrderStatus.CONFIRMED, user, "Paid from wallet")
            elif payment_method == PaymentMethod.COD:
                Payment.objects.create(user=user, order=order, provider="cod", reference=f"C-{order.number}", amount=total,
                                       currency=s.currency, status="pending")
                transition(order, OrderStatus.CONFIRMED, user, "Cash on delivery order")
            return order, True
    except IntegrityError:
        dup = Order.objects.filter(user=user, idempotency_key=idempotency_key).first() if idempotency_key else None
        if dup:
            return dup, False
        raise


def cancel_order(order, user, by_customer=True, note="Cancelled"):
    from apps.payments.services import refund_to_wallet
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order.pk)
        if by_customer and order.status not in CUSTOMER_CANCELLABLE:
            raise CheckoutError("This order can no longer be cancelled.", "not_cancellable")
        was_paid = order.is_paid and order.payment_method != PaymentMethod.COD
        transition(order, OrderStatus.CANCELLED, user, note)
        if was_paid:
            refund_to_wallet(order, order.total, order.user, "Order cancelled", processed_by=None)
        return order
