from django.core.cache import cache
from django.db import IntegrityError
from django.db.models import Q

from apps.accounts.permissions import is_super_admin
from .models import Notification

UNREAD_CACHE_TTL = 5
VIEWABLE_MODULES_TTL = 60
UNREAD_GEN_KEY = 'notif_unread_gen_v1'


def unread_cache_key(user_id):
    gen = cache.get(UNREAD_GEN_KEY) or 0
    return f'notif_unread_v1:{gen}:{user_id}'


def viewable_modules_cache_key(role_id):
    return f'notif_viewmods_v1:{role_id}'


def invalidate_unread_cache(user_id=None):
    if user_id:
        cache.delete(unread_cache_key(user_id))
        return
    # Broadcast / unknown audience — bump generation so every user's unread key misses.
    try:
        cache.incr(UNREAD_GEN_KEY)
    except ValueError:
        cache.add(UNREAD_GEN_KEY, 1)


def invalidate_viewable_modules_cache(role_id=None):
    if role_id:
        cache.delete(viewable_modules_cache_key(role_id))


def notify(dedupe_key, title, *, message='', category='General', severity='info',
           module='O&M', user=None, link='', plant=None, channel='crm'):
    """Create the alert once per `dedupe_key`; repeated calls are no-ops.

    Returns (notification, created). Non-CRM channels are stored with the
    notification so a future WhatsApp / Email / SMS dispatcher can pick them up.
    Newly created CRM rows also enqueue Web Push when VAPID is configured.
    """
    existing = Notification.objects.filter(dedupe_key=dedupe_key).first()
    if existing:
        return existing, False
    try:
        row = Notification.objects.create(
            dedupe_key=dedupe_key[:200], title=title[:255], message=message, category=category,
            severity=severity, module=module or '', user=user,
            link=link[:255], plant=plant, channel=channel,
        )
    except IntegrityError:
        return Notification.objects.get(dedupe_key=dedupe_key[:200]), False
    if user is not None and getattr(user, 'pk', None):
        invalidate_unread_cache(user.pk)
    else:
        invalidate_unread_cache(None)
    try:
        from .push import enqueue_web_push
        enqueue_web_push(row)
    except Exception:
        pass
    return row, True


def viewable_modules(user):
    role = getattr(user, 'role', None)
    if not role:
        return []
    key = viewable_modules_cache_key(role.id)
    cached = cache.get(key)
    if cached is not None:
        return list(cached)
    modules = [
        perm.module for perm in role.permissions.all()
        if perm.full_access or perm.can_view
    ]
    cache.set(key, modules, VIEWABLE_MODULES_TTL)
    return modules


def notifications_for(user):
    qs = Notification.objects.select_related('plant')
    if is_super_admin(user):
        return qs.filter(Q(user=user) | Q(user__isnull=True))
    return qs.filter(Q(user=user) | Q(user__isnull=True, module__in=viewable_modules(user)))
