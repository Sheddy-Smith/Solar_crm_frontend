# Malwa Solar CRM — Solar Project Data Flow

> **Based on:** `CRM_MODULE_DATAFLOW.md` (Malwa CRM v2 blueprint)  
> **Adapted for:** Solar EPC lifecycle — Lead → Quotation → Project → Dispatch → Installation → Billing  
> **Backend:** Django REST + PostgreSQL | **Frontend:** React (Vite)

---

## 1. Module Mapping (Workshop CRM → Solar EPC)

| MD Module | Solar CRM Module | Django / UI |
|-----------|------------------|-------------|
| **Jobs** (central) | **Project** | `projects.Project`, Project Management sidebar |
| **Customer** | **Customer / Lead** | `leads.Lead` + `accounts.Account(Customer)` |
| **Supplier** | **Supplier** (material) | `Account(Supplier)`, `supplierPages.jsx` |
| **Vendor** | **Vendor** (service/subcontract) | `Account(Vendor)`, `vendorPages.jsx` |
| **Employee / Labour** | **Workforce** | `workforce.Employee`, `EmployeeVoucher` |
| **Inventory** | **Inventory** | `inventory.InventoryItem`, `StockMovement` |
| **Accounts** | **Accounts** | Purchase/Sell Invoice, Challan, Voucher, GST |

### Rule: Vendor ≠ Supplier (MD §3 Rule 4)

| | **Vendor** | **Supplier** |
|---|-----------|--------------|
| Deta hai | Installation subcontract, transport service | Panels, inverters, cables |
| Stock IN | ❌ | ✅ Purchase Invoice / Challan |
| Ledger file | `vendor_ledger.py` | `supplier_ledger.py` |
| AP bucket | Service vouchers + payments | Purchase + GRN + payments |

---

## 2. Solar Project Lifecycle (Jobs → Project)

```
Lead (Hot/Warm)
    │
    ▼
Site Survey ──────────────► LeadSiteSurvey → (Won) → Project SiteSurvey
    │
    ▼
Quotation ────────────────► Quotation.grand_total → Project.total_value (on Won)
    │
    ▼
Lead Status = Won ────────► Auto-create Project + Customer Account
    │
    ├──► Material Planning (BOM)
    ├──► Material Dispatch ──► Stock OUT (Jobs) + Material Cost Voucher
    ├──► Installation (Tasks / QA / Materials)
    ├──► Project Expenses ───► Accounts PaymentVoucher + Journal
    ├──► Employee Voucher ───► Labour COA + PaymentVoucher
    │
    ▼
Sell Invoice / Project Payment ──► Customer Ledger + AR Journal
    │
    ▼
Subsidy / Liaisoning / Commissioning (parallel tracks)
```

---

## 3. Golden Rules (Implemented)

| Rule | Implementation |
|------|----------------|
| `stock_movements` = audit trail | Every IN/OUT creates/updates `StockMovement` |
| `inventory_items.current_stock` | Updated only inside `StockMovement.save()` |
| Atomic backend sync | `@transaction.atomic` on challan/invoice stock sync |
| Double-entry journal | `Transaction` model (Dr/Cr) via `sync_journal_for_*` |
| Party balance | `recalculate_party_balance()` after invoices/payments |
| Reference linking | `reference_type` + `reference_no` on movements |

---

## 4. Transaction Flows — Solar Context

### 4.1 Purchase Invoice (Supplier → Stock IN → AP)

**UI:** Accounts → Purchase Invoice  
**Trigger:** Status = `Recorded` or `Paid`

| Step | What happens |
|------|----------------|
| 1 | Save `PurchaseInvoice` + lines (with `inventory_item`) |
| 2 | `sync_inventory_for_purchase_invoice()` → StockMovement **IN** |
| 3 | `inventory_items.current_stock` ↑ via movement |
| 4 | `sync_journal_for_invoice()` → Dr **1200 Inventory** / Cr **2110 AP** |
| 5 | `supplier_ledger` credit + `recalculate_party_balance()` |

**Solar example:** Tata Power panel purchase 50 Nos → stock IN → supplier payable ↑

---

### 4.2 Purchase Challan / GRN

**UI:** Accounts → Purchase Challan  
**Trigger:** Status = `Received`

Same as PI but challan-based receipt. Used when material arrives before tax invoice.

---

### 4.3 Material Dispatch (Project → Stock OUT)

**UI:** Project Management → Dispatch  
**Trigger:** Save dispatched qty > 0 with inventory product

