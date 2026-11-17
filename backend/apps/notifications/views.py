from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification


class NS(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "is_read", "created_at"]


class NotificationList(generics.ListAPIView):
    serializer_class = NS

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class MarkRead(APIView):
    def post(self, request):
        Notification.objects.filter(user=request.user).update(is_read=True)
        return Response(status=204)
