import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.liaisoning.models import LiaisonCommissioning

logger = logging.getLogger(__name__)


@receiver(post_save, sender=LiaisonCommissioning)
def activate_plant_on_commissioning(sender, instance, **kwargs):
    if instance.status != 'Completed':
        return
    from .services import activate_plant
    try:
        activate_plant(instance.project, instance.date, user=instance.created_by)
    except Exception:
        # Never block saving the commissioning record; the backfill command
        # (om_backfill_plants) can activate the plant later.
        logger.exception('O&M: plant activation failed for project %s', instance.project_id)
