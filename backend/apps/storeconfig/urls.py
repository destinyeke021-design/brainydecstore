from django.urls import path
from . import views
urlpatterns = [
    path("settings/public/", views.PublicSettingsView.as_view()),
    path("settings/", views.AdminSettingsView.as_view()),
    path("newsletter/", views.newsletter),
]
