import hashlib, hmac, json
from datetime import timedelta
from unittest import mock

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import Address, Role, User
from apps.catalog.models import Brand, Category, Product
from apps.orders.models import Order
from apps.payments import wallet as W
from apps.payments.models import Payment, PaymentWebhookEvent, Wallet
from apps.promotions.models import Coupon, FlashSale


def mk_user(email, role=Role.CUSTOMER, **kw):
    return User.objects.create_user(email=email, password="Str0ng!Pass#1", role=role, **kw)


class Base(APITestCase):
    def setUp(self):
        self.cat = Category.objects.create(name="Phones")
        self.p = Product.objects.create(name="Phone X", sku="PX1", category=self.cat, regular_price=5_000_000, stock_quantity=5)
        self.super = mk_user("super@t.com", Role.SUPER_ADMIN)
        self.admin = mk_user("admin@t.com", Role.STORE_ADMIN)
        self.cust = mk_user("c1@t.com", phone="08000000001")
        self.cust2 = mk_user("c2@t.com")
        self.agent = mk_user("agent@t.com", Role.DELIVERY_AGENT)
        self.support = mk_user("support@t.com", Role.SUPPORT_AGENT)
        self.addr = Address.objects.create(user=self.cust, full_name="A B", phone="0800", line1="1 Road", city="Ibadan", state="Oyo")

    def as_(self, user):
        self.client.force_authenticate(user)
        return self.client

    def add_to_cart(self, user, qty=1, product=None):
        return self.as_(user).post("/api/cart/items/", {"product": (product or self.p).pk, "quantity": qty}, format="json")

    def checkout(self, user=None, method="wallet", **kw):
        return self.as_(user or self.cust).post("/api/checkout/", {"address_id": self.addr.pk, "payment_method": method, **kw}, format="json")

    def fund(self, user, amount):
        W.credit(user, amount, f"test-{user.pk}-{amount}-{timezone.now().timestamp()}")


