from rest_framework import serializers
from .models import Banner, Bundle, Coupon, FlashSale


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = "__all__"
        read_only_fields = ["used_count"]

    def validate(self, a):
        if a.get("kind") == "percent" and not (1 <= a.get("value", 0) <= 100):
            raise serializers.ValidationError({"value": "Percent must be 1-100."})
        return a


class FlashSaleSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    regular_price = serializers.IntegerField(source="product.regular_price", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)

    class Meta:
        model = FlashSale
        fields = "__all__"
        read_only_fields = ["sold"]

    def validate(self, a):
        if a["ends_at"] <= a["starts_at"]:
            raise serializers.ValidationError("ends_at must be after starts_at.")
        if a["sale_price"] > a["product"].regular_price:
            raise serializers.ValidationError("Sale price cannot exceed the regular price.")
        return a


class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = "__all__"


class BundleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bundle
        fields = "__all__"
