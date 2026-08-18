from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models


class Branch(models.Model):
    name = models.CharField(max_length=200)
    city = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = 'Branches'


class Role(models.Model):
    ROLE_TYPES = [('system', 'System Role'), ('custom', 'Custom Role')]

    name = models.CharField(max_length=100, unique=True)
    role_type = models.CharField(max_length=10, choices=ROLE_TYPES, default='custom')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class RolePermission(models.Model):
    # Ordered to match the main CRM sidebar so Roles & Permissions UI is
    # easy to understand. Lead covers follow-ups / IVRS / approvals APIs.
    # User Management stays separate (Users & Roles under Settings).
    MODULE_CHOICES = [
        ('Dashboard', 'Dashboard'),
        ('Lead', 'Lead'),
        ('Quotation', 'Quotation'),
        ('Project Management', 'Project Management'),
        ('Liaisoning & Commissioning', 'Liaisoning & Commissioning'),
        ('O&M', 'O&M'),
        ('Accounts', 'Accounts'),
        ('Inventory', 'Inventory'),
        ('Employee', 'Employee'),
        ('Insights', 'Insights'),
        ('Daily Tasks', 'Daily Tasks'),
        ('AMC & Warranty', 'AMC & Warranty'),
        ('Settings', 'Settings'),
        ('User Management', 'User Management'),
    ]

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='permissions')
    module = models.CharField(max_length=40, choices=MODULE_CHOICES)
    can_view = models.BooleanField(default=False)
    can_add = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    can_export = models.BooleanField(default=False)
    can_import = models.BooleanField(default=False)
    can_approve = models.BooleanField(default=False)
    # Lead (re)assignment — toggled from Settings → Roles & Permissions.
    # Not implied by can_edit; managers get this explicitly (or via full_access).
    can_assign = models.BooleanField(default=False)
    full_access = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('role', 'module')
        ordering = ['module']

    def __str__(self):
        return f'{self.role.name} / {self.module}'


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200)
    # BUG-072: real uniqueness on mobile itself — the old
    # UniqueConstraint(['email', 'mobile']) was vacuous since email is
    # already globally unique, so it never actually stopped two users
    # sharing a phone number. null=True (in addition to blank=True) is
    # required so multiple users who simply have no phone on file don't
    # collide on '' — a unique index treats '' as a real value but treats
    # NULL as distinct from every other NULL.
    mobile = models.CharField(max_length=15, blank=True, null=True, unique=True)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    # Soft-delete keeps the row so FK history (leads, follow-ups, etc.) still
    # resolves to a display name of "Deleted User" instead of breaking or
    # cascading. Hard DELETE is intentionally not used from the Users UI.
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    objects = UserManager()

    def __str__(self):
        return f'{self.name} ({self.email})'

    def soft_delete(self):
        """Anonymize + deactivate without removing the DB row."""
        from django.utils import timezone

        stamp = timezone.now().strftime('%Y%m%d%H%M%S')
        self.name = 'Deleted User'
        self.email = f'deleted.{self.pk}.{stamp}@deleted.local'
        self.mobile = None
        self.is_active = False
        self.is_deleted = True
        self.is_staff = False
        self.is_superuser = False
        self.set_unusable_password()
        self.save(update_fields=[
            'name', 'email', 'mobile', 'is_active', 'is_deleted',
            'is_staff', 'is_superuser', 'password', 'updated_at',
        ])
        return self

    @staticmethod
    def public_display_name(user):
        """Safe label for FKs in lists/history. Never blank after account removal."""
        if user is None:
            return 'Deleted User'
        if getattr(user, 'is_deleted', False):
            return 'Deleted User'
        name = (getattr(user, 'name', None) or '').strip()
        if not name or name.lower() == 'deleted user':
            return 'Deleted User'
        return name

    @property
    def initials(self):
        parts = (self.name or 'Deleted User').split()
        return ''.join(p[0].upper() for p in parts[:2]) if parts else 'DU'

    @property
    def role_name(self):
        return self.role.name if self.role else ''

    @property
    def branch_name(self):
        return self.branch.name if self.branch else ''

    class Meta:
        verbose_name_plural = 'Users'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                check=models.Q(mobile='') | models.Q(mobile__regex=r'^\d{10}$'),
                name='mobile_length_or_blank',
            ),
            models.UniqueConstraint(fields=['email', 'mobile'], name='unique_email_mobile_pair'),
        ]
        indexes = [
            models.Index(fields=['email', 'mobile']),
            models.Index(fields=['email']),
            models.Index(fields=['mobile']),
        ]

        