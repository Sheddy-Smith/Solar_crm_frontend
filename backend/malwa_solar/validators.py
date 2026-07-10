from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx']
IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

validate_document_extension = FileExtensionValidator(allowed_extensions=DOCUMENT_EXTENSIONS)
validate_image_extension = FileExtensionValidator(allowed_extensions=IMAGE_EXTENSIONS)


def validate_upload_size(file):
    if file.size > MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError(f'File too large ({file.size / (1024 * 1024):.1f} MB). Max size is 10 MB.')
