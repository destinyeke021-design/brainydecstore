from django.urls import path
from . import views
urlpatterns = [path("notifications/", views.NotificationList.as_view()), path("notifications/read/", views.MarkRead.as_view())]
