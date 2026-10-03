from django.apps import AppConfig


class OmConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.om'

    def ready(self):
        from . import signals  # noqa: F401
