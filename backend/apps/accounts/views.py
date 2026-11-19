
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.contrib.auth.password_validation import validate_password
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Address, AuditLog, Role, User, audit
from .permissions import IsStoreStaff, IsSuperAdmin
from .serializers import AddressSerializer, RegisterSerializer, StaffCreateSerializer, UserSerializer


class LoginView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RefreshView(TokenRefreshView):
    pass


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def create(self, request, *a, **kw):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()

        try:
            send_mail(
                "Welcome to BD Store!",
                (
                    f"Hello {user.first_name or 'there'},\n\n"
                    "Welcome to BD Store!\n\n"
                    "Your account has been created successfully. "
                    "You can now sign in, explore our products and place orders.\n\n"
                    "Thank you for choosing BD Store.\n\n"
                    "Happy shopping!\n"
                    "BD Store Team"
                ),
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
            )
        except Exception:
            pass

        return Response(UserSerializer(user).data, status=201)


class LogoutView(APIView):
    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh")).blacklist()
        except Exception:
            pass
        return Response(status=204)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        user = User.objects.filter(
            email__iexact=request.data.get("email", "")
        ).first()

        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"

            send_mail(
                "Reset your BD Store password",
                (
                    "Hello,\n\n"
                    "We received a request to reset your BD Store password.\n\n"
                    f"Use the link below to reset your password:\n{link}\n\n"
                    "If you did not request this change, you can ignore this email.\n\n"
                    "BD Store Team"
                ),
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
            )

        return Response({
            "detail": "If the email exists, a reset link has been sent."
        })


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            user = User.objects.get(
                pk=force_str(urlsafe_base64_decode(request.data.get("uid", "")))
            )
        except Exception:
            return Response({"detail": "Invalid link."}, status=400)

        if not default_token_generator.check_token(
            user, request.data.get("token", "")
        ):
            return Response({"detail": "Invalid or expired link."}, status=400)

        pw = request.data.get("password", "")

        from django.core.exceptions import ValidationError as DjangoVE

        try:
            validate_password(pw, user)
        except DjangoVE as e:
            return Response({"password": list(e.messages)}, status=400)

        user.set_password(pw)
        user.save()

        return Response({"detail": "Password updated."})


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, s):
        s.save(user=self.request.user)


class StaffViewSet(viewsets.ModelViewSet):
    """Super-admin only: create/disable store admins, delivery agents, support agents."""
    permission_classes = [IsSuperAdmin]
    queryset = User.objects.exclude(role=Role.CUSTOMER).order_by("-date_joined")
    http_method_names = ["get", "post", "patch"]

    def get_serializer_class(self):
        return StaffCreateSerializer if self.action == "create" else UserSerializer

    def perform_create(self, s):
        u = s.save()
        audit(self.request, "staff.create", u, role=u.role)

    @staticmethod
    def _toggle(request, pk, active):
        u = User.objects.exclude(role=Role.CUSTOMER).get(pk=pk)
        if u.role == Role.SUPER_ADMIN and u.pk != request.user.pk:
            return Response(
                {"detail": "Cannot modify another super administrator."},
                status=403,
            )
        u.is_active = active
        u.save(update_fields=["is_active"])
        audit(request, "staff.enable" if active else "staff.disable", u)
        return Response(UserSerializer(u).data)

    from rest_framework.decorators import action as _action

    @_action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        return self._toggle(request, pk, False)

    @_action(detail=True, methods=["post"])
    def enable(self, request, pk=None):
        return self._toggle(request, pk, True)


class CustomerListView(generics.ListAPIView):
    permission_classes = [IsStoreStaff]
    serializer_class = UserSerializer
    queryset = User.objects.filter(role=Role.CUSTOMER).order_by("-date_joined")


class AuditLogView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]

    def get_serializer_class(self):
        from rest_framework import serializers

        class S(serializers.ModelSerializer):
            actor_email = serializers.EmailField(source="actor.email", default=None)

            class Meta:
                model = AuditLog
                fields = "__all__"

        return S

    queryset = AuditLog.objects.select_related("actor")
