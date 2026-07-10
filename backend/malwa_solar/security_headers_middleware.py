"""Apply extra security response headers configured in settings.

BUG-022: production enables a strict Content-Security-Policy (and related
headers) via `SECURITY_EXTRA_HEADERS` to reduce XSS impact while JWT tokens
remain in localStorage on the SPA. Headers are only set when configured so
development settings are unaffected.
"""


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        from django.conf import settings

        for header, value in getattr(settings, 'SECURITY_EXTRA_HEADERS', {}).items():
            if value and header not in response:
                response[header] = value
        return response
