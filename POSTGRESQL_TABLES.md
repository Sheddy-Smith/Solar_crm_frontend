# Malwa Solar CRM — PostgreSQL Tables (pehle se bani hui)

**Last verified:** 17 July 2026  
**Live DB:** Hostinger VPS `200.97.171.119`  
**Database name:** `malwa_crm`  
**Engine:** PostgreSQL  
**Total tables:** **102**

---

## 1. Important — tables kab banti hain?

| Kab | Kya hota hai |
|-----|----------------|
| Deploy / setup | `python manage.py migrate` → **saari tables pehle se ban jaati hain** |
| User UI pe data bharta hai | Naya table **nahi** banta → existing table me **naya row (INSERT)** |
| Frontend / backend rebuild | Tables **same rehti** hain (DB alag hai) |

```
UI form → API → Django model → PostgreSQL table (already exists) → row save
```

Yeh file un **pehle se bani hui** tables ki list hai jo live `malwa_crm` DB me maujood hain.

---

## 2. Connection (live)

| Item | Value |
|------|--------|
| Host | `127.0.0.1` (VPS ke andar) |
| Port | `5432` |
| DB | `malwa_crm` |
| User | `malwa` |
| App setting | `/var/www/malwa-crm/backend/.env` → `DATABASE_URL=...` |

**PC pe ye live data nahi hota.** Local testing alag DB use karti hai.

---

## 3. Module-wise tables

### 3.1 Accounts / Users / Roles (`apps.accounts`)

| Table | Approx rows (verify time) | Purpose |
|-------|---------------------------|---------|
| `accounts_user` | 1 | Login users (Super Admin, staff…) |
| `accounts_role` | 7 | Roles (Super Admin, Sales Executive…) |
| `accounts_rolepermission` | 72 | Module permissions per role |
| `accounts_branch` | 1 | Branches (e.g. Head Office) |
| `accounts_user_groups` | 0 | Django groups M2M |
| `accounts_user_user_permissions` | 0 | Django permissions M2M |

**UI link:** Settings → Users / Roles

---

### 3.2 Leads / Follow-ups / Quotations (`apps.leads`)

| Table | Purpose |
|-------|---------|
| `leads_lead` | Main leads |
| `leads_followup` | Follow-up history / reminders |
| `leads_quotation` | Quotations |
| `leads_quotationitem` | Quotation line items |
| `leads_adminapproval` | Admin approvals |
| `leads_leadsitesurvey` | Lead site survey |
| `leads_leadsurveyphoto` | Survey photos |
| `leads_leadsequencecounter` | Lead number sequence |

**UI link:** Lead, Follow-ups, Quotation

---

### 3.3 Projects (`apps.projects`)

| Table | Purpose |
|-------|---------|
| `projects_project` | Projects |
| `projects_projectactivity` | Activity log |
| `projects_projectnote` | Notes |
| `projects_projectdocument` | Documents |
| `projects_projectexpense` | Expenses |
| `projects_projectexpensedocument` | Expense docs |
| `projects_projectpayment` | Payments |
| `projects_workorder` | Work orders |
| `projects_projectteammember` | Team members |
| `projects_projectsystemconfig` | System config |
| `projects_projectmilestone` | Milestones |
| `projects_sitesurvey` | Site survey |
| `projects_sitesurveyphoto` | Survey photos |
| `projects_projectchecklistitem` | Checklist |
| `projects_installationmaterial` | Installation materials |
| `projects_materialplan` | Material plan |
| `projects_subsidyapplication` | Subsidy application |
| `projects_subsidydocument` | Subsidy docs |
| `projects_projectapproval` | Approvals |
| `projects_projectapprovaldocument` | Approval docs |
| `projects_sequencecounter` | Project number sequence |

**UI link:** Project Management

---

### 3.4 Liaisoning & Commissioning (`apps.liaisoning`)

| Table | Purpose |
|-------|---------|
| `liaisoning_liaisonapplication` | Applications |
| `liaisoning_liaisonapproval` | Approvals |
| `liaisoning_liaisoninspection` | Inspections |
| `liaisoning_liaisoncommissioning` | Commissioning |
| `liaisoning_liaisoncompliance` | Compliance |
| `liaisoning_liaisondocument` | Documents |

