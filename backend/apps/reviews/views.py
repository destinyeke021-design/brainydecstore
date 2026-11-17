from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsStoreStaff
from apps.orders.models import OrderItem, OrderStatus
from .models import Review, recalc_rating


class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "product", "author", "rating", "title", "comment", "image", "is_verified_purchase", "is_approved", "created_at"]
        read_only_fields = ["is_verified_purchase", "is_approved", "author"]

    def validate(self, a):
        req = self.context["request"]
        if self.instance is None:
            if Review.objects.filter(user=req.user, product=a["product"]).exists():
                raise serializers.ValidationError("You have already reviewed this product.")
        else:
            a.pop("product", None)  # a review can never be moved to another product
        return a

    def get_author(self, r):
        return (r.user.first_name or "Customer")

    def validate_rating(self, v):
        if not 1 <= v <= 5:
            raise serializers.ValidationError("Rating must be 1-5.")
        return v


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        if self.action in ("moderate", "all_reviews"):
            return [IsStoreStaff()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Review.objects.select_related("user")
        if self.action in ("update", "partial_update", "destroy"):
            return qs.filter(user=self.request.user)
        if p := self.request.query_params.get("product"):
            qs = qs.filter(product_id=p)
        u = self.request.user
        return qs if (u.is_authenticated and u.is_store_staff and self.action != "list") else qs.filter(is_approved=True)

    def perform_create(self, s):
        u = self.request.user
        verified = OrderItem.objects.filter(order__user=u, product=s.validated_data["product"], order__status=OrderStatus.DELIVERED).exists()
        r = s.save(user=u, is_verified_purchase=verified)
        recalc_rating(r.product)

    def perform_update(self, s):
        recalc_rating(s.save().product)

    def perform_destroy(self, inst):
        p = inst.product
        inst.delete()
        recalc_rating(p)

    @action(detail=True, methods=["post"])
    def moderate(self, request, pk=None):
        r = Review.objects.get(pk=pk)
        r.is_approved = request.data.get("approved") in (True, "true", 1, "1")
        r.save(update_fields=["is_approved"])
        recalc_rating(r.product)
        return Response({"is_approved": r.is_approved})
