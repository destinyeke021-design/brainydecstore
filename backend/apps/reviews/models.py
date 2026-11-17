from django.db import models


class Review(models.Model):
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=120, blank=True)
    comment = models.TextField(blank=True)
    image = models.ImageField(upload_to="reviews/", blank=True)
    is_verified_purchase = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["product", "user"], name="one_review_per_user_product"),
            models.CheckConstraint(check=models.Q(rating__gte=1, rating__lte=5), name="review_rating_1_5"),
        ]


def recalc_rating(product):
    from django.db.models import Avg, Count
    agg = product.reviews.filter(is_approved=True).aggregate(a=Avg("rating"), c=Count("id"))
    product.rating_avg = round(agg["a"] or 0, 2)
    product.review_count = agg["c"]
    product.save(update_fields=["rating_avg", "review_count"])
