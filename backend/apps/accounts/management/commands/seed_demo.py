from django.core.management.base import BaseCommand
from apps.catalog.models import Brand, Category, Product

CATS = ["Phones and electronics", "Computers and accessories", "Fashion", "Shoes", "Watches", "Beauty and personal care",
        "Home and kitchen", "Furniture", "Groceries", "Sports and outdoor", "Baby products", "Books and stationery",
        "Automotive accessories", "Other general merchandise"]


class Command(BaseCommand):
    help = "Create the 14 required categories and a few sample products (development only)."

    def handle(self, *a, **kw):
        cats = {n: Category.objects.get_or_create(name=n)[0] for n in CATS}
        b = Brand.objects.get_or_create(name="Sample Brand")[0]
        samples = [("Wireless Earbuds", "Phones and electronics", 1850000, 25), ("Laptop Backpack", "Computers and accessories", 1200000, 40),
                   ("Cotton T-Shirt", "Fashion", 450000, 100), ("Running Shoes", "Shoes", 2500000, 30), ("Blender 1.5L", "Home and kitchen", 3200000, 15)]
        for i, (n, c, price, stock) in enumerate(samples, 1):
            Product.objects.get_or_create(sku=f"DEMO-{i:03}", defaults=dict(name=n, category=cats[c], brand=b, regular_price=price,
                                          stock_quantity=stock, short_description="Sample product", is_featured=i < 4))
        self.stdout.write(self.style.SUCCESS("Seeded categories and sample products."))
