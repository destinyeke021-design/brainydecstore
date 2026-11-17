from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("delivery-zones", views.ZoneViewSet, basename="zone")
router.register("deliveries", views.DeliveryAdminViewSet, basename="delivery")
router.register("my-deliveries", views.MyDeliveries, basename="mydelivery")
urlpatterns = [
    path("delivery-agents/performance/", views.AgentPerformance.as_view()),
    path("delivery-agents/<int:user_id>/<str:state>/", views.AgentSuspend.as_view()),
] + router.urls
