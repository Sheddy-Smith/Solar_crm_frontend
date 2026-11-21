from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Generate VAPID public/private keys for Web Push and print .env lines.'

    def handle(self, *args, **options):
        try:
            from py_vapid import Vapid
            from py_vapid.utils import b64urlencode
            from cryptography.hazmat.primitives import serialization
        except ImportError as exc:
            raise SystemExit(
                'pywebpush (and py_vapid) required. Run: pip install pywebpush==2.0.3'
            ) from exc

        vapid = Vapid()
        vapid.generate_keys()
        public_raw = vapid.public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
        public_key = b64urlencode(public_raw)
        private_pem = vapid.private_pem()
        if isinstance(private_pem, (bytes, bytearray)):
            private_pem = private_pem.decode('utf-8')
        private_one_line = private_pem.replace('\n', '\\n').strip()

        self.stdout.write(self.style.SUCCESS('Add these to backend/.env (never commit the private key):'))
        self.stdout.write(f'VAPID_PUBLIC_KEY={public_key}')
        self.stdout.write(f'VAPID_PRIVATE_KEY={private_one_line}')
        self.stdout.write('VAPID_SUBJECT=mailto:noreply@malwasolar.com')
