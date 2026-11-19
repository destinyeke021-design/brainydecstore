from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# BD Store admin branding
admin.site.site_header = "BD Store Administration"
admin.site.site_title = "BD Store Admin"
admin.site.index_title = "Store Management Dashboard"

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.cart.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.payments.urls")),
    path("api/", include("apps.delivery.urls")),
    path("api/", include("apps.promotions.urls")),
    path("api/", include("apps.reviews.urls")),
    path("api/", include("apps.support.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.storeconfig.urls")),
    path("api/", include("apps.analytics.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)