from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import Address, Role, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "role", "country", "date_joined", "is_active"]
        read_only_fields = ["id", "email", "role", "date_joined", "is_active"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name", "phone"]

    def validate_email(self, v):
        v = v.lower()
        if User.objects.filter(email__iexact=v).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return v

    def validate_password(self, v):
        validate_password(v)
        return v

    def create(self, data):
        # Public registration ALWAYS creates a customer; role can never be supplied by the client.
        return User.objects.create_user(role=Role.CUSTOMER, **data)


class StaffCreateSerializer(RegisterSerializer):
    role = serializers.ChoiceField(choices=Role.choices)

    class Meta(RegisterSerializer.Meta):
        fields = RegisterSerializer.Meta.fields + ["role"]

    def create(self, data):
        return User.objects.create_user(**data)


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        exclude = ["user"]
