from rest_framework import permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import audit
from apps.accounts.permissions import IsSuperAdmin
from .models import NewsletterSubscriber, StoreSettings


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        fields = "__all__"


class PublicSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        s = StoreSettings.load()
        return Response({"store_name": s.store_name, "currency": s.currency, "enabled_countries": s.enabled_countries,
                         "enabled_payment_methods": s.enabled_payment_methods, "bank_name": s.bank_name,
                         "bank_account_name": s.bank_account_name, "bank_account_number": s.bank_account_number,
                         "free_shipping_threshold": s.free_shipping_threshold})


class AdminSettingsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response(SettingsSerializer(StoreSettings.load()).data)

    def patch(self, request):
        s = SettingsSerializer(StoreSettings.load(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        audit(request, "settings.update", None, fields=list(request.data.keys()))
        return Response(s.data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def newsletter(request):
    email = str(request.data.get("email", "")).strip().lower()
    try:
        serializers.EmailField().run_validation(email)
    except serializers.ValidationError:
        return Response({"email": "Enter a valid email."}, status=400)
    NewsletterSubscriber.objects.get_or_create(email=email)
    return Response({"detail": "Subscribed."}, status=201)