---

### 3.5 O&M (`apps.om`)

| Table | Purpose |
|-------|---------|
| `om_omasset` | Assets |
| `om_ommaintenancetask` | Maintenance tasks |
| `om_ombreakdownticket` | Breakdown tickets |
| `om_omsitevisit` | Site visits |
| `om_omsparepart` | Spare parts |
| `om_omreport` | Reports |
| `om_omdocument` | Documents |

---

### 3.6 AMC & Warranty (`apps.amc`)

| Table | Purpose |
|-------|---------|
| `amc_amccontract` | AMC contracts |
| `amc_amcwarranty` | Warranties |
| `amc_amcservicerequest` | Service requests |
| `amc_amcvisit` | Visits |
| `amc_amcrenewal` | Renewals |
| `amc_amcclaim` | Claims |
| `amc_amcdocument` | Documents |

---

### 3.7 Inventory (`apps.inventory`)

| Table | Approx rows | Purpose |
|-------|-------------|---------|
| `inventory_inventorycategory` | 9 | Categories |
| `inventory_inventoryitem` | 0 | Items / stock |
| `inventory_stockmovement` | 0 | Stock in/out |
| `inventory_warehouse` | 0 | Warehouses |

---

### 3.8 Accounts module — finance (`apps.accounts_module`)

| Table | Purpose |
|-------|---------|
| `accounts_module_chartofaccount` | Chart of accounts |
| `accounts_module_account` | Accounts |
| `accounts_module_bankaccount` | Bank accounts |
| `accounts_module_payment` | Payments |
| `accounts_module_cheque` | Cheques |
| `accounts_module_transaction` | Transactions |
| `accounts_module_purchaseinvoice` | Purchase invoices |
| `accounts_module_purchaseinvoiceline` | Purchase lines |
| `accounts_module_purchaseinvoiceextracharge` | Extra charges |
| `accounts_module_sellinvoice` | Sell invoices |
| `accounts_module_sellinvoiceline` | Sell lines |
| `accounts_module_paymentvoucher` | Payment vouchers |
| `accounts_module_purchasechallan` | Purchase challans |
| `accounts_module_purchasechallanline` | Purchase challan lines |
| `accounts_module_sellchallan` | Sell challans |
| `accounts_module_sellchallanline` | Sell challan lines |
| `accounts_module_gstopeningbalance` | GST opening balance |

---

### 3.9 Workforce / Employees (`apps.workforce`)

| Table | Purpose |
|-------|---------|
| `workforce_employee` | Employees |
| `workforce_employeeassignment` | Assignments |
| `workforce_employeedocument` | Documents |
| `workforce_employeeattendance` | Attendance |
| `workforce_employeevoucher` | Vouchers |
| `workforce_employeeidcounter` | Employee ID sequence |

---

### 3.10 Daily Tasks (`apps.daily_tasks`)

| Table | Purpose |
|-------|---------|
| `daily_tasks_dailytask` | Daily tasks |

---

### 3.11 CRM Settings (`apps.crm_settings`)

| Table | Approx rows | Purpose |
|-------|-------------|---------|
| `crm_settings_companyprofile` | 1 | Company profile |
| `crm_settings_appsetting` | 0 | App settings |
| `crm_settings_paymentmode` | 0 | Payment modes |
| `crm_settings_masterrecord` | 0 | Masters |
| `crm_settings_financialyear` | 0 | Financial years |
| `crm_settings_useractivitylog` | 18 | Activity log |
| `crm_settings_ipaccessrule` | 0 | IP allow/block rules |
| `crm_settings_ipblockedattempt` | 0 | Blocked attempts |
| `crm_settings_documentnumberseries` | 0 | Doc number series |
| `crm_settings_systembackuplog` | 0 | Backup logs |

---

### 3.12 Django / Auth system tables

| Table | Purpose |
|-------|---------|
| `django_migrations` | Migration history (105 applied) |
| `django_content_type` | Content types |
| `django_admin_log` | Admin actions |
| `django_session` | Sessions |
| `auth_group` | Auth groups |
| `auth_group_permissions` | Group permissions |
| `auth_permission` | Permissions |
| `token_blacklist_outstandingtoken` | JWT outstanding tokens |
| `token_blacklist_blacklistedtoken` | Blacklisted JWTs |

