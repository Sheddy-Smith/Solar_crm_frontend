import os

from uvicorn_worker import UvicornWorker


class DjangoUvicornWorker(UvicornWorker):
    """UvicornWorker tuned for Django's HTTP-only ASGI app.

    - lifespan off: Django doesn't implement the lifespan protocol.
    - ws none: no websocket routes exist; don't accept upgrades.
    - limit_concurrency: sync views each occupy a thread + DB connection, so
      cap in-flight requests per worker and answer 503 beyond that instead of
      exhausting MySQL connections.
    """

    CONFIG_KWARGS = {
        **UvicornWorker.CONFIG_KWARGS,
        'lifespan': 'off',
        'ws': 'none',
        'limit_concurrency': int(os.environ.get('UVICORN_LIMIT_CONCURRENCY', '64')) or None,
    }