| Step | What happens |
|------|----------------|
| 1 | `MaterialPlan` update |
| 2 | `dispatch_sync.py` → StockMovement **OUT**, ref `Jobs` |
| 3 | `project_financial_sync` → Material cost voucher at **inventory rate** |

**Solar example:** 5kWp project — 12 panels dispatched to site → stock ↓, project cost ↑

---

### 4.4 Sell Invoice (Customer billing → Stock OUT)

**UI:** Accounts → Sell Invoice (link `project`)  
**Trigger:** Status = `Issued` or `Paid`

| Step | What happens |
|------|----------------|
| 1 | Save `SellInvoice` + lines |
| 2 | `sync_inventory_for_sell_invoice()` → StockMovement **OUT** |
| 3 | `sync_journal_for_invoice()` → Dr **1130 AR** / Cr **4100 Sales** |
| 4 | `customer_ledger` debit + balance recalc |

---

### 4.5 Sell Challan

**UI:** Accounts → Sell Challan  
**Trigger:** `Dispatched` / `Delivered` → Stock OUT (site delivery without invoice yet)

---

### 4.6 Project Payment (Customer receipt)

**UI:** Project Details → Payments  
**Flow:** `ProjectPayment` → `Payment(Received)` → Dr Cash / Cr **1130 AR** → Customer ledger credit

---

### 4.7 Project Expense

**UI:** Project Management → Expenses  
**Flow:** `ProjectExpense(Paid)` → `PaymentVoucher` → Journal Dr expense COA (Transport 5320, Labour 5310, etc.)

---

### 4.8 Employee Voucher (Labour)

**UI:** Workforce → Voucher  
**Flow:** `EmployeeVoucher` → `PaymentVoucher(Labour)` → Dr **5310 Direct Labour** / Cr Cash

---

## 5. Cross-Module Map (Solar)

```
                    ┌──────────────┐
                    │   PROJECT    │  ← central (was Jobs)
                    │  (Won Lead)  │
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  CUSTOMER  │  │  SUPPLIER  │  │   VENDOR   │
    │  (Lead/Acc)│  │ (material) │  │ (service)  │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │               │               │
          ▼               ▼               ▼
    Sell Invoice     Purchase Inv      Service Voucher
    Project Payment  Purchase Challan  Vendor Payment
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                  ┌───────────────┐
                  │   ACCOUNTS    │
                  │ Journal / GST │
                  └───────┬───────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
       ┌────────────┐           ┌────────────┐
       │ INVENTORY  │◄──────────│  SUPPLIER  │
       │stock_move  │  Stock IN │  purchases │
       └────────────┘           └────────────┘
              ▲
              │ Stock OUT
       ┌──────┴───────┐
       │  DISPATCH /  │
       │ SELL CHALLAN │
       └──────────────┘
```

---

## 6. reference_type Cheat Sheet

| reference_type | Direction | Solar trigger |
|----------------|-----------|---------------|
| `Purchase Invoice` | IN | Supplier purchase recorded |
| `Purchase Challan` | IN | GRN received |
| `Sell Invoice` | OUT | Customer invoice issued |
| `Sell Challan` | OUT | Site delivery challan |
| `Jobs` | OUT | Project material dispatch |
| `Opening Stock` | IN | New product opening qty |
| `Manual` | IN/OUT | Inventory adjustment |

---

## 7. Key Backend Files

| Flow | File |
|------|------|
| Purchase/Sell stock sync | `accounts_module/document_services.py` |
| Invoice/challan API hooks | `accounts_module/document_views.py` |
| Journals & balances | `accounts_module/services.py` |
| Supplier ledger | `accounts_module/supplier_ledger.py` |
| Vendor ledger | `accounts_module/vendor_ledger.py` |
| Customer ledger | `accounts_module/customer_ledger.py` |
| Project dispatch stock | `inventory/dispatch_sync.py` |
| Project cost sync | `accounts_module/project_financial_sync.py` |
| Won lead → project | `leads/models.py` → `create_project_for_won_lead` |
| Material plan sync | `projects/serializers.py` → `MaterialPlanSerializer` |

---

## 8. Key Frontend Files

| Module | File |
|--------|------|
| Accounts documents | `src/accountsSolarPages.jsx` |
| Project Dispatch/Install/Expenses | `src/projectOpsPages.jsx` |
| Customer / Vendor / Supplier | `customerPages.jsx`, `vendorPages.jsx`, `supplierPages.jsx` |
| Inventory | `src/inventoryPages.jsx` |

---

*Last updated: 2026-09-01 — aligned with CRM_MODULE_DATAFLOW.md for Malwa Solar EPC CRM*