---

## 4. Full alphabetical list (102)

```
accounts_branch
accounts_module_account
accounts_module_bankaccount
accounts_module_chartofaccount
accounts_module_cheque
accounts_module_gstopeningbalance
accounts_module_payment
accounts_module_paymentvoucher
accounts_module_purchasechallan
accounts_module_purchasechallanline
accounts_module_purchaseinvoice
accounts_module_purchaseinvoiceextracharge
accounts_module_purchaseinvoiceline
accounts_module_sellchallan
accounts_module_sellchallanline
accounts_module_sellinvoice
accounts_module_sellinvoiceline
accounts_module_transaction
accounts_role
accounts_rolepermission
accounts_user
accounts_user_groups
accounts_user_user_permissions
amc_amcclaim
amc_amccontract
amc_amcdocument
amc_amcrenewal
amc_amcservicerequest
amc_amcvisit
amc_amcwarranty
auth_group
auth_group_permissions
auth_permission
crm_settings_appsetting
crm_settings_companyprofile
crm_settings_documentnumberseries
crm_settings_financialyear
crm_settings_ipaccessrule
crm_settings_ipblockedattempt
crm_settings_masterrecord
crm_settings_paymentmode
crm_settings_systembackuplog
crm_settings_useractivitylog
daily_tasks_dailytask
django_admin_log
django_content_type
django_migrations
django_session
inventory_inventorycategory
inventory_inventoryitem
inventory_stockmovement
inventory_warehouse
leads_adminapproval
leads_followup
leads_lead
leads_leadsequencecounter
leads_leadsitesurvey
leads_leadsurveyphoto
leads_quotation
leads_quotationitem
liaisoning_liaisonapplication
liaisoning_liaisonapproval
liaisoning_liaisoncommissioning
liaisoning_liaisoncompliance
liaisoning_liaisondocument
liaisoning_liaisoninspection
om_omasset
om_ombreakdownticket
om_omdocument
om_ommaintenancetask
om_omreport
om_omsitevisit
om_omsparepart
projects_installationmaterial
projects_materialplan
projects_project
projects_projectactivity
projects_projectapproval
projects_projectapprovaldocument
projects_projectchecklistitem
projects_projectdocument
projects_projectexpense
projects_projectexpensedocument
projects_projectmilestone
projects_projectnote
projects_projectpayment
projects_projectsystemconfig
projects_projectteammember
projects_sequencecounter
projects_sitesurvey
projects_sitesurveyphoto
projects_subsidyapplication
projects_subsidydocument
projects_workorder
token_blacklist_blacklistedtoken
token_blacklist_outstandingtoken
workforce_employee
workforce_employeeassignment
workforce_employeeattendance
workforce_employeedocument
workforce_employeeidcounter
workforce_employeevoucher
```

---

## 5. Naming rule (samajhne ke liye)

Django table name ≈:

```
{app_label}_{modelname_lowercase}
```

Examples:

| Model (code) | Table |
|--------------|--------|
| `leads.Lead` | `leads_lead` |
| `leads.FollowUp` | `leads_followup` |
| `accounts.User` | `accounts_user` |
| `projects.Project` | `projects_project` |

---

## 6. VPS pe khud check kaise karein

```bash
ssh -i ~/.ssh/id_ed25519_lab root@200.97.171.119

sudo -u postgres psql -d malwa_crm -c "\dt"
sudo -u postgres psql -d malwa_crm -c "SELECT count(*) FROM leads_lead;"
sudo -u postgres psql -d malwa_crm -c "SELECT id, email FROM accounts_user;"
```

---

## 7. Yaad rakhne wali baatein

1. **102 tables pehle se bani hain** — user fill se naya table nahi banta.  
2. UI pe data = **row insert/update** in these tables.  
3. Tables **VPS PostgreSQL `malwa_crm`** me rehti hain — PC / Hostinger MySQL panel alag cheez hai.  
4. Naya module / naya field code me add ho to naya `migrate` chahiye — tabhi nayi table / column banegi.

---

*Related:* `DEPLOYMENT_POER_IN_FULL.md`, `VPS_DUAL_APP_SEPARATION.md`
