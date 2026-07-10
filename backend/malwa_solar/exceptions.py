from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import ProtectedError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.views import exception_handler as drf_exception_handler


def custom_exception_handler(exc, context):
    """Translate Django's core ValidationError (raised by model.full_clean()/clean())
    into DRF's ValidationError so it returns a clean 400 instead of an unhandled 500.
    Also translates ProtectedError (on_delete=PROTECT, e.g. BUG-057) into a clean
    400 instead of an unhandled 500, so deleting a record with historical/financial
    children tells the user why instead of crashing.
    """
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            detail = exc.message_dict
        elif hasattr(exc, 'messages'):
            detail = exc.messages
        else:
            detail = str(exc)
        exc = DRFValidationError(detail)
    elif isinstance(exc, ProtectedError):
        count = len(exc.protected_objects) if hasattr(exc, 'protected_objects') else ''
        exc = DRFValidationError(
            f'Cannot delete: {count} related record(s) depend on this and must be removed first.'
            if count else 'Cannot delete: related records depend on this.'
        )

    return drf_exception_handler(exc, context)
