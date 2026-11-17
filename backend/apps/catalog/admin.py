from django.contrib import admin
from .models import Brand, Category, Product, ProductImage, ProductSpecification, ProductVariant, StockMovement
for m in (Brand, Category, Product, ProductImage, ProductSpecification, ProductVariant, StockMovement):
    admin.site.register(m)
