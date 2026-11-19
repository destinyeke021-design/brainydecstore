from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("products", views.ProductViewSet, basename="product")
router.register("categories", views.CategoryViewSet, basename="category")
router.register("brands", views.BrandViewSet, basename="brand")
router.register("stock-movements", views.StockMovementList, basename="stockmovement")

urlpatterns = [
    path("homepage/", views.HomepageView.as_view(), name="homepage"),
] + router.urls