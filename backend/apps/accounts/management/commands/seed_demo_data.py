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
        self._create_accounts_module()
        self._create_stock_movements()
        self._create_project_payments()
        self._create_om_data()
        self._create_amc_data()
        self._create_crm_settings()
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
                'Inventory': {'can_view': True, 'can_add': True, 'can_edit': True},
                'AMC & Warranty': {'can_view': True, 'can_add': True, 'can_edit': True},
            },
            'Team Leader': {
                'Leads': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Follow-ups': {'full_access': True},
                'Approvals': {'can_view': True},
                'Project Management': {'can_view': True, 'can_edit': True},
                'Dashboard': {'can_view': True},
                'Reports': {'can_view': True},
                'Inventory': {'can_view': True},
                'AMC & Warranty': {'can_view': True},
            },
            'Sales Executive': {
                'Leads': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Follow-ups': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Dashboard': {'can_view': True},
                'Reports': {'can_view': True},
                'Inventory': {'can_view': True},
                'AMC & Warranty': {'can_view': True},
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

    # ─── Accounts Module ─────────────────────────────────────────────────────

    def _create_accounts_module(self):
        from decimal import Decimal
        from apps.accounts.models import User
        from apps.accounts_module.models import Account, BankAccount, ChartOfAccount, Payment
        from apps.accounts_module.services import after_payment_saved, _default_accounts
        from apps.projects.models import Project

        admin = User.objects.filter(is_superuser=True).first()
        _default_accounts()

        parties = [
            ('Amit Sharma', 'Customer', 'Indore', '9876543210'),
            ('Sunil Patidar', 'Customer', 'Ujjain', '9123456780'),
            ('Malwa Industries Pvt. Ltd.', 'Customer', 'Ludhiana', '9876500001'),
            ('Sharma Textiles', 'Customer', 'Sangrur', '9876500002'),
            ('Tata Power Solar', 'Vendor', 'Mumbai', '9876500003'),
            ('Luminous Power', 'Vendor', 'Delhi', '9876500004'),
        ]
        party_objs = {}
        for name, ptype, city, phone in parties:
            obj, _ = Account.objects.get_or_create(
                name=name,
                defaults={
                    'account_type': ptype, 'city': city, 'phone': phone,
                    'opening_balance': Decimal('0'), 'balance': Decimal('0'), 'status': 'Active',
                },
            )
            party_objs[name] = obj

        banks = [
            ('Malwa Current A/C', 'HDFC Bank', '50200012345678', 'HDFC0001234', Decimal('250000')),
            ('Malwa Collection A/C', 'ICICI Bank', '123456789012', 'ICIC0000456', Decimal('180000')),
            ('Petty Cash', 'Cash in Hand', 'CASH-001', '', Decimal('15000')),
        ]
        bank_objs = []
        for acct_name, bank_name, acct_no, ifsc, opening in banks:
            obj, created = BankAccount.objects.get_or_create(
                account_number=acct_no,
                defaults={
                    'account_name': acct_name, 'bank_name': bank_name, 'ifsc': ifsc,
                    'opening_balance': opening, 'balance': opening, 'status': 'Active',
                },
            )
            bank_objs.append(obj)

        projects = list(Project.objects.all()[:5])
        payments_data = [
            ('Received', party_objs.get('Amit Sharma'), bank_objs[0], projects[0] if projects else None, Decimal('85000'), 'NEFT', 'Completed'),
            ('Received', party_objs.get('Sunil Patidar'), bank_objs[1], projects[1] if len(projects) > 1 else None, Decimal('120000'), 'UPI', 'Completed'),
            ('Received', party_objs.get('Malwa Industries Pvt. Ltd.'), bank_objs[0], projects[2] if len(projects) > 2 else None, Decimal('250000'), 'Cheque', 'Completed'),
            ('Made', party_objs.get('Tata Power Solar'), bank_objs[0], None, Decimal('450000'), 'NEFT', 'Completed'),
            ('Made', party_objs.get('Luminous Power'), bank_objs[1], None, Decimal('98000'), 'RTGS', 'Completed'),
            ('Received', party_objs.get('Sharma Textiles'), bank_objs[1], projects[3] if len(projects) > 3 else None, Decimal('65000'), 'Cash', 'Pending'),
        ]
        pay_count = 0
        today = date.today()
        for direction, party, bank, project, amount, mode, status in payments_data:
            if not party:
                continue
            ref = f'SEED-{direction[:3]}-{pay_count + 1:03d}'
            if Payment.objects.filter(reference_no=ref).exists():
                continue
            payment = Payment.objects.create(
                direction=direction, party=party, bank_account=bank, project=project,
                party_name=party.name, payment_date=today - timedelta(days=pay_count * 3),
                amount=amount, payment_mode=mode, reference_no=ref,
                status=status, description=f'Demo {direction.lower()} payment',
                created_by=admin,
            )
            after_payment_saved(payment)
            pay_count += 1
        self.stdout.write(f'  Accounts: {len(party_objs)} parties, {len(bank_objs)} banks, {pay_count} payments')

    # ─── Stock Movements ───────────────────────────────────────────────────────

    def _create_stock_movements(self):
        from apps.accounts.models import User
        from apps.inventory.models import InventoryItem, StockMovement, Warehouse

        admin = User.objects.filter(is_superuser=True).first()
        indore = Warehouse.objects.filter(name='Indore Warehouse').first()
        bhopal = Warehouse.objects.filter(name='Bhopal Warehouse').first()
        if not indore:
            return

        panel = InventoryItem.objects.filter(name='Solar Panel 550W').first()
        inverter = InventoryItem.objects.filter(name='Solar Inverter 5kW').first()
        if not panel:
            return

        movements = [
            (panel, 'Inward', 50, indore, None, 'PO-SEED-001'),
            (inverter, 'Inward', 10, indore, None, 'PO-SEED-002') if inverter else None,
            (panel, 'Outward', 5, None, indore, 'PRJ-OUT-001'),
        ]
        count = 0
        for row in movements:
            if not row:
                continue
            item, mtype, qty, to_wh, from_wh, ref = row
            if StockMovement.objects.filter(reference=ref).exists():
                continue
            StockMovement.objects.create(
                item=item, movement_type=mtype, quantity=qty,
                to_warehouse=to_wh, from_warehouse=from_wh,
                reference=ref, notes='Demo stock movement', created_by=admin,
            )
            count += 1
        self.stdout.write(f'  Stock movements: {count} created')

    # ─── Project Payments ────────────────────────────────────────────────────

    def _create_project_payments(self):
        from apps.accounts.models import User
        from apps.projects.models import Project, ProjectPayment
        from apps.accounts_module.services import sync_project_payment_to_accounts

        admin = User.objects.filter(is_superuser=True).first()
        projects = Project.objects.exclude(status='Cancelled')[:4]
        count = 0
        for i, project in enumerate(projects):
            ref = f'PP-SEED-{project.id:03d}'
            if ProjectPayment.objects.filter(reference=ref).exists():
                continue
            pp = ProjectPayment.objects.create(
                project=project,
                amount=50000 + (i * 25000),
                payment_mode='Bank Transfer' if i % 2 == 0 else 'UPI',
                payment_date=date.today() - timedelta(days=10 - i),
                reference=ref,
                notes=f'Demo project payment — {project.project_name}',
                created_by=admin,
            )
            sync_project_payment_to_accounts(pp, admin)
            count += 1
        self.stdout.write(f'  Project payments: {count} created')

    # ─── O&M ─────────────────────────────────────────────────────────────────

    def _create_om_data(self):
        from apps.accounts.models import User
        from apps.om.models import OmAsset, OmBreakdownTicket, OmMaintenanceTask, OmSiteVisit, OmSparePart
        from apps.projects.models import Project

        admin = User.objects.filter(is_superuser=True).first()
        projects = list(Project.objects.filter(status='Active')[:3])
        if not projects:
            return

        asset_count = 0
        for project in projects:
            if OmAsset.objects.filter(project=project, name=f'Inverter — {project.project_name}').exists():
                continue
            OmAsset.objects.create(
                name=f'Inverter — {project.project_name}',
                asset_type='Inverter', project=project, site=project.site or '',
                manufacturer='Growatt', status='Operational',
                installed_on=date.today() - timedelta(days=90),
                created_by=admin,
            )
            asset_count += 1

        tasks = [
            (projects[0], 'Quarterly Panel Cleaning', 'Preventive', 'Pending'),
            (projects[1], 'Inverter Firmware Update', 'Corrective', 'In Progress'),
            (projects[2] if len(projects) > 2 else projects[0], 'Annual Maintenance', 'Preventive', 'Completed'),
        ]
        task_count = 0
        for project, title, ttype, status in tasks:
            if OmMaintenanceTask.objects.filter(project=project, title=title).exists():
                continue
            OmMaintenanceTask.objects.create(
                title=title, project=project, site=project.site or '',
                task_type=ttype, priority='Medium', status=status,
                due_date=date.today() + timedelta(days=7), engineer='Amit Verma',
                created_by=admin,
            )
            task_count += 1

        ticket_count = 0
        asset = OmAsset.objects.first()
        if asset and not OmBreakdownTicket.objects.filter(subject='Low generation alert').exists():
            OmBreakdownTicket.objects.create(
                subject='Low generation alert', project=asset.project, asset=asset,
                site=asset.site, priority='High', status='Open',
                issue_description='Generation dropped 20% vs last month',
                created_by=admin,
            )
            ticket_count += 1

        visit_count = 0
        if not OmSiteVisit.objects.filter(project=projects[0], purpose='Preventive check').exists():
            OmSiteVisit.objects.create(
                project=projects[0], site=projects[0].site or '',
                purpose='Preventive check', engineer='Rohit Sharma',
                date=date.today() + timedelta(days=3), status='Scheduled',
                created_by=admin,
            )
            visit_count += 1

        spare_count = 0
        if not OmSparePart.objects.filter(name='MC4 Connector Pair').exists():
            OmSparePart.objects.create(
                name='MC4 Connector Pair', category='Electrical',
                stock_qty=50, min_stock=20, supplier='Local Vendor',
                created_by=admin,
            )
            spare_count += 1

        self.stdout.write(f'  O&M: {asset_count} assets, {task_count} tasks, {ticket_count} tickets, {visit_count} visits, {spare_count} spare parts')

    # ─── AMC & Warranty ──────────────────────────────────────────────────────

    def _create_amc_data(self):
        from decimal import Decimal
        from apps.accounts.models import User
        from apps.amc.models import (
            AmcClaim, AmcContract, AmcRenewal, AmcServiceRequest, AmcVisit, AmcWarranty,
        )
        from apps.projects.models import Project

        admin = User.objects.filter(is_superuser=True).first()
        projects = list(Project.objects.filter(status__in=['Active', 'Completed'])[:5])
        if not projects:
            return

        contracts = []
        for i, project in enumerate(projects[:4]):
            customer = project.customer_name
            if AmcContract.objects.filter(project=project, customer_name=customer).exists():
                contracts.append(AmcContract.objects.get(project=project, customer_name=customer))
                continue
            c = AmcContract.objects.create(
                project=project, customer_name=customer,
                site=project.site or '', contract_type='Comprehensive' if i % 2 == 0 else 'Non-Comprehensive',
                start_date=date.today() - timedelta(days=120),
                end_date=date.today() + timedelta(days=245),
                annual_value=Decimal('15000') + Decimal(i * 5000),
                status='Active' if i < 3 else 'Expiring Soon',
                next_renewal_date=date.today() + timedelta(days=245),
                created_by=admin,
            )
            contracts.append(c)

        war_count = 0
        for project in projects[:3]:
            if AmcWarranty.objects.filter(project=project, asset_type='Solar Inverter').exists():
                continue
            AmcWarranty.objects.create(
                project=project, asset_type='Solar Inverter',
                manufacturer='Growatt', serial_number=f'GRW-{project.id:04d}',
                warranty_start=date.today() - timedelta(days=365),
                warranty_end=date.today() + timedelta(days=730),
                status='Active', coverage_details='5-year inverter warranty',
                created_by=admin,
            )
            war_count += 1

        sr_count = 0
        if contracts and not AmcServiceRequest.objects.filter(subject='Annual maintenance due').exists():
            AmcServiceRequest.objects.create(
                project=contracts[0].project, contract=contracts[0],
                subject='Annual maintenance due', priority='Medium', status='Open',
                requested_date=date.today(), assigned_engineer='Amit Verma',
                description='Schedule preventive maintenance visit',
                created_by=admin,
            )
            sr_count += 1

        visit_count = 0
        if contracts and not AmcVisit.objects.filter(project=contracts[0].project, visit_type='Preventive').exists():
            AmcVisit.objects.create(
                project=contracts[0].project, visit_date=date.today() + timedelta(days=5),
                engineer='Rohit Sharma', visit_type='Preventive', status='Scheduled',
                findings='', created_by=admin,
            )
            visit_count += 1

        renewal_count = 0
        if contracts and not AmcRenewal.objects.filter(contract=contracts[0]).exists():
            AmcRenewal.objects.create(
                contract=contracts[0], renewal_date=date.today() + timedelta(days=30),
                new_end_date=date.today() + timedelta(days=395),
                amount=Decimal('18000'), status='Pending', created_by=admin,
            )
            renewal_count += 1

        claim_count = 0
        warranty = AmcWarranty.objects.first()
        if warranty and not AmcClaim.objects.filter(warranty=warranty).exists():
            AmcClaim.objects.create(
                project=warranty.project, warranty=warranty,
                claim_date=date.today() - timedelta(days=5),
                claim_amount=Decimal('12000'), status='Under Review',
                description='Inverter replacement under warranty',
                created_by=admin,
            )
            claim_count += 1

        self.stdout.write(
            f'  AMC: {len(contracts)} contracts, {war_count} warranties, {sr_count} requests, '
            f'{visit_count} visits, {renewal_count} renewals, {claim_count} claims'
        )

    def _create_crm_settings(self):
        from apps.crm_settings.services import seed_setting_defaults
        from apps.crm_settings.models import CompanyProfile, PaymentMode

        profile = CompanyProfile.get_solo()
        if not profile.data:
            profile.data = {
                'companyName': 'Malwa Solar Energy Pvt. Ltd.',
                'companyType': 'Private Limited',
                'gstNumber': '23AAGCM1234A1Z5',
                'panNumber': 'AAGCM1234A',
                'phone': '+91 98765 43210',
                'email': 'info@malwasolar.com',
                'website': 'https://www.malwasolar.com',
                'city': 'Indore',
                'state': 'Madhya Pradesh',
                'country': 'India',
                'currency': 'INR (Rs)',
                'timezone': '(GMT +05:30) Asia/Kolkata',
            }
            profile.save()

        seed_setting_defaults()
        pm_count = PaymentMode.objects.count()
        self.stdout.write(f'  CRM Settings: seeded categories, {pm_count} payment modes, masters, FY, IP rules')

