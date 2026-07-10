"""Settings business logic, defaults, dashboard and activity logging."""

from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone

from .models import (
    AppSetting,
    CompanyProfile,
    DocumentNumberSeries,
    FinancialYear,
    IpAccessRule,
    IpBlockedAttempt,
    MasterRecord,
    PaymentMode,
    SystemBackupLog,
    UserActivityLog,
)

# Categories exposed via /settings/category/<category>/
SETTING_CATEGORIES = {
    'business': {
        'businessName': 'Malwa Solar Energy Pvt. Ltd.',
        'phone': '+91 98765 43210',
        'tagline': 'Powering a Sustainable Future',
        'email': 'info@malwasolar.com',
        'nature': 'Manufacturing & Installation',
        'website': 'https://www.malwasolar.com',
        'description': 'End-to-end solar energy solutions for residential, commercial and industrial clients.',
        'establishedYear': '2021',
        'employees': '51-100 Employees',
        'entityType': 'Private Limited',
        'cin': 'U40106PB2021PTC045678',
        'incorporationDate': '01/04/2021',
        'incorporationPlace': 'Indore, Madhya Pradesh',
        'pan': 'AAGCM1234A',
        'address1': '123, Industrial Area, Phase 1',
        'address2': 'Near Transport Nagar',
        'city': 'Indore',
        'state': 'Madhya Pradesh',
        'pin': '452001',
        'country': 'India',
        'gst': '23AAGCM1234A1Z5',
        'tan': 'PTLM12345G',
        'gstType': 'Regular',
        'workingHours': '09:30 AM - 06:30 PM',
        'workingDays': 'Monday - Saturday',
        'currency': 'INR (Rs)',
        'timezone': '(GMT +05:30) Asia/Kolkata',
    },
    'system': {
        'systemName': 'Malwa Solar Energy CRM',
        'companyEmail': 'info@malwasolar.com',
        'companyPhone': '+91 98765 43210',
        'defaultTimeZone': '(GMT +05:30) Asia/Kolkata',
        'itemsPerPage': '25',
        'defaultLanguage': 'English',
    },
    'datetime': {
        'dateFormat': 'DD/MM/YYYY',
        'timeFormat': '12 Hour',
        'timezone': '(GMT +05:30) Asia/Kolkata',
        'weekStart': 'Monday',
        'fiscalStartMonth': 'April',
    },
    'currency': {
        'baseCurrency': 'INR (Rs)',
        'symbol': '₹',
        'decimalPlaces': '2',
        'exchangeRate': '1.00',
        'showSymbol': True,
    },
    'language': {
        'defaultLanguage': 'English',
        'enabledLanguages': ['English', 'Hindi (हिंदी)', 'Punjabi (ਪੰਜਾਬੀ)'],
        'rtlSupport': False,
    },
    'payment': {
        'lateFeeEnabled': True,
        'remindersEnabled': True,
        'allowPartial': True,
        'autoPaid': True,
        'defaultTerms': '30',
        'dueDateCalculation': 'From Invoice Date',
        'gracePeriod': '5',
        'lateFeeType': 'Percentage',
        'lateFeeValue': '2',
        'applyAfter': '5',
        'maxLateFeeLimit': '10',
        'firstReminder': '7',
        'secondReminder': '3',
        'finalReminder': '3',
        'reminderFrequency': 'Every 3 Days',
        'paymentText': 'Payment is due within {days} days from the invoice date.',
        'allocationMethod': 'Oldest Invoice First',
        'writeOffAccount': 'Bad Debts',
        'bankDetails': {
            'companyBank': True,
            'upiQr': True,
            'instructions': True,
            'accountHolder': True,
        },
    },
    'accounts': {
        'accountPrefix': 'ACC',
        'partyPrefix': 'PTY',
        'bankPrefix': 'BNK',
        'autoNumbering': True,
        'nextPartyNumber': 1001,
        'nextBankNumber': 101,
    },
    'inventory': {
        'negativeStock': 'Blocked',
        'lowStockAlert': 'Enabled',
        'reorderLevel': 'Item Wise',
        'stockValuation': 'FIFO',
        'batchTracking': 'Optional',
        'serialTracking': 'Enabled',
        'primaryWarehouse': 'Indore Main',
        'approvalRequired': 'Stock Outward',
        'autoGrn': 'Enabled',
        'stockAudit': 'Monthly',
    },
    'email': {
        'smtpHost': 'smtp.malwasolar.com',
        'smtpPort': '587',
        'smtpUser': 'noreply@malwasolar.com',
        'smtpSecurity': 'TLS',
        'fromName': 'Malwa Solar CRM',
        'fromEmail': 'noreply@malwasolar.com',
        'enabled': True,
    },
    'sms': {
        'provider': 'MSG91',
        'senderId': 'MALWA',
        'apiKey': '',
        'enabled': False,
    },
    'whatsapp': {
        'provider': 'WhatsApp Business API',
        'phoneNumberId': '',
        'accessToken': '',
        'enabled': False,
    },
    'notification': {
        'emailAlerts': True,
        'smsAlerts': False,
        'pushAlerts': True,
        'leadAssignment': True,
        'paymentReceived': True,
        'projectUpdates': True,
        'amcReminders': True,
    },
    'approval': {
        'leadApprovalRequired': True,
        'quotationApprovalRequired': True,
        'expenseApprovalRequired': True,
        'purchaseApprovalRequired': True,
        'defaultApproverRole': 'Admin',
    },
    'maintenance': {
        'autoCleanupLogs': True,
        'logRetentionDays': '90',
        'cacheCleanupEnabled': True,
        'healthCheckEnabled': True,
    },
    'ip_security': {
        'strictMode': True,
        'whitelistOnly': False,
        'loginAlert': True,
        'syncDelay': True,
    },
    'backup': {
        'syncFrequency': 'Daily',
        'backupLocation': 'Server',
        'liveSync': True,
        'retentionDays': '30',
        'autoBackup': True,
    },
}

