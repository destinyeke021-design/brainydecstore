from django.db import models


class Cart(models.Model):
    user = models.OneToOneField("accounts.User", null=True, blank=True, on_delete=models.CASCADE, related_name="cart")
    guest_token = models.CharField(max_length=64, null=True, blank=True, unique=True)
    updated_at = models.DateTimeField(auto_now=True)


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE)
    variant = models.ForeignKey("catalog.ProductVariant", null=True, blank=True, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    saved_for_later = models.BooleanField(default=False)

    class Meta:
        unique_together = [("cart", "product", "variant")]


class Wishlist(models.Model):
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="wishlist")


class WishlistItem(models.Model):
    wishlist = models.ForeignKey(Wishlist, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("wishlist", "product")]
