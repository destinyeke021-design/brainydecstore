from datetime import timedelta
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role, User
from apps.accounts.permissions import IsStoreStaff
from apps.catalog.models import Product, ProductStatus
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.payments.models import Payment, Refund

REVENUE_STATUSES = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.READY_FOR_DISPATCH, OrderStatus.SHIPPED,
                    OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED]


class DashboardView(APIView):
    permission_classes = [IsStoreStaff]

    def get(self, request):
        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month = today.replace(day=1)
        rev = Order.objects.filter(status__in=REVENUE_STATUSES)
        s = lambda qs: qs.aggregate(t=Sum("total"))["t"] or 0
        last30 = rev.filter(created_at__gte=now - timedelta(days=30))
        return Response({
            "total_sales": s(rev), "today_sales": s(rev.filter(created_at__gte=today)), "monthly_sales": s(rev.filter(created_at__gte=month)),
            "total_orders": Order.objects.count(),
            "pending_orders": Order.objects.filter(status__in=[OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_VERIFICATION, OrderStatus.CONFIRMED, OrderStatus.PROCESSING]).count(),
            "completed_orders": Order.objects.filter(status=OrderStatus.DELIVERED).count(),
            "cancelled_orders": Order.objects.filter(status=OrderStatus.CANCELLED).count(),
            "total_customers": User.objects.filter(role=Role.CUSTOMER).count(),
            "new_customers": User.objects.filter(role=Role.CUSTOMER, date_joined__gte=now - timedelta(days=30)).count(),
            "total_products": Product.objects.exclude(status=ProductStatus.ARCHIVED).count(),
            "low_stock_products": Product.objects.filter(stock_quantity__gt=0).extra(where=["stock_quantity <= low_stock_threshold"]).count(),
            "out_of_stock_products": Product.objects.filter(stock_quantity=0).exclude(status=ProductStatus.ARCHIVED).count(),
            "pending_payments": Payment.objects.filter(status__in=["pending", "awaiting_verification"]).count(),
            "refund_requests": Refund.objects.filter(status="requested").count(),
            "sales_over_time": list(last30.annotate(d=TruncDate("created_at")).values("d").annotate(total=Sum("total"), orders=Count("id")).order_by("d")),
            "best_sellers": list(OrderItem.objects.filter(order__status__in=REVENUE_STATUSES).values("name").annotate(units=Sum("quantity")).order_by("-units")[:10]),
            "category_performance": list(OrderItem.objects.filter(order__status__in=REVENUE_STATUSES).values(category=__import__("django.db.models", fromlist=["F"]).F("product__category__name")).annotate(units=Sum("quantity")).order_by("-units")),
            "payment_methods": list(Order.objects.filter(status__in=REVENUE_STATUSES).values("payment_method").annotate(count=Count("id"))),
        })
