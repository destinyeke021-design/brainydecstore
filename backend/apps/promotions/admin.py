
from django.contrib import admin
from .models import (
    Banner,
    Bundle,
    Coupon,
    CouponRedemption,
    FlashSale,
    SponsoredAd,
)


@admin.register(SponsoredAd)
class SponsoredAdAdmin(admin.ModelAdmin):
    list_display = (
        "advertiser_name",
        "title",
        "price",
        "payment_status",
        "approval_status",
        "is_active",
        "starts_at",
        "ends_at",
    )

    list_filter = (
        "payment_status",
        "approval_status",
        "placement",
        "is_active",
    )

    search_fields = (
        "advertiser_name",
        "contact_name",
        "contact_email",
        "contact_phone",
        "title",
    )

    readonly_fields = ("created_at", "updated_at", "paid_at")

    fieldsets = (
        ("Advertiser details", {
            "fields": (
                "advertiser_name",
                "contact_name",
                "contact_email",
                "contact_phone",
            )
        }),
        ("Advertisement content", {
            "fields": (
                "title",
                "description",
                "image",
                "destination_url",
                "placement",
            )
        }),
        ("Payment", {
            "fields": (
                "price",
                "payment_status",
                "payment_reference",
                "paid_at",
            )
        }),
        ("Approval and scheduling", {
            "fields": (
                "approval_status",
                "admin_notes",
                "starts_at",
                "ends_at",
                "is_active",
            )
        }),
        ("Record information", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


for model in (Banner, Bundle, Coupon, CouponRedemption, FlashSale):
    admin.site.register(model)