MASTER_TYPE_LABELS = dict(MasterRecord.MASTER_TYPES)


def get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_user_activity(request, action, module, description='', status='Success', user=None):
    user = user or getattr(request, 'user', None)
    user_name = ''
    if user and getattr(user, 'is_authenticated', False):
        user_name = getattr(user, 'name', '') or getattr(user, 'email', '')

    return UserActivityLog.objects.create(
        user=user if user and getattr(user, 'is_authenticated', False) else None,
        user_name=user_name,
        action=action,
        module=module,
        description=description,
        ip_address=get_client_ip(request) if request else None,
        status=status,
    )


def get_category_settings(category):
    defaults = SETTING_CATEGORIES.get(category, {})
    rows = AppSetting.objects.filter(category=category)
    stored = {row.key: row.value for row in rows}
    payload = {**defaults}
    for key, value in stored.items():
        if isinstance(value, dict) and isinstance(payload.get(key), dict):
            payload[key] = {**payload[key], **value}
        else:
            payload[key] = value
    return payload


def update_category_settings(category, data: dict):
    if category not in SETTING_CATEGORIES:
        # Call sites (CategorySettingsView and the hardcoded 'system'/'payment'/
        # 'accounts' aliases) already pre-validate against SETTING_CATEGORIES,
        # so this should never actually trigger in normal use — but it's a
        # real guard now instead of a no-op `pass` (BUG-070). Raising Django's
        # ValidationError lets malwa_solar.exceptions.custom_exception_handler
        # turn it into a clean 400 instead of an unhandled 500.
        from django.core.exceptions import ValidationError
        raise ValidationError(f'Unknown settings category: {category!r}')
    for key, value in data.items():
        AppSetting.objects.update_or_create(
            category=category,
            key=key,
            defaults={'value': value},
        )
    return get_category_settings(category)


def settings_dashboard():
    from apps.accounts.models import Branch, Role, User
    from apps.accounts_module.models import ChartOfAccount

    active_fy = FinancialYear.objects.filter(is_current=True).first()
    return {
        'company_configured': bool(CompanyProfile.get_solo().data),
        'branches': Branch.objects.filter(is_active=True).count(),
        'users': User.objects.filter(is_active=True).count(),
        'roles': Role.objects.filter(is_active=True).count(),
        'payment_modes': PaymentMode.objects.filter(is_active=True).count(),
        'masters': MasterRecord.objects.filter(is_active=True).count(),
        'financial_years': FinancialYear.objects.count(),
        'current_financial_year': active_fy.label if active_fy else None,
        'chart_of_accounts': ChartOfAccount.objects.filter(is_active=True).count(),
        'ip_rules': IpAccessRule.objects.filter(is_active=True).count(),
        'recent_activities': UserActivityLog.objects.count(),
        'document_series': DocumentNumberSeries.objects.filter(is_active=True).count(),
        'backups': SystemBackupLog.objects.count(),
    }


