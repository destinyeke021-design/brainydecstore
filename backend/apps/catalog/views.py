import csv
import io
from django.db import transaction
from django.db.models import F, Q
from django.http import HttpResponse
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import audit
from apps.accounts.permissions import IsStoreStaff, ReadOnlyOrStoreStaff
from .models import Brand, Category, Product, ProductImage, ProductSpecification, ProductStatus, ProductVariant, StockMovement, change_stock
from .serializers import (BrandSerializer, CategorySerializer, ProductImageSerializer, ProductSerializer,
                          PublicProductSerializer, SpecSerializer, StockMovementSerializer, VariantSerializer)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [ReadOnlyOrStoreStaff]
    pagination_class = None


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [ReadOnlyOrStoreStaff]
    pagination_class = None


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [ReadOnlyOrStoreStaff]
    lookup_field = "slug"
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        u = self.request.user
        return ProductSerializer if (u.is_authenticated and u.is_store_staff) else PublicProductSerializer

    def get_queryset(self):
        qs = Product.objects.select_related("category", "brand").prefetch_related("images", "variants", "specifications")
        u = self.request.user
        if not (u.is_authenticated and u.is_store_staff):
            qs = qs.filter(status=ProductStatus.ACTIVE, category__is_active=True)
        p = self.request.query_params
        if q := p.get("search"):
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(short_description__icontains=q)
                           | Q(category__name__icontains=q) | Q(brand__name__icontains=q) | Q(sku__iexact=q))
        if c := p.get("category"):
            qs = qs.filter(Q(category__slug=c) | Q(category__parent__slug=c))
        if b := p.get("brand"):
            qs = qs.filter(brand__slug=b)
        if v := p.get("min_price"):
            qs = qs.filter(regular_price__gte=int(v) if v.isdigit() else 0)
        if v := p.get("max_price"):
            if v.isdigit():
                qs = qs.filter(regular_price__lte=int(v))
        if v := p.get("min_rating"):
            try:
                qs = qs.filter(rating_avg__gte=float(v))
            except ValueError:
                pass
        if p.get("in_stock") in ("1", "true"):
            qs = qs.filter(stock_quantity__gt=0)
        if p.get("on_sale") in ("1", "true"):
            qs = qs.filter(discounted_price__isnull=False, discounted_price__lt=F("regular_price"))
        if p.get("featured") in ("1", "true"):
            qs = qs.filter(is_featured=True)
        sort = {"price_asc": "regular_price", "price_desc": "-regular_price", "newest": "-created_at",
                "popular": "-sales_count", "rating": "-rating_avg"}.get(p.get("sort", ""))
        if sort:
            qs = qs.order_by(sort, "-id")
        elif p.get("search"):
            qs = qs.order_by("-sales_count", "-rating_avg")  # relevance proxy
        return qs

    def perform_create(self, s):
        obj = s.save()
        audit(self.request, "product.create", obj)

    def perform_update(self, s):
        obj = s.save()
        audit(self.request, "product.update", obj)

    def destroy(self, request, *a, **kw):
        # Products referenced by orders must never be hard-deleted; archive instead.
        obj = self.get_object()
        obj.status = ProductStatus.ARCHIVED
        obj.save(update_fields=["status", "updated_at"])
        audit(request, "product.archive", obj)
        return Response(status=204)

    @action(detail=True, methods=["post"], permission_classes=[IsStoreStaff], parser_classes=[MultiPartParser])
    def images(self, request, slug=None):
        product = self.get_object()
        f = request.FILES.get("image")
        if not f:
            return Response({"image": "Required."}, status=400)
        if f.content_type not in ALLOWED_IMAGE_TYPES or f.size > MAX_IMAGE_BYTES:
            return Response({"image": "Only JPEG/PNG/WEBP up to 5MB are allowed."}, status=400)
        try:
            from PIL import Image
            Image.open(f).verify()  # content check, not just header
            f.seek(0)
        except Exception:
            return Response({"image": "Invalid image file."}, status=400)
        img = ProductImage.objects.create(product=product, image=f, alt_text=request.data.get("alt_text", ""),
                                          is_primary=request.data.get("is_primary") in ("1", "true", True)
                                          or not product.images.exists())
        return Response(ProductImageSerializer(img, context={"request": request}).data, status=201)

    @action(detail=True, methods=["post"], permission_classes=[IsStoreStaff], url_path="images/(?P<image_id>[0-9]+)/primary")
    def set_primary(self, request, slug=None, image_id=None):
        product = self.get_object()
        img = product.images.get(pk=image_id)
        img.is_primary = True
        img.save()
        return Response({"ok": True})

    @action(detail=True, methods=["post"], permission_classes=[IsStoreStaff])
    def variants(self, request, slug=None):
        s = VariantSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(product=self.get_object())
        return Response(s.data, status=201)

    @action(detail=True, methods=["post"], permission_classes=[IsStoreStaff])
    def specifications(self, request, slug=None):
        s = SpecSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(product=self.get_object())
        return Response(s.data, status=201)

    @action(detail=True, methods=["post"], permission_classes=[IsStoreStaff])
    def adjust_stock(self, request, slug=None):
        product = self.get_object()
        try:
            delta = int(request.data.get("quantity"))
        except (TypeError, ValueError):
            return Response({"quantity": "Integer required."}, status=400)
        with transaction.atomic():
            try:
                p = change_stock(product.pk, delta, StockMovement.Kind.RESTOCK if delta > 0 else StockMovement.Kind.ADJUST,
                                 note=request.data.get("note", ""), user=request.user)
            except ValueError as e:
                return Response({"detail": str(e)}, status=400)
        audit(request, "stock.adjust", p, delta=delta)
        return Response({"stock_quantity": p.stock_quantity})

    @action(detail=False, methods=["get"], permission_classes=[IsStoreStaff])
    def low_stock(self, request):
        qs = Product.objects.filter(stock_quantity__lte=F("low_stock_threshold")).exclude(status=ProductStatus.ARCHIVED)
        return Response(ProductSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=False, methods=["get"], permission_classes=[IsStoreStaff], url_path="export")
    def export(self, request):
        resp = HttpResponse(content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="products.csv"'
        w = csv.writer(resp)
        w.writerow(["sku", "name", "category", "brand", "regular_price", "discounted_price", "stock_quantity", "status"])
        for p in Product.objects.select_related("category", "brand"):
            w.writerow([p.sku, p.name, p.category.name, p.brand.name if p.brand else "", p.regular_price,
                        p.discounted_price or "", p.stock_quantity, p.status])
        return resp

    @action(detail=False, methods=["post"], permission_classes=[IsStoreStaff], parser_classes=[MultiPartParser], url_path="import")
    def import_file(self, request):
        """CSV or XLSX import. Columns: sku,name,category,brand,regular_price,discounted_price,stock_quantity,description"""
        f = request.FILES.get("file")
        if not f:
            return Response({"file": "Required."}, status=400)
        rows = []
        if f.name.lower().endswith(".xlsx"):
            import openpyxl
            ws = openpyxl.load_workbook(f, read_only=True).active
            it = ws.iter_rows(values_only=True)
            head = [str(h).strip().lower() for h in next(it)]
            rows = [dict(zip(head, r)) for r in it]
        else:
            rows = list(csv.DictReader(io.StringIO(f.read().decode("utf-8-sig"))))
        created = updated = 0
        errors = []
        with transaction.atomic():
            for i, r in enumerate(rows, start=2):
                try:
                    cat, _ = Category.objects.get_or_create(name=str(r["category"]).strip())
                    brand = Brand.objects.get_or_create(name=str(r["brand"]).strip())[0] if r.get("brand") else None
                    disc = r.get("discounted_price")
                    defaults = dict(name=str(r["name"]).strip(), category=cat, brand=brand,
                                    regular_price=int(r["regular_price"]),
                                    discounted_price=int(disc) if disc not in (None, "") else None,
                                    stock_quantity=int(r.get("stock_quantity") or 0),
                                    description=str(r.get("description") or ""))
                    _, was_created = Product.objects.update_or_create(sku=str(r["sku"]).strip(), defaults=defaults)
                    created += was_created
                    updated += not was_created
                except Exception as e:
                    errors.append({"row": i, "error": str(e)})
            if errors:
                transaction.set_rollback(True)
                return Response({"created": 0, "updated": 0, "errors": errors}, status=400)
        audit(request, "product.import", None, created=created, updated=updated)
        return Response({"created": created, "updated": updated, "errors": []})


class StockMovementList(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsStoreStaff]
    serializer_class = StockMovementSerializer
    queryset = StockMovement.objects.select_related("product")
