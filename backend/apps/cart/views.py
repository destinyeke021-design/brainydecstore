import secrets
from django.db import transaction
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product, ProductStatus
from apps.catalog.serializers import PublicProductSerializer
from apps.storeconfig.models import StoreSettings
from apps.promotions.models import Coupon
from .models import Cart, CartItem, Wishlist, WishlistItem


def get_cart(request, create=True):
    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
        token = request.headers.get("X-Guest-Cart")
        if token:  # merge guest cart after login
            guest = Cart.objects.filter(guest_token=token, user__isnull=True).first()
            if guest:
                with transaction.atomic():
                    for gi in guest.items.all():
                        ci, made = CartItem.objects.get_or_create(cart=cart, product=gi.product, variant=gi.variant,
                                                                  defaults={"quantity": gi.quantity})
                        if not made:
                            ci.quantity += gi.quantity
                            ci.save()
                    guest.delete()
        return cart
    token = request.headers.get("X-Guest-Cart")
    cart = Cart.objects.filter(guest_token=token, user__isnull=True).first() if token else None
    if not cart and create:
        cart = Cart.objects.create(guest_token=secrets.token_urlsafe(24))
    return cart


def cart_payload(cart, coupon_code=None, user=None, state=None):
    lines, subtotal = [], 0
    for it in cart.items.select_related("product").prefetch_related("product__images"):
        p = it.product
        price = p.current_price()
        qty = min(it.quantity, p.stock_quantity) if p.status == ProductStatus.ACTIVE else 0
        available = p.status == ProductStatus.ACTIVE and p.stock_quantity >= it.quantity
        if not it.saved_for_later:
            subtotal += price * qty
        lines.append({"id": it.id, "product": PublicProductSerializer(p).data, "quantity": it.quantity,
                      "unit_price": price, "line_total": price * qty, "available": available,
                      "saved_for_later": it.saved_for_later})
    s = StoreSettings.load()
    discount, free_ship, coupon_error = 0, False, None
    if coupon_code:
        try:
            discount, free_ship = Coupon.objects.get(code=coupon_code.upper()).evaluate(subtotal, user)
        except Coupon.DoesNotExist:
            coupon_error = "Invalid coupon code."
        except ValueError as e:
            coupon_error = str(e)
    shipping = 0 if (free_ship or (s.free_shipping_threshold and subtotal >= s.free_shipping_threshold) or subtotal == 0) \
        else s.default_shipping_fee
    return {"items": lines, "subtotal": subtotal, "discount": discount, "shipping": shipping,
            "total": subtotal - discount + shipping, "currency": s.currency, "coupon_error": coupon_error}


class CartView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cart = get_cart(request)
        r = Response(cart_payload(cart, request.query_params.get("coupon"), request.user))
        r["X-Guest-Cart"] = cart.guest_token or ""
        return r


class CartItemView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Set absolute quantity (0 removes). Validates stock."""
        cart = get_cart(request)
        try:
            product = Product.objects.get(pk=request.data.get("product"), status=ProductStatus.ACTIVE)
            qty = int(request.data.get("quantity", 1))
        except (Product.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "Invalid product or quantity."}, status=400)
        if qty < 0:
            return Response({"detail": "Invalid quantity."}, status=400)
        if qty > product.stock_quantity:
            return Response({"detail": f"Only {product.stock_quantity} in stock."}, status=400)
        if qty == 0:
            CartItem.objects.filter(cart=cart, product=product).delete()
        else:
            CartItem.objects.update_or_create(cart=cart, product=product, variant=None, defaults={"quantity": qty})
        r = Response(cart_payload(cart, user=request.user))
        r["X-Guest-Cart"] = cart.guest_token or ""
        return r

    def delete(self, request):
        cart = get_cart(request)
        CartItem.objects.filter(cart=cart).delete()
        return Response(cart_payload(cart, user=request.user))


class WishlistView(APIView):
    def get(self, request):
        wl, _ = Wishlist.objects.get_or_create(user=request.user)
        prods = [i.product for i in wl.items.select_related("product")]
        return Response(PublicProductSerializer(prods, many=True).data)

    def post(self, request):
        wl, _ = Wishlist.objects.get_or_create(user=request.user)
        WishlistItem.objects.get_or_create(wishlist=wl, product_id=request.data.get("product"))
        return Response(status=201)

    def delete(self, request):
        WishlistItem.objects.filter(wishlist__user=request.user, product_id=request.query_params.get("product")).delete()
        return Response(status=204)


class WishlistToCartView(APIView):
    def post(self, request):
        cart = get_cart(request)
        item = WishlistItem.objects.filter(wishlist__user=request.user, product_id=request.data.get("product")).select_related("product").first()
        if not item or item.product.stock_quantity < 1:
            return Response({"detail": "Product unavailable."}, status=400)
        CartItem.objects.get_or_create(cart=cart, product=item.product, variant=None, defaults={"quantity": 1})
        item.delete()
        return Response(cart_payload(cart, user=request.user))
