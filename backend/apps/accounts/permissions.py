from rest_framework.permissions import BasePermission
from .models import Role


def _role_perm(*roles):
    class _P(BasePermission):
        def has_permission(self, request, view):
            u = request.user
            return bool(u and u.is_authenticated and u.is_active and u.role in roles)
    return _P


IsSuperAdmin = _role_perm(Role.SUPER_ADMIN)
IsStoreStaff = _role_perm(Role.SUPER_ADMIN, Role.STORE_ADMIN)
IsCustomer = _role_perm(Role.CUSTOMER)
IsDeliveryAgent = _role_perm(Role.DELIVERY_AGENT)
IsSupportAgent = _role_perm(Role.SUPPORT_AGENT)
IsStoreStaffOrSupport = _role_perm(Role.SUPER_ADMIN, Role.STORE_ADMIN, Role.SUPPORT_AGENT)


class ReadOnlyOrStoreStaff(BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        u = request.user
        return bool(u and u.is_authenticated and u.is_store_staff)
