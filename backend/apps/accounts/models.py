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
    # BUG-017 (wired): 'Dashboard' gates `apps.reports.views.ReportsViewSet`
    # (cross-module reports dashboard). 'IVRS Management' gates duplicate-IVRS
    # approval *create* on `apps.leads.views.AdminApprovalViewSet`; list/
    # approve/reject stay under 'Approvals'.
    MODULE_CHOICES = [
        ('Dashboard', 'Dashboard'),
        ('Leads', 'Leads'),
        ('Follow-ups', 'Follow-ups'),
        ('IVRS Management', 'IVRS Management'),
        ('Approvals', 'Approvals'),
        ('Project Management', 'Project Management'),
        ('Workforce', 'Workforce'),
        ('Liaisoning & Commissioning', 'Liaisoning & Commissioning'),
        ('O&M', 'O&M'),
        ('Accounts', 'Accounts'),
        ('Inventory', 'Inventory'),
        ('AMC & Warranty', 'AMC & Warranty'),
        ('Reports', 'Reports'),
        ('User Management', 'User Management'),
        ('Settings', 'Settings'),
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    objects = UserManager()

    def __str__(self):
        return f'{self.name} ({self.email})'

    @property
    def initials(self):
        parts = self.name.split()
        return ''.join(p[0].upper() for p in parts[:2])

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

        