from django.db import IntegrityError
from django.db.models import Q

from apps.accounts.permissions import is_super_admin
from .models import Notification


def notify(dedupe_key, title, *, message='', category='General', severity='info',
           module='O&M', user=None, link='', plant=None, channel='crm'):
    """Create the alert once per `dedupe_key`; repeated calls are no-ops.

    Returns (notification, created). Non-CRM channels are stored with the
    notification so a future WhatsApp / Email / SMS dispatcher can pick them up.
    """
    existing = Notification.objects.filter(dedupe_key=dedupe_key).first()
    if existing:
        return existing, False
    try:
        return Notification.objects.create(
            dedupe_key=dedupe_key[:200], title=title[:255], message=message, category=category,
            severity=severity, module=module or '', user=user,
            link=link[:255], plant=plant, channel=channel,
        ), True
    except IntegrityError:
        return Notification.objects.get(dedupe_key=dedupe_key[:200]), False


def viewable_modules(user):
    role = getattr(user, 'role', None)
    if not role:
        return []
    return [
        perm.module for perm in role.permissions.all()
        if perm.full_access or perm.can_view
    ]


def notifications_for(user):
    qs = Notification.objects.select_related('plant')
    if is_super_admin(user):
        return qs.filter(Q(user=user) | Q(user__isnull=True))
    return qs.filter(Q(user=user) | Q(user__isnull=True, module__in=viewable_modules(user)))
