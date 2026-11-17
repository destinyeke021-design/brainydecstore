from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def save(self, *a, **kw):
        self.slug = self.slug or slugify(self.name)
        super().save(*a, **kw)

    def __str__(self):
        return self.name


class Brand(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)

    def save(self, *a, **kw):
        self.slug = self.slug or slugify(self.name)
        super().save(*a, **kw)

    def __str__(self):
        return self.name


class ProductStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    DISABLED = "disabled", "Disabled"
    ARCHIVED = "archived", "Archived"


class Product(models.Model):
    """All money fields are integer minor units (kobo for NGN)."""
    name = models.CharField(max_length=255, db_index=True)
    slug = models.SlugField(max_length=280, unique=True, blank=True)
    sku = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    short_description = models.CharField(max_length=300, blank=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(Brand, null=True, blank=True, on_delete=models.SET_NULL, related_name="products")
    currency = models.CharField(max_length=3, default="NGN")
    regular_price = models.BigIntegerField(validators=[MinValueValidator(0)])
    discounted_price = models.BigIntegerField(null=True, blank=True, validators=[MinValueValidator(0)])
    stock_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    status = models.CharField(max_length=10, choices=ProductStatus.choices, default=ProductStatus.ACTIVE, db_index=True)
    is_featured = models.BooleanField(default=False)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    review_count = models.PositiveIntegerField(default=0)
    sales_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(check=models.Q(regular_price__gte=0), name="product_price_nonneg"),
            models.CheckConstraint(
                check=models.Q(discounted_price__isnull=True) | models.Q(discounted_price__lte=models.F("regular_price")),
                name="product_discount_lte_regular"),
        ]

    def save(self, *a, **kw):
        if not self.slug:
            base, n = slugify(self.name)[:250] or "product", 1
            slug = base
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f"{base}-{n}"
            self.slug = slug
        super().save(*a, **kw)

    def active_flash_sale(self, now=None):
        now = now or timezone.now()
        return self.flash_sales.filter(is_active=True, starts_at__lte=now, ends_at__gt=now).order_by("sale_price").first()

    def current_price(self, now=None):
        """Backend-authoritative price: flash sale > discounted price > regular price."""
        fs = self.active_flash_sale(now)
        candidates = [self.regular_price]
        if self.discounted_price is not None:
            candidates.append(self.discounted_price)
        if fs and (fs.quota is None or fs.sold < fs.quota):
            candidates.append(fs.sale_price)
        return min(candidates)

    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_threshold

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/")
    alt_text = models.CharField(max_length=200, blank=True)
    is_primary = models.BooleanField(default=False)

    def save(self, *a, **kw):
        super().save(*a, **kw)
        if self.is_primary:
            ProductImage.objects.filter(product=self.product).exclude(pk=self.pk).update(is_primary=False)


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=64, unique=True)
    color = models.CharField(max_length=50, blank=True)
    size = models.CharField(max_length=50, blank=True)
    price_override = models.BigIntegerField(null=True, blank=True)
    stock_quantity = models.PositiveIntegerField(default=0)


class ProductSpecification(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="specifications")
    name = models.CharField(max_length=100)
    value = models.CharField(max_length=255)


class StockMovement(models.Model):
    class Kind(models.TextChoices):
        RESTOCK = "restock", "Restock"
        SALE = "sale", "Sale / reservation"
        RELEASE = "release", "Released (cancel/fail)"
        ADJUST = "adjust", "Manual adjustment"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="movements")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    quantity = models.IntegerField()  # signed delta
    balance_after = models.IntegerField()
    reference = models.CharField(max_length=64, blank=True)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


def change_stock(product_id, delta, kind, reference="", note="", user=None):
    """Concurrency-safe stock change. MUST be called inside transaction.atomic()."""
    p = Product.objects.select_for_update().get(pk=product_id)
    new = p.stock_quantity + delta
    if new < 0:
        raise ValueError(f"Insufficient stock for {p.name}")
    p.stock_quantity = new
    p.save(update_fields=["stock_quantity", "updated_at"])
    StockMovement.objects.create(product=p, kind=kind, quantity=delta, balance_after=new,
                                 reference=reference, note=note, created_by=user)
    return p
