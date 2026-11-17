from django.urls import path
from . import views
urlpatterns = [
    path("cart/", views.CartView.as_view()),
    path("cart/items/", views.CartItemView.as_view()),
    path("wishlist/", views.WishlistView.as_view()),
    path("wishlist/move-to-cart/", views.WishlistToCartView.as_view()),
]
