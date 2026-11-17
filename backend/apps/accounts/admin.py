from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Address, AuditLog, User

@admin.register(User)
class BDUserAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "role", "is_active")
    fieldsets = ((None, {"fields": ("email", "password")}), ("Profile", {"fields": ("first_name", "last_name", "phone", "role", "country")}),
                 ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}))
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "role", "password1", "password2")}),)

admin.site.register(Address)
admin.site.register(AuditLog)
