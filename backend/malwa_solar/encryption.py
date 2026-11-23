"""Field-level encryption helpers (BUG-066 / BUG-089).

Fernet key is derived from FIELD_ENCRYPTION_KEY when set, otherwise SECRET_KEY
(legacy). Prefer a dedicated FIELD_ENCRYPTION_KEY in production so rotating
Django SECRET_KEY does not make stored ciphertext undecryptable.
"""

import base64
import hashlib
import re

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet_material() -> str:
    dedicated = (getattr(settings, 'FIELD_ENCRYPTION_KEY', None) or '').strip()
    if dedicated:
        return dedicated
    return settings.SECRET_KEY


def _fernet():
    digest = hashlib.sha256(_fernet_material().encode()).digest()
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
