# Malwa CRM — Module Data Flow Guide

> **Purpose:** Is document ko use karke aap kisi bhi naye CRM mein **same data flow** implement kar sakte ho.  
> **Source:** `MT_crm` codebase analysis (Customer, Vendor, Employee, Supplier, Inventory, Accounts)  
> **Version:** Based on Malwa CRM v2.0.0 (Option B architecture)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Entity Definitions](#2-entity-definitions)
3. [Core Design Rules](#3-core-design-rules)
4. [Master Data Flows](#4-master-data-flows)
5. [Transaction Flows (Step-by-Step)](#5-transaction-flows-step-by-step)
6. [Cross-Module Integration Map](#6-cross-module-integration-map)
7. [Ledger & Balance Rules](#7-ledger--balance-rules)
8. [Journal Entry Patterns](#8-journal-entry-patterns)
9. [Stock Movement Rules](#9-stock-movement-rules)
10. [Jobs Workflow Integration](#10-jobs-workflow-integration)
11. [Sync & Storage Architecture](#11-sync--storage-architecture)
12. [Implementation Checklist (New CRM)](#12-implementation-checklist-new-crm)

---

## 1. System Overview

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  React UI   │ ──► │ Zustand Store│ ──► │ Module      │ ──► │ Database     │
│  (Pages)    │     │ (State)      │     │ Helpers     │     │ (IndexedDB / │
└─────────────┘     └──────────────┘     └──────────────┘     │  MySQL)      │
                                              │                  └──────────────┘
                                              ▼
                                    ┌──────────────────┐
                                    │ Atomic Transaction│
                                    │ (All-or-nothing)  │
                                    └──────────────────┘
```

### Data Flow Pattern (Har transaction ke liye)

```
UI Input
  → Validation (required fields, duplicates, stock check)
  → Calculate amounts (subtotal, GST, total)
  → Prepare records (header + line items + ledger + journal + stock)
  → ATOMIC DB Transaction (sab ek saath save ya kuch nahi)
  → Recalculate party balance
  → Queue sync operation (offline/online)
  → Broadcast UI update
```

### Module List

| UI Name   | Code/Store Name | Business Role                          |
|-----------|-----------------|----------------------------------------|
| Customer  | `customers`     | End customer / lead (vehicle owner)    |
| Vendor    | `vendors`       | **Service provider** (painting, welding) |
| Employee  | `labour`        | **Technician / worker / contractor**   |
| Supplier  | `suppliers`     | **Material provider** (parts, paint)   |
| Inventory | `inventory_items` | Stock items & categories             |
| Accounts  | `purchases`, `invoices`, `vouchers`, `journal_*` | Financial transactions |

---

## 2. Entity Definitions

### 2.1 Customer

**Kya hai:** Workshop ka end customer ya lead.

**Key Fields:**
```
id, name, phone, email, company, address, gstin, pan
type: 'customer' | 'lead'
credit_limit, credit_days
opening_balance, current_balance
vehicles[] (JSON array)
status: 'active' | 'inactive'
```

**Related Tables:**
- `customer_ledger_entries` — financial transactions
- `customer_jobs` — linked jobs
- `invoices`, `cash_receipts`, `receipts` — billing
- `documents` — uploaded files

---

### 2.2 Vendor (Service Provider)

**Kya hai:** Bahar se service deta hai (painting, welding, mechanical work). **Material supplier NAHI.**

**Key Fields:**
```
id, code (VEN-0001), name, phone, company, address, gstin, pan
serviceType, vendorType, serviceCategories[]
opening_balance, current_balance, credit_limit
status: 'active'
```

**Related Tables:**
- `vendor_ledger_entries`
- `vendor_orders`, `vendor_invoices`, `vendor_invoice_items`
- `service_orders`

---

### 2.3 Employee (Labour)

**Kya hai:** In-house technician ya contractor worker. UI mein "Employee", code mein `labour`.

**Key Fields:**
```
id, code, name, phone, address, aadhaar_number
skill_type, designation
hourly_rate, daily_rate
is_contractor: boolean
vendor_id (if contractor linked to vendor)
opening_balance, current_balance
status: 'active'
```

**Related Tables:**
- `labour_ledger_entries`
- `labour_attendance`, `weekly_balances`
- `jobsheets` (via technicianId)

---

### 2.4 Supplier (Material Provider)

**Kya hai:** Parts, paint, steel, hardware supplier. **Service vendor NAHI.**

**Key Fields:**
```
id, code (SUP-0001), name, phone, company, address, gstin
category, productCategories[]
opening_balance, current_balance, credit_limit
status: 'active'
```

**Related Tables:**
- `supplier_ledger_entries`
- `supplier_products`
- `purchases`, `purchase_items`, `purchase_challans`

---

### 2.5 Inventory

**Kya hai:** Stock items aur categories.

**Key Tables:**
```
inventory_categories  → id, name, description, parent_id
inventory_items       → id, code, name, material_name, category_id
                        unit, current_stock, min_stock
                        cost_price, selling_price, hsn_code
stock_movements       → id, item_id, movement_type (in|out|adjustment)
                        quantity, reference_type, reference_id, date
stock_transactions    → id, productId, referenceType, referenceId, qty
products              → (legacy/financial product catalog)
```

---

### 2.6 Accounts

**Kya hai:** Saari financial transactions — purchases, sales, vouchers, GST, journal.

**Key Tables:**
```
accounts              → Chart of accounts (id, code, type, parentId, name)
purchases             → Purchase invoices from suppliers
purchase_items        → Line items
invoices              → Sales invoices to customers
invoice_items         → Line items
vouchers              → Payment/receipt vouchers
journal_entries       → Double-entry header
journal_lines         → Debit/credit lines
gst_ledger / gstledger → GST input/output tracking
purchase_challans     → GRN (Goods Receipt Note)
sell_challans         → Delivery challans
cash_receipts         → Customer cash receipts
payments              → All payment records
```

---

## 3. Core Design Rules

### Rule 1: Atomic Transactions
Har financial/stock operation **ek hi database transaction** mein honi chahiye. Agar koi step fail ho, sab rollback.

```
Example: Purchase Invoice
  INSERT purchases
  INSERT purchase_items (multiple)
  INSERT stock_movements (multiple)
  UPDATE inventory_items.current_stock
  INSERT supplier_ledger_entries
  INSERT journal_entries + journal_lines
  INSERT offline_operations (sync queue)
  → ALL or NOTHING
```

### Rule 2: Double-Entry Accounting
Har financial event ke liye journal entry:
- Total Debits = Total Credits (tolerance: 0.01)
- `validateJournalBalance()` se check karo

### Rule 3: Party Ledger
Har party (Customer, Vendor, Supplier, Employee) ka apna ledger:
```
current_balance = opening_balance + SUM(debit) - SUM(credit)
```

### Rule 4: Vendor ≠ Supplier
| | Vendor | Supplier |
|---|--------|----------|
| Deta hai | Services | Materials |
| Purchase se link | ❌ | ✅ |
| Service invoice | ✅ | ❌ |
| Stock IN trigger | ❌ | ✅ |
| AP account | ACCOUNTS_PAYABLE_VENDORS | ACCOUNTS_PAYABLE |

### Rule 5: Online-Only Tables (Web Mode)
Yeh tables sirf server pe write honi chahiye (offline client block):
```
payments, cash_receipts, vouchers, stock_movements,
stock_transactions, invoices, journal_entries, journal_lines
```

### Rule 6: Reference Linking
Har ledger/stock entry mein source document ka reference:
```
reference_type: 'purchase' | 'invoice' | 'payment' | 'opening' | 'jobsheet'
reference_id:   <source document UUID>
reference_no:   <human readable number>
```

---

## 4. Master Data Flows

### 4.1 Customer Create Flow

```
┌──────────┐    ┌─────────────┐    ┌──────────────────────┐    ┌──────────────┐
│ UI Form  │───►│ Validate    │───►│ INSERT customers     │───►│ IF opening   │
│          │    │ name, phone │    │ type='customer'      │    │ balance > 0  │
└──────────┘    │ duplicate   │    └──────────────────────┘    │ INSERT ledger│
                │ check       │                                  └──────────────┘
                └─────────────┘
```

**Steps:**
1. User fills: name, phone, company, GSTIN, credit_limit, vehicles[], opening_balance
2. Validate: name required, phone 10 digits, GSTIN format
3. Check duplicate: same phone/email
4. Generate UUID, auto timestamps
5. INSERT into `customers`
6. IF `opening_balance > 0`:
   - INSERT `customer_ledger_entries`:
     ```
     particulars: 'Opening Balance'
     ref_type: 'opening'
     debit: opening_balance
     credit: 0
     ```
7. Set `current_balance = opening_balance`
8. Queue sync

**Lead Flow:** Same table, `type: 'lead'`. Convert lead:
```
UPDATE customers SET type='customer', convertedAt=now(), convertedFrom='lead'
```

---

### 4.2 Vendor Create Flow

```
UI Form → Validate (name, phone) → Generate code VEN-XXXX
→ INSERT vendors → IF opening_balance > 0 → INSERT vendor_ledger_entries (debit, ref_type='opening')
→ current_balance = opening_balance
```

**Auto Code:** `generateCode('VEN', 4)` → `VEN-0001`

---

### 4.3 Employee (Labour) Create Flow

```
UI Form → Validate (name, daily_rate) → hourly_rate = daily_rate / 9
→ INSERT labour → IF opening_balance > 0 → INSERT labour_ledger_entries (debit, ref_type='opening')
```

**Note:** Employee ka auto-code generate karna recommended hai (`LAB-0001`).

---

### 4.4 Supplier Create Flow

```
UI Form → Validate (name, phone) → Generate code SUP-XXXX
→ INSERT suppliers → IF opening_balance > 0 → INSERT supplier_ledger_entries (debit, ref_type='opening')
```

---

### 4.5 Inventory Item Create Flow

```
UI Form → Validate (name, category_id) → INSERT inventory_categories (if new)
→ INSERT inventory_items (current_stock=0 or initial qty)
→ Optional: INSERT stock_movements (type='adjustment' for opening stock)
```

---

## 5. Transaction Flows (Step-by-Step)

### 5.1 Purchase Invoice (Supplier → Inventory → Accounts)

**Trigger:** Accounts → Purchase-Invoice tab  
**Source files:** `Purchase.jsx`, `moduleIntegration.js`, `supplierModuleHelpers.js`

```
┌──────────┐   ┌────────────┐   ┌─────────────────┐   ┌──────────────────┐
│ Select   │──►│ Add        │──►│ Calculate       │──►│ ATOMIC SAVE      │
│ Supplier │   │ Materials  │   │ subtotal + GST  │   │ (see table below)│
└──────────┘   └────────────┘   └─────────────────┘   └──────────────────┘
```

**Atomic Writes (ek transaction mein):**

| # | Table | Action | Data |
|---|-------|--------|------|
| 1 | `purchases` | INSERT | invoice_no, supplier_id, subtotal, gst_amount, total_amount, materials[] |
| 2 | `purchase_items` | INSERT (each line) | material_name, qty, rate, total |
| 3 | `stock_movements` | INSERT (each line) | movement_type='in', item_id, qty, reference_type='purchase' |
| 4 | `inventory_items` | UPDATE/INSERT | current_stock += qty (or create new item by material_name) |
| 5 | `supplier_ledger_entries` | INSERT | credit_amount=total (payable badhta hai) |
| 6 | `gst_ledger` | INSERT | input GST entry |
| 7 | `rate_history` | INSERT | latest purchase rate per item |
| 8 | `journal_entries` | INSERT | source_type='purchase' |
| 9 | `journal_lines` | INSERT | Dr Inventory, Cr Accounts Payable |

**Journal Entry:**
```
Dr  Inventory (Asset)              ₹ total_amount
    Cr  Accounts Payable (Liability)    ₹ total_amount
```

**Supplier Ledger:**
```
credit_amount = total_amount   (hum supplier ke payable mein add karte hain)
particulars = "Purchase Invoice - PINV-001"
```

**Stock Update:**
```
inventory_items.current_stock += purchased_quantity
stock_movements.movement_type = 'in'
```

---

### 5.2 Supplier Payment (Voucher)

**Trigger:** Accounts → Voucher OR Supplier Ledger → Pay

```
Select Supplier → Enter amount, payment_mode → ATOMIC SAVE
```

| # | Table | Action |
|---|-------|--------|
| 1 | `vouchers` | INSERT (voucher_type='payment', payee_type='supplier') |
| 2 | `supplier_ledger_entries` | INSERT (debit_amount=amount — payable kam hota hai) |
| 3 | `payments` | INSERT |
| 4 | `journal_entries` + `journal_lines` | INSERT |

**Journal Entry:**
```
Dr  Accounts Payable (Liability ↓)    ₹ amount
    Cr  Cash/Bank (Asset ↓)                ₹ amount
```

**Supplier Ledger:**
```
debit_amount = payment_amount
particulars = "Payment to {supplier_name}"
```

---

### 5.3 Sales Invoice (Customer → Accounts)

**Trigger:** Accounts → Sell-Invoice OR Job → Invoice step

```
Select Customer → Add items → Calculate GST → ATOMIC SAVE
```

| # | Table | Action |
|---|-------|--------|
| 1 | `invoices` | INSERT |
| 2 | `invoice_items` | INSERT (each line) |
| 3 | `customer_ledger_entries` | INSERT (debit=total — receivable badhta hai) |
| 4 | `stock_movements` | INSERT (movement_type='out') — if stock tracked |
| 5 | `inventory_items` | UPDATE (current_stock -= qty) |
| 6 | `journal_entries` + `journal_lines` | INSERT |
| 7 | `gst_ledger` | INSERT (output GST) |

**Journal Entry:**
```
Dr  Accounts Receivable (Asset ↑)     ₹ grand_total
    Cr  Sales Revenue (Income ↑)            ₹ subtotal
    Cr  GST Output (Liability ↑)            ₹ gst_amount
```

**Customer Ledger:**
```
debit = total_amount
particulars = "Invoice INV-001"
```

**IF partial payment received at invoice time:**
```
Additional INSERT customer_ledger_entries:
  credit = payment_amount
  ref_type = 'invoice_payment'
```

---

### 5.4 Cash Receipt (Customer Payment)

**Trigger:** Accounts → Cash Receipt

```
Select Customer → Enter amount, mode → ATOMIC SAVE
```

| # | Table | Action |
|---|-------|--------|
| 1 | `cash_receipts` | INSERT |
| 2 | `customer_ledger_entries` | INSERT (credit=amount — receivable kam) |
| 3 | `vouchers` | INSERT (voucher_type='receipt') |
| 4 | `journal_entries` + `journal_lines` | INSERT |

**Journal Entry:**
```
Dr  Cash/Bank (Asset ↑)               ₹ amount
    Cr  Accounts Receivable (Asset ↓)     ₹ amount
```

---

### 5.5 Vendor Service Invoice

**Trigger:** Vendor module OR Job-linked service

```
Select Vendor → Add service items → Calculate GST → ATOMIC SAVE
```

| # | Table | Action |
|---|-------|--------|
| 1 | `vendor_invoices` | INSERT (type='service') |
| 2 | `vendor_invoice_items` | INSERT |
| 3 | `journal_entries` + `journal_lines` | INSERT |
| 4 | `jobs` | UPDATE (vendorCost, totalCost) — if job linked |
| 5 | `vendor_ledger_entries` | INSERT (debit=total) |

**Journal Entry:**
```
IF job linked:
  Dr  Job Cost (Expense)              ₹ total
ELSE:
  Dr  Service Expense (Expense)       ₹ total
    Cr  Accounts Payable - Vendors (Liability)  ₹ total
```

---

### 5.6 Vendor Payment

```
Select Vendor → Link invoice (optional) → Enter amount → ATOMIC SAVE
```

| # | Table | Action |
|---|-------|--------|
| 1 | `payments` | INSERT (payeeType='vendor') |
| 2 | `vendor_ledger_entries` | INSERT (credit=amount) |
| 3 | `vendor_invoices` | UPDATE (paidAmount += amount) |
| 4 | `journal_entries` + `journal_lines` | INSERT |

**Journal Entry:**
```
Dr  Accounts Payable - Vendors       ₹ amount
    Cr  Cash/Bank                         ₹ amount
```

---

### 5.7 Employee Jobsheet → Labour Cost

**Trigger:** Jobs workflow → Jobsheet step → Approve

```
Job → Select Technician → Enter hours → Approve Jobsheet → ATOMIC SAVE
```

**Step A: Create Jobsheet**
```
INSERT jobsheets (technicianId, hours, rate, labourCost = hours × rate)
INSERT jobsheet_items (materials used)
```

**Step B: Approve Jobsheet (Labour Cost Posting)**
| # | Table | Action |
|---|-------|--------|
| 1 | `jobsheets` | UPDATE status='approved' |
| 2 | `jobs` | UPDATE labourCost, totalCost |
| 3 | `journal_entries` + `journal_lines` | INSERT |

**Journal Entry:**
```
Dr  Labour Expense                   ₹ labourCost
    Cr  Payroll Payable (employee)         ₹ labourCost
    OR
    Cr  Contractor Payable (contractor)    ₹ labourCost
```

**Step C: Issue Materials (Stock OUT)**
| # | Table | Action |
|---|-------|--------|
| 1 | `jobsheet_items` | UPDATE isIssued=true |
| 2 | `stock_transactions` | INSERT (qty negative) |
| 3 | `products` / `inventory_items` | UPDATE stock -= qty |

---

### 5.8 Employee Payment (Wages)

```
Select Employee → Enter amount → Link jobsheets (optional) → ATOMIC SAVE
```

| # | Table | Action |
|---|-------|--------|
| 1 | `payments` | INSERT (payeeType='labour') |
| 2 | `labour_ledger_entries` | INSERT (credit=amount) |
| 3 | `jobsheets` | UPDATE isPaid=true (if linked) |
| 4 | `journal_entries` + `journal_lines` | INSERT |

**Journal Entry:**
```
Dr  Payroll/Contractor Payable       ₹ amount
    Cr  Cash/Bank                         ₹ amount
```

---

### 5.9 Manual Voucher

**Trigger:** Accounts → Voucher

```
Enter voucher details → Add journal lines (multiple debit/credit) → Validate balance → SAVE
```

**Validation:** `SUM(debit) == SUM(credit)` (±0.01)

| # | Table | Action |
|---|-------|--------|
| 1 | `vouchers` | INSERT |
| 2 | `journal_entries` | INSERT |
| 3 | `journal_lines` | INSERT (multiple lines) |
| 4 | Party ledger (if applicable) | INSERT |

---

### 5.10 Purchase Challan (GRN)

```
Purchase created → GRN received → INSERT purchase_challans
→ Stock IN (same as purchase but challan-based receipt)
```

---

### 5.11 Sell Challan

```
Job/Jobsheet materials → INSERT sell_challans → Stock OUT
→ Later: Convert to Invoice
```

**Job Flow:**
```
Jobsheet (material items) → createSellChallanFromJobsheet()
  → INSERT sell_challans
  → stock_movements (type='out') for each material
  → createInvoiceFromChallan()
    → INSERT invoices
    → customer_ledger_entries (debit)
```

---

## 6. Cross-Module Integration Map

```
                         ┌─────────────┐
                         │    JOBS     │
                         │ (Central)   │
                         └──────┬──────┘
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌────────────┐     ┌────────────┐     ┌────────────┐
     │  CUSTOMER  │     │  EMPLOYEE  │     │   VENDOR   │
     │  (owner)   │     │ (labour)   │     │ (service)  │
     └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
           │                  │                  │
           ▼                  ▼                  ▼
     ┌────────────┐     ┌────────────┐     ┌────────────┐
     │  Invoice   │     │ Jobsheet   │     │ Vendor Inv │
     │  Challan   │     │ Attendance │     │ Svc Order  │
     │ Cash Rcpt  │     │ Payment    │     │ Payment    │
     └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
           │                  │                  │
           └──────────┬───────┴──────────────────┘
                      ▼
              ┌───────────────┐
              │   ACCOUNTS    │
              │ Journal/GST   │
              └───────┬───────┘
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
    ┌────────────┐        ┌────────────┐
    │  SUPPLIER  │───────►│ INVENTORY  │
    │ (material) │ Purchase│  (stock)   │
    └────────────┘  Stock IN└────────────┘
```

### Integration Matrix

| From Module | To Module | Trigger Event | Data Passed |
|-------------|-----------|---------------|-------------|
| Customer | Jobs | Create Job | customerId, vehicles |
| Jobs | Customer | Invoice/Challan | customerId, amount → ledger |
| Jobs | Employee | Jobsheet | technicianId, hours, cost |
| Jobs | Vendor | Service Order | vendorId, jobId, amount |
| Jobs | Inventory | Material Issue | item_id, qty → stock OUT |
| Supplier | Inventory | Purchase | item_id, qty → stock IN |
| Supplier | Accounts | Purchase Invoice | supplier_id, amount → AP |
| Vendor | Accounts | Service Invoice | vendor_id, amount → AP |
| Employee | Accounts | Wages Payment | labour_id, amount |
| Customer | Accounts | Sales/Cash Receipt | customer_id, amount → AR |
| Accounts | Inventory | Purchase/Sales | stock movements |
| Accounts | All Parties | Vouchers | ledger entries |

---

## 7. Ledger & Balance Rules

### Universal Balance Formula

```javascript
current_balance = opening_balance + SUM(debit) - SUM(credit)
```

### Party-Wise Ledger Behavior

| Party | Debit Means | Credit Means | Invoice Creates | Payment Creates |
|-------|-------------|--------------|-----------------|-----------------|
| **Customer** | Receivable ↑ (they owe us) | Receivable ↓ (they paid) | DEBIT | CREDIT |
| **Vendor** | Payable ↑ (we owe them) | Payable ↓ (we paid) | DEBIT | CREDIT |
| **Supplier** | Payable ↑ | Payable ↓ | CREDIT* | DEBIT |
| **Employee** | Payable ↑ (wages due) | Payable ↓ (wages paid) | DEBIT (on approve) | CREDIT |

> *Note: Supplier ledger mein Purchase.jsx `credit_amount` use karta hai (payable increase). Kuch helpers `debit` use karte hain. Naye CRM mein **ek consistent convention** choose karo.

### Opening Balance Entry (All Parties)

```
INSERT {party}_ledger_entries:
  entry_date: today
  particulars: 'Opening Balance'
  ref_type: 'opening'
  debit: opening_balance (if receivable/payable is debit-normal for that party)
  credit: 0
```

### Recalculate Balance Function (Implement in every CRM)

```javascript
async function recalculatePartyBalance(partyType, partyId) {
  const party = await getById(partyType, partyId);
  const entries = await getLedgerEntries(partyType, partyId);
  const ledgerSum = entries.reduce((sum, e) =>
    sum + (e.debit || e.debit_amount || 0) - (e.credit || e.credit_amount || 0), 0);
  await update(partyType, partyId, {
    current_balance: (party.opening_balance || 0) + ledgerSum
  });
}
```

---

## 8. Journal Entry Patterns

### Chart of Accounts (Minimum Required)

| Account ID | Name | Type |
|------------|------|------|
| CASH | Cash | Asset |
| BANK | Bank | Asset |
| AR | Accounts Receivable | Asset |
| INVENTORY | Inventory | Asset |
| AP | Accounts Payable (Suppliers) | Liability |
| ACCOUNTS_PAYABLE_VENDORS | Accounts Payable (Vendors) | Liability |
| PAYROLL_PAYABLE | Payroll Payable | Liability |
| CONTRACTOR_PAYABLE | Contractor Payable | Liability |
| SALES | Sales Revenue | Income |
| GST_INPUT | GST Input (ITC) | Asset |
| GST_OUTPUT | GST Output | Liability |
| LABOUR_EXPENSE | Labour Expense | Expense |
| SERVICE_EXPENSE | Service Expense | Expense |
| JOB_COST | Job Cost | Expense |

### Pattern Templates

**Purchase (Material):**
```
Dr  Inventory
Dr  GST Input          (optional, separate line)
    Cr  Accounts Payable (Supplier)
```

**Sale:**
```
Dr  Accounts Receivable
    Cr  Sales Revenue
    Cr  GST Output
```

**Customer Payment:**
```
Dr  Cash/Bank
    Cr  Accounts Receivable
```

**Supplier/Vendor Payment:**
```
Dr  Accounts Payable
    Cr  Cash/Bank
```

**Labour Cost (Accrual):**
```
Dr  Labour Expense
    Cr  Payroll/Contractor Payable
```

**Labour Payment:**
```
Dr  Payroll/Contractor Payable
    Cr  Cash/Bank
```

**Validation:**
```javascript
function validateJournalBalance(lines) {
  const debits = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const credits = lines.reduce((s, l) => s + (l.credit || 0), 0);
  return Math.abs(debits - credits) < 0.01;
}
```

---

## 9. Stock Movement Rules

### Movement Types

| Type | Effect | Trigger |
|------|--------|---------|
| `in` | current_stock += qty | Purchase, GRN, Return from job |
| `out` | current_stock -= qty | Sales, Job issue, Sell challan |
| `adjustment` | current_stock = qty | Manual correction, opening stock |

### Stock Check Before OUT

```javascript
if (item.current_stock < requested_qty) {
  throw new Error(`Insufficient stock. Available: ${item.current_stock}`);
}
```

### Stock Movement Record

```javascript
{
  id: UUID,
  item_id: UUID,
  movement_type: 'in' | 'out' | 'adjustment',
  quantity: number,
  movement_date: ISO date,
  reference_type: 'purchase' | 'invoice' | 'jobsheet' | 'challan',
  reference_id: UUID,
  reference_no: 'PINV-001',
  unit_price: number,
  notes: string
}
```

### Dual Stock System (Legacy Note)

Malwa CRM mein do stock systems hain:
- `inventory_items.current_stock` — Inventory module
- `products.currentStock` — Jobs/Supplier helpers

**Naye CRM mein:** Ek hi stock table use karo (`inventory_items` recommended).

---

## 10. Jobs Workflow Integration

### Complete Job Lifecycle Data Flow

```
1. CREATE JOB
   jobs ← customerId, vehicle_no, status='new'

2. INSPECTION
   inspections ← jobId, items[], findings[]

3. ESTIMATE
   estimates ← jobId, customerId, items[]
   estimate_items ← productId, qty, rate

4. JOBSHEET
   jobsheets ← jobId, technicianId(labour), hours, labourCost
   jobsheet_items ← productId, qty (materials)

5. APPROVE JOBSHEET
   → journal: Labour Expense / Payroll Payable
   → jobs.labourCost updated

6. ISSUE MATERIALS
   → stock_transactions (OUT)
   → inventory/products stock reduced

7. CHALLAN
   sell_challans ← jobId, items[]
   → stock OUT

8. INVOICE
   invoices ← jobId, customerId, total
   → customer_ledger DEBIT
   → journal: AR / Sales / GST Output

9. CASH RECEIPT
   cash_receipts ← customerId, amount
   → customer_ledger CREDIT
   → journal: Cash / AR
```

---

## 11. Sync & Storage Architecture

### Storage Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: UI (React Pages + Zustand Stores)              │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Module Helpers (business logic + atomic txns)  │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Database Operations (Dexie / API client)       │
├─────────────────────────────────────────────────────────┤
│ Layer 4a: IndexedDB (offline cache)                     │
│ Layer 4b: MySQL (source of truth - web mode)            │
│ Layer 4c: JSON Files (legacy desktop - C:/malwa-crm/)   │
└─────────────────────────────────────────────────────────┘
```

### Sync Flow (Web Mode)

```
User Action
  → Write to IndexedDB (immediate UI update)
  → Dexie hook → INSERT syncQueue
  → IF online: POST /api/sync/push
  → Server writes MySQL
  → Other devices: GET /api/sync/pull → UPDATE IndexedDB
```

### Sync-Critical Tables (Auto-queue on CRUD)

```
customers, customer_ledger_entries, vendors, vendor_ledger_entries,
suppliers, supplier_ledger_entries, labour, labour_ledger_entries,
inventory_items, stock_movements, purchases, invoices, vouchers,
journal_entries, journal_lines, jobs, jobsheets, ...
```

---

## 12. Implementation Checklist (New CRM)

Use this checklist to replicate the same flow in another CRM:

### Phase 1: Master Data

- [ ] Create `customers` table with type (customer/lead), vehicles JSON, credit fields
- [ ] Create `vendors` table with serviceType, auto-code VEN-XXXX
- [ ] Create `labour` table with rates, is_contractor, vendor_id link
- [ ] Create `suppliers` table with category, auto-code SUP-XXXX
- [ ] Create `inventory_categories` + `inventory_items` tables
- [ ] Create `accounts` chart of accounts table
- [ ] Implement opening balance → ledger entry on create (all 4 party types)
- [ ] Implement `recalculateBalance()` for each party type

### Phase 2: Ledger System

- [ ] Create `{party}_ledger_entries` table for each party (4 tables)
- [ ] Standardize debit/credit column names (pick one: `debit/credit` OR `debit_amount/credit_amount`)
- [ ] Add reference_type, reference_id, reference_no to all ledger entries
- [ ] Build ledger view UI with running balance

### Phase 3: Inventory

- [ ] Create `stock_movements` table with movement_type enum
- [ ] Implement stock IN (purchase) and OUT (sales/job) functions
- [ ] Add stock availability check before OUT
- [ ] Build stock movement history view

### Phase 4: Accounts / Journal

- [ ] Create `journal_entries` + `journal_lines` tables
- [ ] Implement `validateJournalBalance()` 
- [ ] Create `purchases` + `purchase_items` tables
- [ ] Create `invoices` + `invoice_items` tables
- [ ] Create `vouchers` + `payments` + `cash_receipts` tables
- [ ] Create `gst_ledger` table
- [ ] Implement all journal patterns from Section 8

### Phase 5: Transaction Flows

- [ ] Purchase Invoice flow (Section 5.1) — ATOMIC
- [ ] Supplier Payment flow (Section 5.2) — ATOMIC
- [ ] Sales Invoice flow (Section 5.3) — ATOMIC
- [ ] Cash Receipt flow (Section 5.4) — ATOMIC
- [ ] Vendor Service Invoice flow (Section 5.5) — ATOMIC
- [ ] Vendor Payment flow (Section 5.6) — ATOMIC
- [ ] Jobsheet Approve + Material Issue (Section 5.7) — ATOMIC
- [ ] Employee Payment flow (Section 5.8) — ATOMIC
- [ ] Manual Voucher flow (Section 5.9) — ATOMIC

### Phase 6: Jobs Integration

- [ ] Job → Customer link
- [ ] Job → Jobsheet → Employee labour cost
- [ ] Job → Material issue → Inventory stock OUT
- [ ] Job → Sell Challan → Invoice → Customer ledger
- [ ] Job cost tracking (labourCost + vendorCost + materialCost = totalCost)

### Phase 7: Sync & Permissions

- [ ] RBAC permissions per module (see permissionCatalog.js)
- [ ] Offline queue for web mode
- [ ] Online-only rules for financial tables
- [ ] GST report generation (input vs output)

### Phase 8: UI Pages

- [ ] Customer: Details, Ledger, Leads, Credit Ledger tabs
- [ ] Vendor: Details, Ledger tabs
- [ ] Employee: Details, Ledger, Attendance tabs
- [ ] Supplier: Details, Ledger tabs
- [ ] Inventory: Stock List, Movements, Categories tabs
- [ ] Accounts: Purchase, Voucher, Invoice, Challan, Cash Receipt, GST tabs

---

## Quick Reference: Which Module Handles What?

| Business Action | Primary Module | Also Updates |
|----------------|----------------|--------------|
| Customer billing | Accounts (Invoice) | Customer Ledger |
| Customer payment | Accounts (Cash Receipt) | Customer Ledger |
| Buy materials | Accounts (Purchase) | Supplier Ledger, Inventory |
| Pay supplier | Accounts (Voucher) | Supplier Ledger |
| Hire outside service | Vendor (Service Invoice) | Vendor Ledger, Job Cost |
| Pay vendor | Accounts (Voucher) | Vendor Ledger |
| Employee work on job | Jobs (Jobsheet) | Employee, Job Cost |
| Pay employee wages | Accounts (Voucher) | Employee Ledger |
| Stock adjustment | Inventory | Stock Movements |
| GST filing report | Accounts (GST Ledger) | — |

---

## Source Code Reference (Malwa CRM)

| Flow | Primary File |
|------|-------------|
| Cross-module integration | `src/utils/moduleIntegration.js` |
| Customer operations | `src/utils/customerModuleHelpers.js` |
| Vendor operations | `src/utils/vendorModuleHelpers.js` |
| Supplier operations | `src/utils/supplierModuleHelpers.js` |
| Employee operations | `src/utils/labourModuleHelpers.js` |
| Account operations | `src/utils/accountModuleHelpers.js` |
| Job-level flows | `src/utils/dataFlow.js` |
| Balance recalculation | `src/lib/db.js` |
| Database schema | `src/db/dexie.js` |
| Backend models | `backend/app/db/models.py`, `models_extra.py` |
| Architecture registry | `backend/app/db/architecture_registry.py` |
| Purchase UI flow | `src/pages/accounts/Purchase.jsx` |

---

*Document generated from Malwa CRM (MT_crm) codebase analysis. Use as blueprint for replicating the same module data flows in any new CRM system.*
