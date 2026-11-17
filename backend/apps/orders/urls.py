from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("orders", views.OrderViewSet, basename="order")
urlpatterns = [
    path("checkout/", views.CheckoutView.as_view()),
    path("refunds/", views.RefundListView.as_view()),
    path("refunds/<int:pk>/<str:decision>/", views.RefundActionView.as_view()),
] + router.urls
