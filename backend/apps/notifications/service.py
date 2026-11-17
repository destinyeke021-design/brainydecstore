"""Notification dispatch: in-app + email + SMS. Providers are config-driven; failures never break business flows."""
import logging
from django.conf import settings
from django.core.mail import send_mail
from .models import Notification

log = logging.getLogger(__name__)


def send_sms(phone, text):
    provider = settings.SMS_PROVIDER
    if provider == "console":
        log.info("SMS to %s: %s", phone, text)  # swap for Termii/Twilio/etc. adapter via SMS_PROVIDER
        return True
    log.warning("SMS provider %s is not implemented; message not sent", provider)
    return False


def notify(user, title, body="", kind="order", email=True, sms=False):
    Notification.objects.create(user=user, kind=kind, title=title, body=body)
    if email and user.email:
        try:
            send_mail(title, body or title, None, [user.email], fail_silently=True)
        except Exception:  # pragma: no cover
            log.exception("email failed")
    if sms and user.phone:
        send_sms(user.phone, f"{title}. {body}"[:300])
