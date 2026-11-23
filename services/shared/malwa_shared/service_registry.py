"""Canonical microservice registry (ports + route prefixes for the gateway)."""

SERVICES = {
    'auth': {
        'port': 8001,
        'apps': ['apps.accounts'],
        'url_includes': [
            ('', 'apps.accounts.urls'),
        ],
        'description': 'Users, roles, branches, JWT login/refresh/logout',
    },
    'notifications': {
        'port': 8002,
        'apps': ['apps.accounts', 'apps.notifications'],
        'url_includes': [
            ('notifications/', 'apps.notifications.urls'),
        ],
        'description': 'In-app and push notifications',
    },
    'settings': {
        'port': 8003,
        'apps': ['apps.accounts', 'apps.crm_settings'],
        'url_includes': [
            ('settings/', 'apps.crm_settings.urls'),
        ],
        'description': 'Company profile, FY, masters, org snapshot',
    },
    'leads': {
        'port': 8004,
        'apps': ['apps.accounts', 'apps.leads', 'apps.projects', 'apps.crm_settings', 'apps.notifications'],
        'url_includes': [
            ('', 'apps.leads.urls'),
        ],
        'description': 'Leads, quotations, follow-ups',
    },
    'projects': {
        'port': 8005,
        'apps': [
            'apps.accounts', 'apps.leads', 'apps.projects', 'apps.inventory',
            'apps.crm_settings', 'apps.notifications',
        ],
        'url_includes': [
            ('', 'apps.projects.urls'),
        ],
        'description': 'Projects, BOM, material plans, work orders',
    },
    'inventory': {
        'port': 8006,
        'apps': ['apps.accounts', 'apps.inventory', 'apps.projects', 'apps.leads'],
        'url_includes': [
            ('inventory/', 'apps.inventory.urls'),
        ],
        'description': 'Warehouses, stock, movements',
    },
    'finance': {
        'port': 8007,
        'apps': [
            'apps.accounts', 'apps.accounts_module', 'apps.leads', 'apps.projects',
            'apps.inventory', 'apps.crm_settings',
        ],
        'url_includes': [
            ('accounts/', 'apps.accounts_module.urls'),
        ],
        'description': 'Invoices, payments, ledger (accounts_module)',
    },
    'workforce': {
        'port': 8008,
        'apps': ['apps.accounts', 'apps.workforce'],
        'url_includes': [
            ('workforce/', 'apps.workforce.urls'),
        ],
        'description': 'Employees and attendance',
    },
    'liaison': {
        'port': 8009,
        'apps': ['apps.accounts', 'apps.liaisoning', 'apps.projects', 'apps.leads'],
        'url_includes': [
            ('liaison/', 'apps.liaisoning.urls'),
        ],
        'description': 'Liaisoning / L&C',
    },
    'om': {
        'port': 8010,
        'apps': ['apps.accounts', 'apps.om', 'apps.projects', 'apps.leads', 'apps.inventory'],
        'url_includes': [
            ('om/', 'apps.om.urls'),
        ],
        'description': 'O&M plants, tickets, maintenance',
    },
    'amc': {
        'port': 8011,
        'apps': ['apps.accounts', 'apps.amc', 'apps.projects', 'apps.om'],
        'url_includes': [
            ('amc/', 'apps.amc.urls'),
        ],
        'description': 'AMC contracts',
    },
    'tasks': {
        'port': 8012,
        'apps': ['apps.accounts', 'apps.daily_tasks', 'apps.notifications'],
        'url_includes': [
            ('daily-tasks/', 'apps.daily_tasks.urls'),
        ],
        'description': 'Daily / staff tasks',
    },
    'insights': {
        'port': 8013,
        'apps': [
            'apps.accounts', 'apps.dashboard', 'apps.leads', 'apps.projects',
            'apps.accounts_module', 'apps.inventory', 'apps.amc', 'apps.reports',
            'apps.crm_settings',
        ],
        'url_includes': [
            ('dashboard/', 'apps.dashboard.urls'),
        ],
        'description': 'Unified dashboard aggregates',
    },
    'reports': {
        'port': 8014,
        'apps': [
            'apps.accounts', 'apps.reports', 'apps.leads', 'apps.projects',
            'apps.accounts_module', 'apps.inventory', 'apps.workforce',
        ],
        'url_includes': [
            ('reports/', 'apps.reports.urls'),
        ],
        'description': 'Exports and reports',
    },
}

GATEWAY_PORT = 8080
MONOLITH_FALLBACK_PORT = 8000