def accounts_settings_summary():
    from apps.accounts_module.models import ChartOfAccount

    totals = ChartOfAccount.objects.filter(is_active=True).aggregate(
        total_debit=Sum('opening_balance'),
    )
    accounts_config = get_category_settings('accounts')
    qs = ChartOfAccount.objects.filter(is_active=True).order_by('account_code')
    total_count = qs.count()
    rows = qs[:50]
    total_val = totals.get('total_debit') or Decimal('0')
    return {
        'prefix': accounts_config,
        'total_accounts': total_count,
        'total_debit': str(total_val),
        'total_credit': str(total_val),
        'difference': '0',
        'accounts': [
            {
                'id': row.id,
                'code': row.account_code,
                'name': row.account_name,
                'type': row.account_type,
                'opening_balance': str(row.opening_balance),
                'is_active': row.is_active,
            }
            for row in rows
        ],
    }


def _human_size(num_bytes):
    for unit in ('B', 'KB', 'MB', 'GB'):
        if num_bytes < 1024 or unit == 'GB':
            return f'{num_bytes:.1f} {unit}' if unit != 'B' else f'{int(num_bytes)} B'
        num_bytes /= 1024


def create_backup_log(user, backup_type='Full'):
    """Export the full database (dumpdata) to a gzipped JSON file under
    MEDIA_ROOT/backups/ and record the real outcome."""
    import gzip
    import io
    from pathlib import Path

    from django.conf import settings as dj_settings
    from django.core.management import call_command

    ts = timezone.now().strftime('%Y%m%d_%H%M%S')
    filename = f'malwa_crm_backup_{ts}.json.gz'
    backup_dir = Path(dj_settings.MEDIA_ROOT) / 'backups'
    file_size = ''
    status = 'Completed'
    notes = f'Database export saved to media/backups/{filename}.'
    try:
        backup_dir.mkdir(parents=True, exist_ok=True)
        buffer = io.StringIO()
        call_command(
            'dumpdata',
            '--natural-foreign',
            '--natural-primary',
            exclude=['contenttypes', 'auth.permission', 'sessions.session', 'admin.logentry'],
            stdout=buffer,
        )
        path = backup_dir / filename
        with gzip.open(path, 'wt', encoding='utf-8') as fh:
            fh.write(buffer.getvalue())
        file_size = _human_size(path.stat().st_size)
    except Exception as exc:  # record the failure instead of pretending success
        status = 'Failed'
        notes = f'Backup failed: {exc}'[:500]

    log = SystemBackupLog.objects.create(
        filename=filename,
        file_size=file_size,
        backup_type=backup_type,
        status=status,
        notes=notes,
        created_by=user if user and user.is_authenticated else None,
    )
    return log


def run_maintenance_action(action):
    results = {'action': action, 'status': 'Completed', 'details': []}
    if action == 'clear_cache':
        cache.clear()
        results['details'].append('Application cache cleared.')
    elif action == 'health_check':
        from pathlib import Path

        from django.conf import settings as dj_settings
        from django.db import connection

        try:
            connection.ensure_connection()
            results['details'].append('Database connection OK.')
        except Exception as exc:
            results['status'] = 'Failed'
            results['details'].append(f'Database connection FAILED: {exc}')
        try:
            cache.set('health_check_probe', '1', 10)
            if cache.get('health_check_probe') == '1':
                results['details'].append('Cache read/write OK.')
            else:
                results['status'] = 'Failed'
                results['details'].append('Cache read/write FAILED: value not persisted.')
        except Exception as exc:
            results['status'] = 'Failed'
            results['details'].append(f'Cache read/write FAILED: {exc}')
        try:
            media_root = Path(dj_settings.MEDIA_ROOT)
            media_root.mkdir(parents=True, exist_ok=True)
            probe = media_root / '.health_check_probe'
            probe.write_text('ok')
            probe.unlink()
            results['details'].append('Media storage writable.')
        except Exception as exc:
            results['status'] = 'Failed'
            results['details'].append(f'Media storage FAILED: {exc}')
    elif action == 'cleanup_logs':
        cutoff_days = int(get_category_settings('maintenance').get('logRetentionDays', 90))
        deleted, _ = UserActivityLog.objects.filter(
            created_at__lt=timezone.now() - timedelta(days=cutoff_days)
        ).delete()
        results['details'].append(f'Removed {deleted} old activity log rows.')
    else:
        results['status'] = 'Failed'
        results['details'].append(f'Unknown action: {action}')
    return results


