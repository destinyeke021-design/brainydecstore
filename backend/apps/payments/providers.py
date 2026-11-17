"""Gateway clients. Amounts exposed to the rest of the app are ALWAYS integer minor units."""
import hashlib
import hmac
from decimal import Decimal

import requests
from django.conf import settings

TIMEOUT = 20


class ProviderNotConfigured(Exception):
    pass


class ProviderError(Exception):
    pass


class Paystack:
    name = "paystack"
    base = "https://api.paystack.co"

    @property
    def key(self):
        if not settings.PAYSTACK_SECRET_KEY:
            raise ProviderNotConfigured("Paystack is not configured (PAYSTACK_SECRET_KEY missing).")
        return settings.PAYSTACK_SECRET_KEY

    def _h(self):
        return {"Authorization": f"Bearer {self.key}"}

    def initialize(self, email, amount, reference, currency, callback_url):
        r = requests.post(f"{self.base}/transaction/initialize", headers=self._h(), timeout=TIMEOUT,
                          json={"email": email, "amount": amount, "reference": reference, "currency": currency,
                                "callback_url": callback_url})
        d = r.json()
        if not r.ok or not d.get("status"):
            raise ProviderError(d.get("message", "Paystack initialization failed"))
        return {"checkout_url": d["data"]["authorization_url"], "access_code": d["data"].get("access_code")}

    def verify(self, reference):
        r = requests.get(f"{self.base}/transaction/verify/{reference}", headers=self._h(), timeout=TIMEOUT)
        d = r.json()
        if not r.ok or not d.get("status"):
            raise ProviderError(d.get("message", "Paystack verification failed"))
        t = d["data"]
        return {"success": t.get("status") == "success", "amount": int(t["amount"]), "currency": t.get("currency", "NGN"),
                "reference": t.get("reference", reference), "raw": t}

    def valid_signature(self, body: bytes, signature: str) -> bool:
        expected = hmac.new(self.key.encode(), body, hashlib.sha512).hexdigest()
        return bool(signature) and hmac.compare_digest(expected, signature)


class Flutterwave:
    name = "flutterwave"
    base = "https://api.flutterwave.com/v3"

    @property
    def key(self):
        if not settings.FLUTTERWAVE_SECRET_KEY:
            raise ProviderNotConfigured("Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY missing).")
        return settings.FLUTTERWAVE_SECRET_KEY

    def _h(self):
        return {"Authorization": f"Bearer {self.key}"}

    def initialize(self, email, amount, reference, currency, callback_url):
        major = (Decimal(amount) / 100).quantize(Decimal("0.01"))  # Flutterwave takes major units
        r = requests.post(f"{self.base}/payments", headers=self._h(), timeout=TIMEOUT,
                          json={"tx_ref": reference, "amount": str(major), "currency": currency, "redirect_url": callback_url,
                                "customer": {"email": email}})
        d = r.json()
        if not r.ok or d.get("status") != "success":
            raise ProviderError(d.get("message", "Flutterwave initialization failed"))
        return {"checkout_url": d["data"]["link"]}

    def verify(self, reference):
        r = requests.get(f"{self.base}/transactions/verify_by_reference", params={"tx_ref": reference},
                         headers=self._h(), timeout=TIMEOUT)
        d = r.json()
        if not r.ok or d.get("status") != "success":
            raise ProviderError(d.get("message", "Flutterwave verification failed"))
        t = d["data"]
        return {"success": t.get("status") == "successful", "amount": int((Decimal(str(t["amount"])) * 100).to_integral_value()),
                "currency": t.get("currency", "NGN"), "reference": t.get("tx_ref", reference), "raw": t}

    def valid_signature(self, body: bytes, signature: str) -> bool:
        secret = settings.FLUTTERWAVE_SECRET_HASH
        return bool(secret) and bool(signature) and hmac.compare_digest(secret, signature)


GATEWAYS = {"paystack": Paystack, "flutterwave": Flutterwave}


def get_gateway(name):
    return GATEWAYS[name]()
