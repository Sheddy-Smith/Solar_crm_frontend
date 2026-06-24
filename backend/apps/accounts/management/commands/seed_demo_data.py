from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, date
import random


class Command(BaseCommand):
    help = 'Seed database with demo data from the UI'

    def handle(self, *args, **options):
        self.stdout.write('Seeding demo data...')
        self._create_roles_and_branches()
        self._create_role_permissions()
        self._create_users()
        self._create_leads()
        self._create_warehouses()
        self._create_inventory()
        self._create_projects()
        self.stdout.write(self.style.SUCCESS('Demo data seeded successfully!'))

    # ─── Roles & Branches ────────────────────────────────────────────────────

    def _create_roles_and_branches(self):
        from apps.accounts.models import Role, Branch
        roles = ['Super Admin', 'Admin', 'Branch Manager', 'Team Leader', 'Sales Executive']
        for name in roles:
            Role.objects.get_or_create(name=name)
        self.stdout.write(f'  Roles: {len(roles)} created/verified')

        branches = [
            ('Head Office', 'Indore'),
            ('Indore Branch', 'Indore'),
            ('Bhopal Branch', 'Bhopal'),
            ('Ujjain Branch', 'Ujjain'),
            ('Dewas Branch', 'Dewas'),
            ('Gwalior Branch', 'Gwalior'),
            ('Jabalpur Branch', 'Jabalpur'),
        ]
        for name, city in branches:
            Branch.objects.get_or_create(name=name, defaults={'city': city})
        self.stdout.write(f'  Branches: {len(branches)} created/verified')

    # ─── Role Permissions ────────────────────────────────────────────────────

    def _create_role_permissions(self):
        from apps.accounts.models import Role, RolePermission

        all_modules = [module for module, _ in RolePermission.MODULE_CHOICES]
        full_access_modules = {m: m != 'User Management' for m in all_modules}

        role_defaults = {
            'Super Admin': {m: {'full_access': True} for m in all_modules},
            'Admin': {m: {'full_access': full_access_modules[m]} for m in all_modules},
            'Branch Manager': {
                'Leads': {'full_access': True}, 'Follow-ups': {'full_access': True},
                'Approvals': {'full_access': True}, 'Project Management': {'full_access': True},
                'Accounts': {'can_view': True, 'can_export': True},
                'Reports': {'can_view': True, 'can_export': True},
                'Dashboard': {'can_view': True},
                'IVRS Management': {'can_view': True},
                'Liaisoning & Commissioning': {'can_view': True},
                'O&M': {'can_view': True},
            },
            'Team Leader': {
                'Leads': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Follow-ups': {'full_access': True},
                'Approvals': {'can_view': True},
                'Project Management': {'can_view': True, 'can_edit': True},
                'Dashboard': {'can_view': True},
                'Reports': {'can_view': True},
            },
            'Sales Executive': {
                'Leads': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Follow-ups': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Dashboard': {'can_view': True},
            },
            'Viewer': {
                'Leads': {'can_view': True}, 'Follow-ups': {'can_view': True},
                'Project Management': {'can_view': True}, 'Accounts': {'can_view': True},
                'Reports': {'can_view': True}, 'Dashboard': {'can_view': True},
            },
        }

        count = 0
        for role_name, module_flags in role_defaults.items():
            role = Role.objects.filter(name=role_name).first()
            if not role:
                continue
            for module in all_modules:
                flags = module_flags.get(module, {})
                _, created = RolePermission.objects.update_or_create(
                    role=role, module=module, defaults=flags,
                )
                if created:
                    count += 1
        self.stdout.write(f'  Role permissions: {count} created/verified')

    # ─── Users ───────────────────────────────────────────────────────────────

    def _create_users(self):
        from apps.accounts.models import User, Role, Branch
        users_data = [
            {'email': 'rohit.singh@malwasolar.com', 'name': 'Rohit Singh', 'mobile': '9876543210', 'role': 'Sales Executive', 'branch': 'Indore Branch'},
            {'email': 'neha.kumari@malwasolar.com', 'name': 'Neha Kumari', 'mobile': '9827456781', 'role': 'Sales Executive', 'branch': 'Indore Branch'},
            {'email': 'vikram.patel@malwasolar.com', 'name': 'Vikram Patel', 'mobile': '9753124680', 'role': 'Sales Executive', 'branch': 'Ujjain Branch'},
            {'email': 'amit.sharma@malwasolar.com', 'name': 'Amit Sharma', 'mobile': '9876543211', 'role': 'Team Leader', 'branch': 'Indore Branch'},
            {'email': 'neha.jain@malwasolar.com', 'name': 'Neha Jain', 'mobile': '9812345671', 'role': 'Sales Executive', 'branch': 'Bhopal Branch'},
            {'email': 'vikram.singh@malwasolar.com', 'name': 'Vikram Singh', 'mobile': '9135782469', 'role': 'Sales Executive', 'branch': 'Dewas Branch'},
            {'email': 'manish.gupta@malwasolar.com', 'name': 'Manish Gupta', 'mobile': '9222334455', 'role': 'Branch Manager', 'branch': 'Indore Branch'},
            {'email': 'sunil.patidar@malwasolar.com', 'name': 'Sunil Patidar', 'mobile': '9827456782', 'role': 'Team Leader', 'branch': 'Ujjain Branch'},
            {'email': 'pooja.verma@malwasolar.com', 'name': 'Pooja Verma', 'mobile': '9870098765', 'role': 'Sales Executive', 'branch': 'Dewas Branch'},
            {'email': 'rahul.dubey@malwasolar.com', 'name': 'Rahul Dubey', 'mobile': '9023456782', 'role': 'Sales Executive', 'branch': 'Indore Branch'},
        ]
        count = 0
        for ud in users_data:
            if User.objects.filter(email=ud['email']).exists():
                continue
            role = Role.objects.filter(name=ud['role']).first()
            branch = Branch.objects.filter(name=ud['branch']).first()
            user = User(email=ud['email'], name=ud['name'], mobile=ud['mobile'], role=role, branch=branch, is_active=True, is_staff=False)
            user.set_password('Malwa@2024')
            user.save()
            count += 1
        self.stdout.write(f'  Users: {count} created')

    # ─── Leads ───────────────────────────────────────────────────────────────

    def _create_leads(self):
        from apps.accounts.models import User
        from apps.leads.models import Lead

        admin = User.objects.filter(is_superuser=True).first()
        rohit = User.objects.filter(name='Rohit Singh').first()
        neha_k = User.objects.filter(name='Neha Kumari').first()
        vikram_p = User.objects.filter(name='Vikram Patel').first()

        today = date.today()

        leads_data = [
            {'customer_name': 'Amit Sharma', 'mobile_number': '9876543210', 'ivrs_number': 'IVRS123456', 'project_name': '5kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '5', 'status': 'Follow-up', 'priority': 'High', 'source': 'Referral', 'city': 'Indore', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today + timedelta(days=3)},
            {'customer_name': 'Sunil Verma', 'mobile_number': '9123456780', 'ivrs_number': 'IVRS123457', 'project_name': '10kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '10', 'status': 'Follow-up', 'priority': 'Medium', 'source': 'Website', 'city': 'Bhopal', 'state': 'MP', 'assigned_to': neha_k, 'next_follow_up': today + timedelta(days=5)},
            {'customer_name': 'Pooja Mehta', 'mobile_number': '9988776655', 'ivrs_number': 'IVRS123458', 'project_name': '3kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '3', 'status': 'New', 'priority': 'Low', 'source': 'Walk-in', 'city': 'Ujjain', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today + timedelta(days=1)},
            {'customer_name': 'Rajesh Gupta', 'mobile_number': '8877665544', 'ivrs_number': 'IVRS123459', 'project_name': '7.5kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '7.5', 'status': 'Follow-up', 'priority': 'High', 'source': 'Campaign', 'city': 'Indore', 'state': 'MP', 'assigned_to': vikram_p, 'next_follow_up': today + timedelta(days=3)},
            {'customer_name': 'Manish Tiwari', 'mobile_number': '7766554433', 'ivrs_number': 'IVRS123460', 'project_name': '10kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '10', 'status': 'New', 'priority': 'Medium', 'source': 'Referral', 'city': 'Dewas', 'state': 'MP', 'assigned_to': neha_k, 'next_follow_up': today - timedelta(days=2)},
            {'customer_name': 'Deepak Joshi', 'mobile_number': '7894561230', 'ivrs_number': 'IVRS123461', 'project_name': '10kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '10', 'status': 'Quotation', 'priority': 'High', 'source': 'Website', 'city': 'Indore', 'state': 'MP', 'assigned_to': vikram_p, 'next_follow_up': today + timedelta(days=5)},
            {'customer_name': 'Anjali Patel', 'mobile_number': '9696969696', 'ivrs_number': 'IVRS123462', 'project_name': '3kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '3', 'status': 'Follow-up', 'priority': 'Low', 'source': 'Referral', 'city': 'Bhopal', 'state': 'MP', 'assigned_to': neha_k, 'next_follow_up': today + timedelta(days=8)},
            {'customer_name': 'Vikas Yadav', 'mobile_number': '9585836585', 'ivrs_number': 'IVRS123463', 'project_name': '5kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '5', 'status': 'New', 'priority': 'Medium', 'source': 'Walk-in', 'city': 'Ujjain', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today + timedelta(days=2)},
            {'customer_name': 'Kavita Rana', 'mobile_number': '8524567890', 'ivrs_number': 'IVRS123464', 'project_name': '7.5kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '7.5', 'status': 'Follow-up', 'priority': 'High', 'source': 'Campaign', 'city': 'Indore', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today + timedelta(days=2)},
            {'customer_name': 'Suresh Kumar', 'mobile_number': '7418529630', 'ivrs_number': 'IVRS123465', 'project_name': '5kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '5', 'status': 'Lost', 'priority': 'Low', 'source': 'Website', 'city': 'Gwalior', 'state': 'MP', 'assigned_to': neha_k, 'next_follow_up': today + timedelta(days=11)},
            {'customer_name': 'Ramesh Patidar', 'mobile_number': '9301234567', 'ivrs_number': 'IVRS123466', 'project_name': '10kW Hybrid', 'project_type': 'Hybrid', 'estimated_capacity': '10', 'status': 'Follow-up', 'priority': 'High', 'source': 'Referral', 'city': 'Bhopal', 'state': 'MP', 'assigned_to': vikram_p, 'next_follow_up': today - timedelta(days=1)},
            {'customer_name': 'Sunita Bhatt', 'mobile_number': '8109876543', 'ivrs_number': 'IVRS123467', 'project_name': '3kW Off-Grid', 'project_type': 'Off-Grid', 'estimated_capacity': '3', 'status': 'New', 'priority': 'Low', 'source': 'Walk-in', 'city': 'Ratlam', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today},
            {'customer_name': 'Lokesh Sharma', 'mobile_number': '9754321098', 'ivrs_number': 'IVRS123468', 'project_name': '7.5kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '7.5', 'status': 'Quotation', 'priority': 'High', 'source': 'Website', 'city': 'Indore', 'state': 'MP', 'assigned_to': neha_k, 'next_follow_up': today + timedelta(days=7)},
            {'customer_name': 'Geeta Verma', 'mobile_number': '7654321890', 'ivrs_number': 'IVRS123469', 'project_name': '5kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '5', 'status': 'Follow-up', 'priority': 'Medium', 'source': 'Referral', 'city': 'Ujjain', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today - timedelta(days=3)},
            {'customer_name': 'Anil Dubey', 'mobile_number': '8765432109', 'ivrs_number': 'IVRS123470', 'project_name': '15kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '15', 'status': 'New', 'priority': 'High', 'source': 'Campaign', 'city': 'Indore', 'state': 'MP', 'assigned_to': vikram_p, 'next_follow_up': today + timedelta(days=6)},
            {'customer_name': 'Priya Jain', 'mobile_number': '9812345670', 'ivrs_number': 'IVRS123471', 'project_name': '3kW Hybrid', 'project_type': 'Hybrid', 'estimated_capacity': '3', 'status': 'Follow-up', 'priority': 'Low', 'source': 'Walk-in', 'city': 'Bhopal', 'state': 'MP', 'assigned_to': neha_k, 'next_follow_up': today - timedelta(days=1)},
            {'customer_name': 'Vivek Chouhan', 'mobile_number': '7345678901', 'ivrs_number': 'IVRS123472', 'project_name': '20kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '20', 'status': 'Quotation', 'priority': 'High', 'source': 'Website', 'city': 'Jabalpur', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today + timedelta(days=12)},
            {'customer_name': 'Neelam Singh', 'mobile_number': '8234567012', 'ivrs_number': 'IVRS123473', 'project_name': '5kW Off-Grid', 'project_type': 'Off-Grid', 'estimated_capacity': '5', 'status': 'New', 'priority': 'Medium', 'source': 'Referral', 'city': 'Gwalior', 'state': 'MP', 'assigned_to': vikram_p, 'next_follow_up': today + timedelta(days=1)},
            {'customer_name': 'Dinesh Rawat', 'mobile_number': '9678901234', 'ivrs_number': 'IVRS123474', 'project_name': '10kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '10', 'status': 'Follow-up', 'priority': 'High', 'source': 'Campaign', 'city': 'Dewas', 'state': 'MP', 'assigned_to': neha_k, 'next_follow_up': today + timedelta(days=4)},
            {'customer_name': 'Meena Tiwari', 'mobile_number': '8901234567', 'ivrs_number': 'IVRS123475', 'project_name': '7.5kW Hybrid', 'project_type': 'Hybrid', 'estimated_capacity': '7.5', 'status': 'Lost', 'priority': 'Low', 'source': 'Walk-in', 'city': 'Indore', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today - timedelta(days=4)},
            {'customer_name': 'Harish Yadav', 'mobile_number': '7123456789', 'ivrs_number': 'IVRS123476', 'project_name': '5kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '5', 'status': 'New', 'priority': 'Medium', 'source': 'Referral', 'city': 'Ujjain', 'state': 'MP', 'assigned_to': vikram_p, 'next_follow_up': today + timedelta(days=9)},
            {'customer_name': 'Sarita Pandey', 'mobile_number': '9456789012', 'ivrs_number': 'IVRS123477', 'project_name': '3kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '3', 'status': 'Follow-up', 'priority': 'Low', 'source': 'Website', 'city': 'Bhopal', 'state': 'MP', 'assigned_to': neha_k, 'next_follow_up': today - timedelta(days=2)},
            {'customer_name': 'Manoj Mishra', 'mobile_number': '8567890123', 'ivrs_number': 'IVRS123478', 'project_name': '10kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '10', 'status': 'Quotation', 'priority': 'High', 'source': 'Campaign', 'city': 'Indore', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today + timedelta(days=10)},
            {'customer_name': 'Asha Kulkarni', 'mobile_number': '7890123456', 'ivrs_number': 'IVRS123479', 'project_name': '5kW Hybrid', 'project_type': 'Hybrid', 'estimated_capacity': '5', 'status': 'Won', 'priority': 'High', 'source': 'Referral', 'city': 'Dewas', 'state': 'MP', 'assigned_to': vikram_p, 'next_follow_up': today + timedelta(days=13)},
            {'customer_name': 'Vijay Singh', 'mobile_number': '9012345678', 'ivrs_number': 'IVRS123480', 'project_name': '20kW On-Grid', 'project_type': 'On-Grid', 'estimated_capacity': '20', 'status': 'Won', 'priority': 'High', 'source': 'Website', 'city': 'Indore', 'state': 'MP', 'assigned_to': rohit, 'next_follow_up': today + timedelta(days=14)},
        ]

        count = 0
        for ld in leads_data:
            if Lead.objects.filter(ivrs_number=ld['ivrs_number']).exists():
                continue
            next_fu = ld.pop('next_follow_up')
            Lead.objects.create(
                **ld,
                created_by=admin,
                next_follow_up=timezone.make_aware(timezone.datetime.combine(next_fu, timezone.datetime.min.time())),
            )
            count += 1
        self.stdout.write(f'  Leads: {count} created')

    # ─── Warehouses ──────────────────────────────────────────────────────────

    def _create_warehouses(self):
        from apps.inventory.models import Warehouse
        warehouses = [
            ('Indore Warehouse', 'Indore, MP'),
            ('Bhopal Warehouse', 'Bhopal, MP'),
            ('Ujjain Warehouse', 'Ujjain, MP'),
            ('Gwalior Warehouse', 'Gwalior, MP'),
        ]
        for name, location in warehouses:
            Warehouse.objects.get_or_create(name=name, defaults={'location': location})
        self.stdout.write(f'  Warehouses: {len(warehouses)} created/verified')

    # ─── Inventory ───────────────────────────────────────────────────────────

    def _create_inventory(self):
        from apps.inventory.models import InventoryItem, Warehouse

        indore = Warehouse.objects.filter(name='Indore Warehouse').first()
        bhopal = Warehouse.objects.filter(name='Bhopal Warehouse').first()
        ujjain = Warehouse.objects.filter(name='Ujjain Warehouse').first()
        gwalior = Warehouse.objects.filter(name='Gwalior Warehouse').first()

        items = [
            {'name': 'Solar Panel 550W', 'category': 'Solar Panel', 'unit': 'Nos', 'hsn_code': '85414011', 'rate': 18500, 'current_stock': 320, 'minimum_stock': 50, 'warehouse': indore},
            {'name': 'Solar Inverter 5kW', 'category': 'Inverter', 'unit': 'Nos', 'hsn_code': '85044090', 'rate': 45000, 'current_stock': 85, 'minimum_stock': 10, 'warehouse': indore},
            {'name': 'Solar Battery 100Ah', 'category': 'Battery', 'unit': 'Nos', 'hsn_code': '85072000', 'rate': 12000, 'current_stock': 60, 'minimum_stock': 15, 'warehouse': bhopal},
            {'name': 'Mounting Structure', 'category': 'Structure', 'unit': 'Set', 'hsn_code': '73089090', 'rate': 8500, 'current_stock': 450, 'minimum_stock': 80, 'warehouse': indore},
            {'name': 'DC Cable 6 sqmm', 'category': 'Cable & Wire', 'unit': 'Meter', 'hsn_code': '85444290', 'rate': 55, 'current_stock': 1200, 'minimum_stock': 200, 'warehouse': ujjain},
            {'name': 'MC4 Connector', 'category': 'ACDB/DCDB', 'unit': 'Nos', 'hsn_code': '85366990', 'rate': 120, 'current_stock': 500, 'minimum_stock': 600, 'warehouse': indore},
            {'name': 'ACDB Box', 'category': 'ACDB/DCDB', 'unit': 'Nos', 'hsn_code': '85369090', 'rate': 3500, 'current_stock': 15, 'minimum_stock': 20, 'warehouse': bhopal},
            {'name': 'Solar Panel 440W', 'category': 'Solar Panel', 'unit': 'Nos', 'hsn_code': '85414011', 'rate': 15500, 'current_stock': 0, 'minimum_stock': 50, 'warehouse': ujjain},
            {'name': 'Solar Inverter 10kW', 'category': 'Inverter', 'unit': 'Nos', 'hsn_code': '85044090', 'rate': 85000, 'current_stock': 42, 'minimum_stock': 8, 'warehouse': bhopal},
            {'name': 'Solar Battery 200Ah', 'category': 'Battery', 'unit': 'Nos', 'hsn_code': '85072000', 'rate': 22000, 'current_stock': 28, 'minimum_stock': 10, 'warehouse': indore},
            {'name': 'AC Cable 4 sqmm', 'category': 'Cable & Wire', 'unit': 'Meter', 'hsn_code': '85444290', 'rate': 42, 'current_stock': 850, 'minimum_stock': 150, 'warehouse': bhopal},
            {'name': 'Solar Charge Controller 60A', 'category': 'Other', 'unit': 'Nos', 'hsn_code': '85044090', 'rate': 6500, 'current_stock': 22, 'minimum_stock': 25, 'warehouse': ujjain},
            {'name': 'Earthing Kit', 'category': 'Other', 'unit': 'Set', 'hsn_code': '85319090', 'rate': 1800, 'current_stock': 180, 'minimum_stock': 30, 'warehouse': indore},
            {'name': 'Lightning Arrestor', 'category': 'Other', 'unit': 'Nos', 'hsn_code': '85319090', 'rate': 2200, 'current_stock': 6, 'minimum_stock': 10, 'warehouse': gwalior},
            {'name': 'Solar Panel 330W', 'category': 'Solar Panel', 'unit': 'Nos', 'hsn_code': '85414011', 'rate': 12000, 'current_stock': 0, 'minimum_stock': 50, 'warehouse': bhopal},
            {'name': 'DCDB Box', 'category': 'ACDB/DCDB', 'unit': 'Nos', 'hsn_code': '85369090', 'rate': 2800, 'current_stock': 35, 'minimum_stock': 10, 'warehouse': indore},
            {'name': 'Aluminium Wire 25 sqmm', 'category': 'Cable & Wire', 'unit': 'Meter', 'hsn_code': '85444290', 'rate': 85, 'current_stock': 600, 'minimum_stock': 100, 'warehouse': ujjain},
        ]
        count = 0
        for item in items:
            obj, created = InventoryItem.objects.get_or_create(name=item['name'], defaults=item)
            if created:
                count += 1
        self.stdout.write(f'  Inventory items: {count} created')

    # ─── Projects ────────────────────────────────────────────────────────────

    def _create_projects(self):
        from apps.accounts.models import User
        from apps.projects.models import Project

        rohit = User.objects.filter(name='Rohit Singh').first()
        neha_j = User.objects.filter(name='Neha Jain').first()
        amit = User.objects.filter(name='Amit Sharma').first()
        vikram_s = User.objects.filter(name='Vikram Singh').first()
        admin = User.objects.filter(is_superuser=True).first()

        from datetime import date
        projects = [
            {'project_name': '5kW On-Grid System', 'customer_name': 'Amit Sharma', 'site': 'Indore, MP', 'site_address': 'Indore, MP', 'project_type': 'On-Grid', 'status': 'Planning', 'manager': rohit, 'capacity_kwp': 5, 'progress_percent': 10, 'target_date': date(2026, 7, 25)},
            {'project_name': '10kW On-Grid System', 'customer_name': 'Sunil Patidar', 'site': 'Ujjain, MP', 'site_address': 'Ujjain, MP', 'project_type': 'On-Grid', 'status': 'Active', 'manager': neha_j, 'capacity_kwp': 10, 'progress_percent': 20, 'target_date': date(2026, 7, 28)},
            {'project_name': '3kW On-Grid System', 'customer_name': 'Kavita Joshi', 'site': 'Indore, MP', 'site_address': 'Indore, MP', 'project_type': 'On-Grid', 'status': 'Active', 'manager': amit, 'capacity_kwp': 3, 'progress_percent': 35, 'target_date': date(2026, 7, 30)},
            {'project_name': '15kW Hybrid System', 'customer_name': 'Manish Gupta', 'site': 'Dewas, MP', 'site_address': 'Dewas, MP', 'project_type': 'Hybrid', 'status': 'Active', 'manager': vikram_s, 'capacity_kwp': 15, 'progress_percent': 65, 'target_date': date(2026, 8, 5)},
            {'project_name': '10kW Off-Grid System', 'customer_name': 'Pooja Verma', 'site': 'Indore, MP', 'site_address': 'Indore, MP', 'project_type': 'Off-Grid', 'status': 'Active', 'manager': rohit, 'capacity_kwp': 10, 'progress_percent': 45, 'target_date': date(2026, 8, 8)},
            {'project_name': '5kW Hybrid System', 'customer_name': 'Ramesh Yadav', 'site': 'Ujjain, MP', 'site_address': 'Ujjain, MP', 'project_type': 'Hybrid', 'status': 'Active', 'manager': rohit, 'capacity_kwp': 5, 'progress_percent': 85, 'target_date': date(2026, 7, 10)},
            {'project_name': '20kW On-Grid System', 'customer_name': 'Vijay Singh', 'site': 'Indore, MP', 'site_address': 'Indore, MP', 'project_type': 'On-Grid', 'status': 'Completed', 'manager': rohit, 'capacity_kwp': 20, 'progress_percent': 100, 'target_date': date(2026, 6, 12)},
            {'project_name': '7.5kW On-Grid System', 'customer_name': 'Anjali Mehta', 'site': 'Dewas, MP', 'site_address': 'Dewas, MP', 'project_type': 'On-Grid', 'status': 'On Hold', 'manager': neha_j, 'capacity_kwp': 7.5, 'progress_percent': 30, 'target_date': date(2026, 8, 15)},
            {'project_name': '25kW On-Grid System', 'customer_name': 'Ramesh Patidar', 'site': 'Bhopal, MP', 'site_address': 'Bhopal, MP', 'project_type': 'On-Grid', 'status': 'Active', 'manager': vikram_s, 'capacity_kwp': 25, 'progress_percent': 60, 'target_date': date(2026, 8, 18)},
            {'project_name': '12kW Hybrid System', 'customer_name': 'Lokesh Sharma', 'site': 'Gwalior, MP', 'site_address': 'Gwalior, MP', 'project_type': 'Hybrid', 'status': 'Planning', 'manager': rohit, 'capacity_kwp': 12, 'progress_percent': 25, 'target_date': date(2026, 8, 20)},
        ]

        count = 0
        for pd in projects:
            if Project.objects.filter(project_name=pd['project_name'], customer_name=pd['customer_name']).exists():
                continue
            Project.objects.create(**pd, created_by=admin)
            count += 1
        self.stdout.write(f'  Projects: {count} created')
