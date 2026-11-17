from rest_framework import serializers
from .models import Brand, Category, Product, ProductImage, ProductSpecification, ProductVariant, StockMovement


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "parent", "is_active"]
        read_only_fields = ["slug"]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name", "slug"]
        read_only_fields = ["slug"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "alt_text", "is_primary"]


class VariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ["id", "sku", "color", "size", "price_override", "stock_quantity"]


class SpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSpecification
        fields = ["id", "name", "value"]


class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = VariantSerializer(many=True, read_only=True)
    specifications = SpecSerializer(many=True, read_only=True)
    current_price = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    in_stock = serializers.SerializerMethodField()
    flash_sale_ends_at = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "name", "slug", "sku", "description", "short_description", "category", "category_name",
                  "brand", "brand_name", "currency", "regular_price", "discounted_price", "current_price",
                  "stock_quantity", "in_stock", "low_stock_threshold", "status", "is_featured", "rating_avg",
                  "review_count", "sales_count", "images", "variants", "specifications", "flash_sale_ends_at",
                  "created_at", "updated_at"]
        read_only_fields = ["slug", "rating_avg", "review_count", "sales_count", "created_at", "updated_at"]

    def get_current_price(self, o):
        return o.current_price()

    def get_in_stock(self, o):
        return o.stock_quantity > 0

    def get_flash_sale_ends_at(self, o):
        fs = o.active_flash_sale()
        return fs.ends_at if fs else None

    def validate(self, a):
        reg = a.get("regular_price", getattr(self.instance, "regular_price", None))
        disc = a.get("discounted_price", getattr(self.instance, "discounted_price", None))
        if disc is not None and reg is not None and disc > reg:
            raise serializers.ValidationError({"discounted_price": "Cannot exceed regular price."})
        return a


class PublicProductSerializer(ProductSerializer):
    class Meta(ProductSerializer.Meta):
        fields = [f for f in ProductSerializer.Meta.fields if f not in ("low_stock_threshold", "sku")]


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = "__all__"
