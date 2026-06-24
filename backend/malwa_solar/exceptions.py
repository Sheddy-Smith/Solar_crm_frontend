from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.views import exception_handler as drf_exception_handler


def custom_exception_handler(exc, context):
    """Translate Django's core ValidationError (raised by model.full_clean()/clean())
    into DRF's ValidationError so it returns a clean 400 instead of an unhandled 500.
    """
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            detail = exc.message_dict
        elif hasattr(exc, 'messages'):
            detail = exc.messages
        else:
            detail = str(exc)
        exc = DRFValidationError(detail)

    return drf_exception_handler(exc, context)
