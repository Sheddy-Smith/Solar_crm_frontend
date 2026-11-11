"""Encrypted admin-visible password vault (Fernet + SECRET_KEY).

Django auth passwords remain hashed and unrecoverable. This vault keeps a
separate ciphertext so Super Admin can see the last password that was set
in Users → Edit. Cleared on soft-delete.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def seal_password(raw: str) -> str:
    text = (raw or '').strip()
    if not text:
        return ''
    return _fernet().encrypt(text.encode('utf-8')).decode('ascii')


def reveal_password(user) -> str:
    blob = (getattr(user, 'password_vault', None) or '').strip()
    if not blob:
        return ''
    try:
        return _fernet().decrypt(blob.encode('ascii')).decode('utf-8')
    except (InvalidToken, ValueError, TypeError):
        return ''


def store_password_vault(user, raw: str, *, save: bool = True) -> None:
    user.password_vault = seal_password(raw)
    if save:
        user.save(update_fields=['password_vault', 'updated_at'])


def clear_password_vault(user, *, save: bool = True) -> None:
    if not getattr(user, 'password_vault', None):
        return
    user.password_vault = ''
    if save:
        user.save(update_fields=['password_vault', 'updated_at'])
