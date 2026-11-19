
from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

router.register("coupons", views.CouponViewSet, basename="coupon")
router.register("flash-sales", views.FlashSaleViewSet, basename="flashsale")
router.register("banners", views.BannerViewSet, basename="banner")
router.register("bundles", views.BundleViewSet, basename="bundle")
router.register("sponsored-ads", views.SponsoredAdViewSet, basename="sponsored-ad")

urlpatterns = [
    path("coupons/validate/", views.validate_coupon),
] + router.urls
