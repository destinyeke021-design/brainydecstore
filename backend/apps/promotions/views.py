
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.accounts.permissions import IsStoreStaff, ReadOnlyOrStoreStaff
from .models import Banner, Bundle, Coupon, FlashSale, SponsoredAd
from .serializers import (
    BannerSerializer,
    BundleSerializer,
    CouponSerializer,
    FlashSaleSerializer,
    SponsoredAdSerializer,
)


class CouponViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStoreStaff]
    queryset = Coupon.objects.all().order_by("-id")
    serializer_class = CouponSerializer


class FlashSaleViewSet(viewsets.ModelViewSet):
    permission_classes = [ReadOnlyOrStoreStaff]
    serializer_class = FlashSaleSerializer

    def get_queryset(self):
        qs = FlashSale.objects.select_related("product").order_by("ends_at")
        u = self.request.user
        if not (u.is_authenticated and u.is_store_staff):
            now = timezone.now()
            qs = qs.filter(
                is_active=True,
                starts_at__lte=now,
                ends_at__gt=now,
            )
        return qs


class BannerViewSet(viewsets.ModelViewSet):
    permission_classes = [ReadOnlyOrStoreStaff]
    serializer_class = BannerSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Banner.objects.all()
        u = self.request.user
        if not (u.is_authenticated and u.is_store_staff):
            now = timezone.now()
            qs = qs.filter(
                is_active=True,
                starts_at__lte=now,
            ).filter(
                Q(ends_at__isnull=True) | Q(ends_at__gt=now)
            )
        return qs


class SponsoredAdViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SponsoredAdSerializer
    pagination_class = None

    def get_queryset(self):
        now = timezone.now()
        return SponsoredAd.objects.filter(
            is_active=True,
            payment_status=SponsoredAd.PaymentStatus.PAID,
            approval_status=SponsoredAd.ApprovalStatus.APPROVED,
            placement=SponsoredAd.Placement.HOMEPAGE,
            starts_at__lte=now,
            ends_at__gt=now,
        ).order_by("-created_at")


class BundleViewSet(viewsets.ModelViewSet):
    permission_classes = [ReadOnlyOrStoreStaff]
    serializer_class = BundleSerializer
    queryset = Bundle.objects.filter(is_active=True)


@api_view(["POST"])
def validate_coupon(request):
    try:
        c = Coupon.objects.get(
            code=str(request.data.get("code", "")).upper().strip()
        )
        d, fd = c.evaluate(
            int(request.data.get("subtotal", 0)),
            request.user,
        )
    except Coupon.DoesNotExist:
        return Response({"detail": "Invalid coupon code."}, status=400)
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)

    return Response({"discount": d, "free_delivery": fd})