def seed_setting_defaults():
    """Populate default category settings, masters, financial years, IP rules, document series."""
    for category, defaults in SETTING_CATEGORIES.items():
        for key, value in defaults.items():
            AppSetting.objects.get_or_create(category=category, key=key, defaults={'value': value})

    if not FinancialYear.objects.exists():
        FinancialYear.objects.create(
            label='2025-26',
            start_date=timezone.datetime(2025, 4, 1).date(),
            end_date=timezone.datetime(2026, 3, 31).date(),
            status='Active',
            is_current=True,
        )
        FinancialYear.objects.create(
            label='2024-25',
            start_date=timezone.datetime(2024, 4, 1).date(),
            end_date=timezone.datetime(2025, 3, 31).date(),
            status='Active',
            is_current=False,
        )

    if not IpAccessRule.objects.exists():
        IpAccessRule.objects.create(
            name='Local Development',
            ip_range='127.0.0.1',
            rule_type='Allow',
            description='Loopback for Vite/API proxy during local dev',
        )
        IpAccessRule.objects.create(
            name='Office Network',
            ip_range='192.168.1.0/24',
            rule_type='Allow',
            description='Main office LAN',
        )
        IpAccessRule.objects.create(
            name='Blocked Suspicious Range',
            ip_range='203.0.113.0/24',
            rule_type='Block',
            description='Known abusive range',
        )

    if not IpBlockedAttempt.objects.exists():
        IpBlockedAttempt.objects.create(
            ip_address='203.0.113.45',
            username='unknown',
            reason='Blocked IP rule matched',
        )

    if not DocumentNumberSeries.objects.exists():
        series = [
            ('Lead', 'LD-', 1001),
            ('Quotation', 'QT-', 5001),
            ('Invoice', 'INV-', 2001),
            ('Project', 'PRJ-', 3001),
            ('AMC Contract', 'AMC-', 4001),
        ]
        for doc_type, prefix, next_num in series:
            DocumentNumberSeries.objects.get_or_create(
                document_type=doc_type,
                prefix=prefix,
                defaults={'next_number': next_num, 'padding': 4},
            )

    master_seed = [
        ('product_category', 'Solar Panels', 'CAT-SP', {'parent': 'Main Inventory', 'tax': '12%'}),
        ('product_category', 'Inverters', 'CAT-INV', {'parent': 'Main Inventory', 'tax': '18%'}),
        ('unit', 'Nos', 'NOS', {'type': 'Quantity', 'precision': '0', 'base': True}),
        ('unit', 'kWp', 'KWP', {'type': 'Solar Capacity', 'precision': '2', 'base': True}),
        ('tax', 'GST 18%', 'GST18', {'rate': '18%', 'type': 'GST'}),
        ('tax', 'GST 12%', 'GST12', {'rate': '12%', 'type': 'GST'}),
        ('project_status', 'Planning', 'PLAN', {'color': '#f59e0b'}),
        ('project_status', 'Active', 'ACT', {'color': '#2f80ff'}),
        ('project_status', 'Completed', 'DONE', {'color': '#14b84c'}),
        ('project_type', 'On-Grid', 'ONGRID', {}),
        ('project_type', 'Off-Grid', 'OFFGRID', {}),
        ('task_priority', 'High', 'HIGH', {}),
        ('task_priority', 'Medium', 'MED', {}),
        ('task_priority', 'Low', 'LOW', {}),
        ('milestone', 'Site Survey', 'SURVEY', {}),
        ('milestone', 'Installation', 'INSTALL', {}),
        ('stock_rule', 'Negative Stock', 'NEG-STOCK', {'value': 'Blocked', 'module': 'All Warehouses'}),
        ('stock_rule', 'Low Stock Alert', 'LOW-STOCK', {'value': 'Enabled', 'module': 'Inventory'}),
        ('approval_workflow', 'Lead Approval', 'LEAD-APR', {'approver': 'Admin'}),
        ('document', 'Invoice Template', 'INV-TPL', {}),
    ]
    for master_type, name, code, metadata in master_seed:
        MasterRecord.objects.get_or_create(
            master_type=master_type,
            code=code,
            defaults={'name': name, 'metadata': metadata},
        )
