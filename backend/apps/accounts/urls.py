from django.urls import include, path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("addresses", views.AddressViewSet, basename="address")
router.register("staff", views.StaffViewSet, basename="staff")

urlpatterns = [
    path("register/", views.RegisterView.as_view()),
    path("login/", views.LoginView.as_view()),
    path("refresh/", views.RefreshView.as_view()),
    path("logout/", views.LogoutView.as_view()),
    path("me/", views.MeView.as_view()),
    path("password-reset/", views.PasswordResetRequestView.as_view()),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view()),
    path("customers/", views.CustomerListView.as_view()),
    path("audit-logs/", views.AuditLogView.as_view()),
    path("", include(router.urls)),
]
