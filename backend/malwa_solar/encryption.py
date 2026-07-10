"""Field-level encryption helpers (BUG-066) — Fernet key derived from SECRET_KEY."""

import base64
import hashlib
import re

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet():
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_value(plain: str) -> str:
    if not plain:
        return ''
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_value(stored: str) -> str:
    if not stored:
        return ''
    try:
        return _fernet().decrypt(stored.encode()).decode()
    except (InvalidToken, ValueError):
        # Legacy plaintext rows written before encryption was enabled.
        return stored


def mask_aadhaar(plain: str) -> str:
    """Return XXXX-XXXX-1234 style mask; only last four digits are shown."""
    if not plain:
        return ''
    digits = re.sub(r'\D', '', plain)
    if len(digits) < 4:
        return 'XXXX-XXXX-XXXX'
    return f'XXXX-XXXX-{digits[-4:]}'


def display_aadhaar(stored: str, *, reveal_full: bool = False) -> str:
    plain = decrypt_value(stored)
    if reveal_full:
        return plain
    return mask_aadhaar(plain)
