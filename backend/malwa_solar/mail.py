"""SMTP send wrapped in circuit breaker + short timeouts."""
from __future__ import annotations

import logging
import smtplib

from django.conf import settings
from django.core.mail import send_mail as django_send_mail

from .circuit_breaker import CircuitOpenError, smtp_breaker

logger = logging.getLogger(__name__)


def send_mail_safe(subject, message, recipient_list, *, fail_silently=False, **kwargs):
    """Idempotent-safe wrapper: callers should not retry POST-side effects blindly.

    Uses smtp_breaker so a down mail host does not hang every worker thread.
    """
    if not recipient_list:
        return 0

    def _send():
        return django_send_mail(
            subject,
            message,
            kwargs.pop('from_email', None) or settings.DEFAULT_FROM_EMAIL,
            recipient_list,
            fail_silently=False,
            **kwargs,
        )

    try:
        return smtp_breaker.call(_send)
    except CircuitOpenError:
        logger.warning('SMTP circuit open — mail not sent to %s', recipient_list)
        if fail_silently:
            return 0
        raise
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        logger.warning('SMTP send failed: %s', exc)
        if fail_silently:
            return 0
        raise
