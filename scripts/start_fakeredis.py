"""TCP Redis stand-in for local staging when Docker Redis is unavailable."""
from __future__ import annotations

import argparse
import time


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=6379)
    args = parser.parse_args()

    from fakeredis import TcpFakeServer

    server = TcpFakeServer((args.host, args.port), server_type='redis')
    print(f'FAKEREDIS listening on redis://{args.host}:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('fakeredis stopped', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