class AuthTests(Base):
    def test_register_login_and_role_cannot_be_escalated(self):
        r = self.client.post("/api/auth/register/", {"email": "new@t.com", "password": "Str0ng!Pass#1", "role": "super_admin"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.get(email="new@t.com").role, Role.CUSTOMER)
        r = self.client.post("/api/auth/login/", {"email": "new@t.com", "password": "Str0ng!Pass#1"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)

    def test_weak_password_rejected(self):
        r = self.client.post("/api/auth/register/", {"email": "w@t.com", "password": "123"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_only_super_admin_manages_staff(self):
        self.assertEqual(self.as_(self.admin).get("/api/auth/staff/").status_code, 403)
        self.assertEqual(self.as_(self.cust).get("/api/auth/staff/").status_code, 403)
        self.assertEqual(self.as_(self.super).get("/api/auth/staff/").status_code, 200)
        r = self.as_(self.super).post("/api/auth/staff/", {"email": "s2@t.com", "password": "Str0ng!Pass#1", "role": "support_agent"}, format="json")
        self.assertEqual(r.status_code, 201)

    def test_store_admin_cannot_view_audit_logs_or_settings(self):
        self.assertEqual(self.as_(self.admin).get("/api/auth/audit-logs/").status_code, 403)
        self.assertEqual(self.as_(self.admin).get("/api/settings/").status_code, 403)
        self.assertEqual(self.as_(self.super).get("/api/settings/").status_code, 200)

    def test_unauthenticated_blocked(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/orders/").status_code, 401)


class CatalogTests(Base):
    def test_customer_cannot_create_product(self):
        r = self.as_(self.cust).post("/api/products/", {"name": "x"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_admin_crud_and_archive(self):
        c = self.as_(self.admin)
        r = c.post("/api/products/", {"name": "Shoe", "sku": "S1", "category": self.cat.pk, "regular_price": 100000, "stock_quantity": 3}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        slug = r.data["slug"]
        self.assertEqual(c.delete(f"/api/products/{slug}/").status_code, 204)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/products/{slug}/").status_code, 404)  # archived is hidden publicly

    def test_discount_cannot_exceed_regular(self):
        r = self.as_(self.admin).post("/api/products/", {"name": "Bad", "sku": "B1", "category": self.cat.pk, "regular_price": 100, "discounted_price": 200}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_search_filter_sort(self):
        Product.objects.create(name="Cheap Case", sku="C1", category=self.cat, regular_price=10000, stock_quantity=1)
        self.client.force_authenticate(None)
        r = self.client.get("/api/products/?search=case")
        self.assertEqual(r.data["count"], 1)
        r = self.client.get("/api/products/?sort=price_asc")
        self.assertEqual(r.data["results"][0]["sku"] if "sku" in r.data["results"][0] else r.data["results"][0]["name"] , "Cheap Case") if False else None
        self.assertEqual(r.data["results"][0]["name"], "Cheap Case")
        self.assertEqual(self.client.get("/api/products/?max_price=20000").data["count"], 1)

    def test_public_serializer_hides_sku(self):
        self.client.force_authenticate(None)
        r = self.client.get("/api/products/")
        self.assertNotIn("sku", r.data["results"][0])


class CartTests(Base):
    def test_stock_validation(self):
        self.assertEqual(self.add_to_cart(self.cust, 6).status_code, 400)
        self.assertEqual(self.add_to_cart(self.cust, 2).status_code, 200)
        r = self.client.get("/api/cart/")
        self.assertEqual(r.data["subtotal"], 10_000_000)

    def test_guest_cart_merges_after_login(self):
        self.client.force_authenticate(None)
        r = self.client.post("/api/cart/items/", {"product": self.p.pk, "quantity": 2}, format="json")
        token = r["X-Guest-Cart"]
        self.client.force_authenticate(self.cust)
        r = self.client.get("/api/cart/", HTTP_X_GUEST_CART=token)
        self.assertEqual(len(r.data["items"]), 1)

    def test_wishlist(self):
        c = self.as_(self.cust)
        c.post("/api/wishlist/", {"product": self.p.pk}, format="json")
        self.assertEqual(len(c.get("/api/wishlist/").data), 1)
        c.post("/api/wishlist/move-to-cart/", {"product": self.p.pk}, format="json")
        self.assertEqual(len(c.get("/api/wishlist/").data), 0)
        self.assertEqual(len(c.get("/api/cart/").data["items"]), 1)


class CheckoutTests(Base):
    def test_wallet_checkout_end_to_end_with_stock_and_delivery_and_review(self):
        self.fund(self.cust, 20_000_000)
        self.add_to_cart(self.cust, 2)
        r = self.checkout(method="wallet")
        self.assertEqual(r.status_code, 201, r.data)
        order = Order.objects.get()
        self.assertEqual(order.status, "confirmed")
        self.assertTrue(order.is_paid)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock_quantity, 3)
        self.assertEqual(Wallet.objects.get(user=self.cust).balance, 20_000_000 - order.total)
        # admin: process -> ready for dispatch, assign agent
        a = self.as_(self.admin)
        for st in ("processing", "ready_for_dispatch"):
            self.assertEqual(a.post(f"/api/orders/{order.number}/set_status/", {"status": st}, format="json").status_code, 200)
        d = order.delivery
        self.assertEqual(a.post(f"/api/deliveries/{d.pk}/assign/", {"agent": self.agent.pk}, format="json").status_code, 200)
        g = self.as_(self.agent)
        mine = g.get("/api/my-deliveries/").data
        self.assertEqual(len(mine), 1)
        self.assertNotIn("email", json.dumps(mine))
        for st in ("picked_up", "out_for_delivery", "delivered"):
            self.assertEqual(g.post(f"/api/my-deliveries/{d.pk}/status/", {"status": st}, format="json").status_code, 200, st)
        order.refresh_from_db()
        self.assertEqual(order.status, "delivered")
        # verified review
        r = self.as_(self.cust).post("/api/reviews/", {"product": self.p.pk, "rating": 5, "comment": "Great"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["is_verified_purchase"])
        self.p.refresh_from_db()
        self.assertEqual(float(self.p.rating_avg), 5.0)
        # order history only for the owner
        self.assertEqual(len(self.as_(self.cust).get("/api/orders/").data["results"]), 1)
        self.assertEqual(self.as_(self.cust2).get(f"/api/orders/{order.number}/").status_code, 404)

    def test_insufficient_stock_and_no_negative(self):
        self.add_to_cart(self.cust, 5)
        self.p.stock_quantity = 2
        self.p.save()
        r = self.checkout(method="cod")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["code"], "insufficient_stock")
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock_quantity, 2)

    def test_no_oversell_across_two_customers(self):
        self.p.stock_quantity = 1
        self.p.save()
        Address.objects.create(user=self.cust2, full_name="Z", phone="1", line1="x", city="y", state="Oyo")
        self.add_to_cart(self.cust, 1)
        self.add_to_cart(self.cust2, 1)
        r1 = self.checkout(self.cust, "cod")
        a2 = Address.objects.get(user=self.cust2)
        r2 = self.as_(self.cust2).post("/api/checkout/", {"address_id": a2.pk, "payment_method": "cod"}, format="json")
        self.assertEqual({r1.status_code, r2.status_code}, {201, 400})
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock_quantity, 0)

    def test_wallet_overdraft_rejected_and_rolled_back(self):
        self.add_to_cart(self.cust, 1)
        r = self.checkout(method="wallet")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock_quantity, 5)

    def test_idempotent_checkout(self):
        self.fund(self.cust, 50_000_000)
        self.add_to_cart(self.cust, 1)
        r1 = self.checkout(method="wallet", idempotency_key="k1")
        r2 = self.checkout(method="wallet", idempotency_key="k1")
        self.assertEqual(r1.data["number"], r2.data["number"])
        self.assertEqual(Order.objects.count(), 1)

    def test_invalid_coupon_and_valid_coupon(self):
        self.add_to_cart(self.cust, 1)
        self.assertEqual(self.checkout(method="cod", coupon_code="NOPE").status_code, 400)
        Coupon.objects.create(code="TEN", kind="percent", value=10)
        r = self.checkout(method="cod", coupon_code="ten")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["discount"], 500_000)
        # per-user limit
        self.add_to_cart(self.cust, 1)
        self.assertEqual(self.checkout(method="cod", coupon_code="TEN").status_code, 400)

    def test_expired_coupon(self):
        Coupon.objects.create(code="OLD", kind="fixed", value=100, ends_at=timezone.now() - timedelta(days=1))
        self.add_to_cart(self.cust, 1)
        self.assertEqual(self.checkout(method="cod", coupon_code="OLD").status_code, 400)

    def test_cod_rules(self):
        from apps.storeconfig.models import StoreSettings
        s = StoreSettings.load(); s.cod_max_amount = 1000; s.save()
        self.add_to_cart(self.cust, 1)
        self.assertEqual(self.checkout(method="cod").status_code, 400)

    def test_flash_sale_backend_enforced(self):
        now = timezone.now()
        FlashSale.objects.create(product=self.p, sale_price=3_000_000, starts_at=now - timedelta(hours=1), ends_at=now + timedelta(hours=1), quota=1)
        self.add_to_cart(self.cust, 1)
        r = self.checkout(method="cod")
        self.assertEqual(r.data["subtotal"], 3_000_000)
        # quota exhausted -> normal price
        self.add_to_cart(self.cust, 1)
        r = self.checkout(method="cod", coupon_code="")
        self.assertEqual(r.data["subtotal"], 5_000_000)

    def test_cancel_releases_stock_and_refunds_wallet(self):
        self.fund(self.cust, 20_000_000)
        self.add_to_cart(self.cust, 2)
        o = self.checkout(method="wallet").data
        before = Wallet.objects.get(user=self.cust).balance
        r = self.as_(self.cust).post(f"/api/orders/{o['number']}/cancel/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock_quantity, 5)
        self.assertEqual(Wallet.objects.get(user=self.cust).balance, before + o["total"])

    def test_refund_workflow(self):
        self.fund(self.cust, 20_000_000)
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="wallet").data
        r = self.as_(self.cust).post(f"/api/orders/{o['number']}/refund/", {"reason": "changed mind"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        rid = self.as_(self.admin).get("/api/refunds/").data[0]["id"]
        self.assertEqual(self.as_(self.cust).post(f"/api/refunds/{rid}/approve/").status_code, 403)
        self.assertEqual(self.as_(self.admin).post(f"/api/refunds/{rid}/approve/").status_code, 200)
        self.assertEqual(self.as_(self.admin).post(f"/api/refunds/{rid}/approve/").status_code, 400)  # no double refund
        self.assertEqual(Order.objects.get().status, "refunded")
        self.assertEqual(Wallet.objects.get(user=self.cust).balance, 20_000_000)

    def test_invalid_transition_rejected(self):
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="cod").data
        r = self.as_(self.admin).post(f"/api/orders/{o['number']}/set_status/", {"status": "delivered"}, format="json")
        self.assertEqual(r.status_code, 400)


class WalletTests(Base):
    def test_credit_idempotent_and_overdraft(self):
        W.credit(self.cust, 1000, "ref-1")
        W.credit(self.cust, 1000, "ref-1")
        self.assertEqual(Wallet.objects.get(user=self.cust).balance, 1000)
        with self.assertRaises(W.InsufficientFunds):
            W.debit(self.cust, 5000, "d1")
        self.assertEqual(Wallet.objects.get(user=self.cust).balance, 1000)

    def test_wallet_only_for_customers_and_own(self):
        self.assertEqual(self.as_(self.agent).get("/api/wallet/").status_code, 403)
        self.assertEqual(self.as_(self.cust).get("/api/wallet/").status_code, 200)


@override_settings(PAYSTACK_SECRET_KEY="sk_test_x", FLUTTERWAVE_SECRET_KEY="FLWSECK_TEST", FLUTTERWAVE_SECRET_HASH="hash123")
class PaymentTests(Base):
    def _pending_gateway_order(self):
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="paystack").data
        self.assertEqual(o["status"], "pending_payment")
        with mock.patch("apps.payments.providers.requests.post") as post:
            post.return_value.ok = True
            post.return_value.json.return_value = {"status": True, "data": {"authorization_url": "https://pay/x", "access_code": "a"}}
            r = self.as_(self.cust).post("/api/payments/initialize/", {"order": o["number"], "provider": "paystack"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return o, r.data["reference"]

    def _sig(self, body):
        return hmac.new(b"sk_test_x", body, hashlib.sha512).hexdigest()

    def test_initialize_without_credentials_is_503(self):
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="paystack").data
        with override_settings(PAYSTACK_SECRET_KEY=""):
            r = self.as_(self.cust).post("/api/payments/initialize/", {"order": o["number"], "provider": "paystack"}, format="json")
        self.assertEqual(r.status_code, 503)

    def test_webhook_rejects_bad_signature(self):
        body = json.dumps({"event": "charge.success", "data": {"id": 1, "reference": "x"}}).encode()
        r = self.client.generic("POST", "/api/payments/webhook/paystack/", body, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE="bad")
        self.assertEqual(r.status_code, 401)

    def test_webhook_success_and_duplicate_events(self):
        o, ref = self._pending_gateway_order()
        body = json.dumps({"event": "charge.success", "data": {"id": 99, "reference": ref}}).encode()
        verified = {"success": True, "amount": o["total"], "currency": "NGN", "reference": ref, "raw": {}}
        with mock.patch("apps.payments.providers.Paystack.verify", return_value=verified):
            for _ in range(3):
                r = self.client.generic("POST", "/api/payments/webhook/paystack/", body, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE=self._sig(body))
                self.assertEqual(r.status_code, 200)
        self.assertEqual(Order.objects.get().status, "confirmed")
        self.assertEqual(PaymentWebhookEvent.objects.count(), 1)
        self.assertEqual(Payment.objects.get(reference=ref).status, "success")

    def test_amount_mismatch_never_fulfils(self):
        o, ref = self._pending_gateway_order()
        bad = {"success": True, "amount": 100, "currency": "NGN", "reference": ref, "raw": {}}
        with mock.patch("apps.payments.providers.Paystack.verify", return_value=bad):
            r = self.as_(self.cust).get(f"/api/payments/verify/?reference={ref}")
        self.assertEqual(r.data["status"], "mismatch")
        self.assertEqual(Order.objects.get().status, "pending_payment")

    def test_failed_payment_keeps_order_open(self):
        o, ref = self._pending_gateway_order()
        failed = {"success": False, "amount": o["total"], "currency": "NGN", "reference": ref, "raw": {"status": "failed"}}
        with mock.patch("apps.payments.providers.Paystack.verify", return_value=failed):
            r = self.as_(self.cust).get(f"/api/payments/verify/?reference={ref}")
        self.assertEqual(r.data["status"], "failed")
        self.assertEqual(Order.objects.get().status, "pending_payment")

    def test_wallet_funding_via_verified_payment_credits_once(self):
        with mock.patch("apps.payments.providers.requests.post") as post:
            post.return_value.ok = True
            post.return_value.json.return_value = {"status": True, "data": {"authorization_url": "https://pay/x"}}
            r = self.as_(self.cust).post("/api/wallet/fund/", {"amount": 500000, "provider": "paystack"}, format="json")
        ref = r.data["reference"]
        v = {"success": True, "amount": 500000, "currency": "NGN", "reference": ref, "raw": {}}
        with mock.patch("apps.payments.providers.Paystack.verify", return_value=v):
            for _ in range(3):
                self.as_(self.cust).get(f"/api/payments/verify/?reference={ref}")
        self.assertEqual(Wallet.objects.get(user=self.cust).balance, 500000)

    def test_flutterwave_webhook_signature(self):
        body = json.dumps({"event": "charge.completed", "data": {"id": 5, "tx_ref": "none"}}).encode()
        r = self.client.generic("POST", "/api/payments/webhook/flutterwave/", body, content_type="application/json", HTTP_VERIF_HASH="wrong")
        self.assertEqual(r.status_code, 401)
        r = self.client.generic("POST", "/api/payments/webhook/flutterwave/", body, content_type="application/json", HTTP_VERIF_HASH="hash123")
        self.assertEqual(r.status_code, 200)

    def test_bank_transfer_never_auto_paid_until_admin_verifies(self):
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="bank_transfer").data
        r = self.as_(self.cust).post("/api/payments/bank-transfer/", {"order": o["number"], "reference": "TRF123"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        order = Order.objects.get()
        self.assertEqual((order.status, order.is_paid), ("payment_verification", False))
        pid = Payment.objects.get(provider="bank_transfer").pk
        self.assertEqual(self.as_(self.cust).post(f"/api/payments/{pid}/verify-transfer/", {"approve": True}, format="json").status_code, 403)
        self.as_(self.admin).post(f"/api/payments/{pid}/verify-transfer/", {"approve": True}, format="json")
        order.refresh_from_db()
        self.assertEqual((order.status, order.is_paid), ("confirmed", True))

    def test_cod_collection_on_delivery(self):
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="cod").data
        a = self.as_(self.admin)
        for st in ("processing", "ready_for_dispatch"):
            a.post(f"/api/orders/{o['number']}/set_status/", {"status": st}, format="json")
        d = Order.objects.get().delivery
        a.post(f"/api/deliveries/{d.pk}/assign/", {"agent": self.agent.pk}, format="json")
        g = self.as_(self.agent)
        self.assertEqual(g.get("/api/my-deliveries/").data[0]["cod_amount_due"], o["total"])
        for st in ("picked_up", "delivered"):
            g.post(f"/api/my-deliveries/{d.pk}/status/", {"status": st}, format="json")
        self.assertTrue(Order.objects.get().is_paid)
        self.assertEqual(Payment.objects.get(provider="cod").status, "success")


class AccessTests(Base):
    def test_delivery_agent_cannot_see_others_or_orders(self):
        self.add_to_cart(self.cust, 1)
        self.checkout(method="cod")
        self.assertEqual(self.as_(self.agent).get("/api/my-deliveries/").data, [])
        self.assertEqual(len(self.as_(self.agent).get("/api/orders/").data["results"]), 0)
        self.assertEqual(self.as_(self.agent).get("/api/analytics/dashboard/").status_code, 403)

    def test_support_agent_sees_only_assigned_tickets(self):
        r = self.as_(self.cust).post("/api/tickets/", {"subject": "Help", "category": "order"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        tid = r.data["id"]
        self.assertEqual(len(self.as_(self.support).get("/api/tickets/").data["results"]), 0)
        self.as_(self.admin).post(f"/api/tickets/{tid}/assign/", {"agent": self.support.pk}, format="json")
        self.assertEqual(len(self.as_(self.support).get("/api/tickets/").data["results"]), 1)
        self.as_(self.support).post(f"/api/tickets/{tid}/reply/", {"body": "internal note", "internal": True}, format="json")
        msgs = self.as_(self.cust).get(f"/api/tickets/{tid}/").data["messages"]
        self.assertEqual(len(msgs), 0)  # internal notes hidden from customers
        self.assertEqual(self.as_(self.cust2).get(f"/api/tickets/{tid}/").status_code, 404)

    def test_dashboard_real_data(self):
        self.add_to_cart(self.cust, 1)
        self.checkout(method="cod")
        d = self.as_(self.admin).get("/api/analytics/dashboard/").data
        self.assertEqual(d["total_orders"], 1)
        self.assertEqual(d["total_customers"], 2)
        self.assertGreater(d["total_sales"], 0)

    def test_review_not_verified_without_purchase_and_invoice_pdf(self):
        r = self.as_(self.cust).post("/api/reviews/", {"product": self.p.pk, "rating": 4}, format="json")
        self.assertFalse(r.data["is_verified_purchase"])
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="cod").data
        pdf = self.as_(self.cust).get(f"/api/orders/{o['number']}/invoice/")
        self.assertEqual(pdf["Content-Type"], "application/pdf")
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        self.assertEqual(self.as_(self.cust2).get(f"/api/orders/{o['number']}/invoice/").status_code, 404)

    def test_import_export_products(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        csv_data = b"sku,name,category,brand,regular_price,discounted_price,stock_quantity,description\nIMP1,Imported,Phones,Acme,1000,,4,desc\n"
        r = self.as_(self.admin).post("/api/products/import/", {"file": SimpleUploadedFile("p.csv", csv_data)}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(Product.objects.filter(sku="IMP1").exists())
        self.assertIn(b"IMP1", self.as_(self.admin).get("/api/products/export/").content)


class HardeningTests(Base):
    def test_staff_cannot_set_money_states_manually(self):
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="cod").data
        for st in ("confirmed", "refunded", "refund_requested", "failed"):
            self.assertEqual(self.as_(self.admin).post(f"/api/orders/{o['number']}/set_status/", {"status": st}, format="json").status_code, 400)

    def test_staff_cancel_of_paid_order_refunds_wallet(self):
        self.fund(self.cust, 20_000_000)
        self.add_to_cart(self.cust, 1)
        o = self.checkout(method="wallet").data
        self.as_(self.admin).post(f"/api/orders/{o['number']}/set_status/", {"status": "cancelled"}, format="json")
        self.assertEqual(Wallet.objects.get(user=self.cust).balance, 20_000_000)

    def test_review_cannot_be_moved_or_duplicated(self):
        other = Product.objects.create(name="Other", sku="O1", category=self.cat, regular_price=100, stock_quantity=1)
        r = self.as_(self.cust).post("/api/reviews/", {"product": self.p.pk, "rating": 5}, format="json")
        self.assertEqual(self.as_(self.cust).post("/api/reviews/", {"product": self.p.pk, "rating": 1}, format="json").status_code, 400)
        self.as_(self.cust).patch(f"/api/reviews/{r.data['id']}/", {"product": other.pk, "rating": 3}, format="json")
        from apps.reviews.models import Review
        self.assertEqual(Review.objects.get(pk=r.data["id"]).product_id, self.p.pk)

    def test_agent_cannot_touch_unassigned_delivery(self):
        self.add_to_cart(self.cust, 1)
        self.checkout(method="cod")
        from apps.delivery.models import Delivery
        d = Delivery.objects.get()
        self.assertEqual(self.as_(self.agent).post(f"/api/my-deliveries/{d.pk}/status/", {"status": "delivered"}, format="json").status_code, 404)

    def test_customer_cannot_patch_ticket_and_proof_is_staff_only(self):
        t = self.as_(self.cust).post("/api/tickets/", {"subject": "s"}, format="json").data
        self.assertEqual(self.as_(self.cust).patch(f"/api/tickets/{t['id']}/", {"priority": "urgent"}, format="json").status_code, 405)
        self.assertEqual(self.as_(self.cust).get("/api/payments/1/proof/").status_code, 403)

    def test_password_reset_weak_password_is_400_not_500(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        r = self.client.post("/api/auth/password-reset/confirm/", {"uid": urlsafe_base64_encode(force_bytes(self.cust.pk)),
                             "token": default_token_generator.make_token(self.cust), "password": "123"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_logout_blacklists_refresh_token(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        rt = RefreshToken.for_user(self.cust)
        self.as_(self.cust).post("/api/auth/logout/", {"refresh": str(rt)}, format="json")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post("/api/auth/refresh/", {"refresh": str(rt)}, format="json").status_code, 401)
