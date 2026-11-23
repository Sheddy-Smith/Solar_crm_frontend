"""JWT validation contract shared by gateway plugins / future non-Django services."""
from __future__ import annotations

from typing import Any


def decode_access_token(token: str, *, secret_key: str, algorithms: list[str] | None = None) -> dict[str, Any]:
    """Decode a SimpleJWT-compatible access token (HS256 by default)."""
    import jwt

    algorithms = algorithms or ['HS256']
    return jwt.decode(
        token,
        secret_key,
        algorithms=algorithms,
        options={'require': ['exp', 'user_id']},
    )


def bearer_from_header(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(' ', 1)
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    return parts[1].strip() or None
