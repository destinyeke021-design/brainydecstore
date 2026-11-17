"""Common interface for logistics providers. Real providers (GIG, Kwik, DHL...) implement this class
and are registered below ONLY once credentials/API requirements are known; none are faked here."""
import secrets


class DeliveryProviderBase:
    code = "base"

    def quote(self, order): raise NotImplementedError
    def create_shipment(self, order): raise NotImplementedError
    def track(self, tracking_number): raise NotImplementedError
    def cancel(self, tracking_number): raise NotImplementedError


class ManualProvider(DeliveryProviderBase):
    """Platform-managed delivery with own agents."""
    code = "manual"

    def quote(self, order):
        return order.shipping_fee

    def create_shipment(self, order):
        return {"tracking_number": "BD-" + secrets.token_hex(4).upper()}

    def track(self, tracking_number):
        return {"supported": False}

    def cancel(self, tracking_number):
        return True


REGISTRY = {"manual": ManualProvider}


def get_provider(code):
    if code not in REGISTRY:
        raise ValueError(f"Delivery provider '{code}' is not integrated/configured.")
    return REGISTRY[code]()
