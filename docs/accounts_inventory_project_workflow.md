# Accounts ↔ Inventory ↔ Project Workflow

**Branch baseline:** `feature/e2e-bom-dashboard-automation`  
**Scope:** Implemented local behavior (not aspirational). No VPS / production DB changes from this workstream.

---

## 1. Business architecture

| Layer | Role |
|---|---|
| Project | Business job; common FK for billing, receipts, dispatch, vouchers |
| Accounts | Invoices, payments, vouchers, journals, ledgers, P&L |
| Inventory | Physical stock + StockMovement ledger |
| Payment | Cash/bank movement (one cash journal) |
| Invoice | AR/AP accrual |
| InvoicePaymentAllocation | Settlement only — no second cash journal |
| Material Dispatch | Authoritative project material Stock OUT + actual cost |

**Rules:** Receipt ≠ revenue. Purchase Stock IN ≠ project material cost. Dispatch owns project material consumption. Project Billing (`source=Project`) does not Stock OUT.

---

## 2. Purchase Invoice → Stock IN

1. Physical lines require `inventory_item` FK (no fuzzy name match).
2. Service/NON_STOCK categories skip stock.
3. Status `Recorded`/`Paid` → Inward StockMovement (`Purchase Invoice`), update-linked on resave.
4. Cancel/delete clears linked movements.
5. `procurement_scope=General` → project optional; `Project` → project mandatory.
6. Movement.project set only for Project-specific purchases.
7. Atomic: invoice + stock + journal in one `transaction.atomic()`.

---

## 3. Sell Invoice → Stock OUT

1. Project mandatory.
2. `source=Accounts` + Issued/Paid → Outward StockMovement (`Sell Invoice`).
3. `source=Project` → billing only; no Stock OUT (dispatch owns stock).
4. Double-OUT guard: if Jobs Outward already exists for same project+item → ValidationError.
5. Atomic create/update/destroy; linked movement updated (not duplicated) on resave.

---

## 4. Cash Receipt → Invoice Allocation

1. Party + Project from masters; `received_from` auto-filled.
2. Payment posts cash journal once (`after_payment_saved`).
3. InvoicePaymentAllocation settles invoices; no second cash journal.
4. **ProjectPayment sync:** after Payment create/update, FIFO auto-allocates remaining available amount to outstanding project Sell Invoices (idempotent).
5. Cash Receipt and Payment Received UIs both expose allocation panel.

---

## 5. Project Dispatch → Stock OUT → Material Cost

1. MaterialPlan must have `inventory_item` FK when `dispatched_qty > 0` (fuzzy name match removed).
2. StockMovement `reference_type=Jobs`, `project` set.
3. Cost voucher uses `InventoryItem.rate × dispatched_qty` (not planning price).
4. CoA `5410` planning difference remains report-only (no journal).

---

## 6. Source rules (Accounts vs Project Sell)

| source | Stock | Use |
|---|---|---|
| Accounts | May Stock OUT | Direct warehouse sale / Accounts-owned stock |
| Project | No Stock OUT | Project billing after Material Dispatch |

---

## 7. Project-specific vs General Purchase

- Field: `PurchaseInvoice.procurement_scope` (`General` | `Project`).
- Project-specific requires `project` FK.
- General warehouse receipt may leave project null.

---

## 8. Master data reuse

- Party / Supplier / Customer searchable selects (account_type filtered where relevant).
- `ProjectSearchSelect` with optional `customerFilter`.
- Inventory item pick on product lines; name/unit/rate/warehouse from master.
- Voucher / Other Expenses / Cheque / Payment Made: payee from master where possible; free-text for Other only.
- Service lines: category `Service` / `Labour` / `Freight` / `Charge` (NON_STOCK).

---

## 9. Journal posting rules

- Sell Invoice: Dr AR (1130), Cr Sales (4100).
- Purchase Invoice: AP / inventory journal via existing `sync_journal_for_invoice`.
- Customer Receipt: Dr Cash/Bank, Cr AR.
- Allocation: settlement only.
- Dispatch cost voucher: Dr material COA (e.g. 5210).

---

## 10. Stock movement source protection

- Protected refs: Purchase/Sell Invoice & Challan, Jobs.
- REST API blocks create/edit/delete of protected movements.
- Manual adjustments require `notes` (reason); Opening Stock create via product API only.
- Django Admin: protected rows effectively non-editable/non-deletable; `current_stock` read-only on items.
- O&M spare-part sync writes Manual StockMovement delta (no direct `current_stock` overwrite).

---

## 11. API endpoints (key)

| Endpoint | Notes |
|---|---|
| `/api/v1/accounts/purchase-invoices/` | Stock IN + procurement_scope |
| `/api/v1/accounts/sell-invoices/` | Stock OUT / source / project required |
| `/api/v1/accounts/payments/` | Cash receipts; IPA actions |
| `/api/v1/inventory/movements/` | Manual only for free CRUD; `?project=` filter |
| `/api/v1/inventory/movements/reconciliation/` | Read-only audit findings |
| `/api/v1/projects/{id}/pnl/` / `accounts-summary/` | Accrual P&L |

---

## 12. Migrations (local)

| Migration | Purpose |
|---|---|
| `inventory.0009_stock_sell_invoice_project_procurement` | Sell Invoice choice + `StockMovement.project` |
| `accounts_module.0027_stock_sell_invoice_project_procurement` | `procurement_scope` |
| `inventory.0010_backfill_stockmovement_project` | Unambiguous project backfill only |

**Local only:**

```bash
cd backend
.venv\Scripts\python.exe manage.py migrate
```

---

## 13. Regression tests (local results)

Suite run (isolated test DB, `--keepdb`):

- `tests_accounts_inventory_integration`
- `tests_invoice_payment_allocation`
- `tests_project_accounts_connectivity`
- `tests_financial_interop`
- `tests_e2e_solar_flow`
- `apps.om.tests`

**Result:** 46 tests OK (1 skipped). Outstanding receivable / ProjectPayment IPA path green. E2E actual_profit asserts material + other expenses.

```bash
.venv\Scripts\python.exe manage.py test apps.accounts_module.tests_accounts_inventory_integration apps.accounts_module.tests_invoice_payment_allocation apps.accounts_module.tests_project_accounts_connectivity apps.accounts_module.tests_financial_interop apps.accounts_module.tests_e2e_solar_flow apps.om.tests -v 1
```

---

## 14. Known limitations / future

- Historical ambiguous StockMovement.project rows are not guessed.
- Challan↔Invoice same-goods double stock still requires operational discipline (reconcile report flags risks).
- Customer ledger cash outstanding vs IPA-aware P&L outstanding can still differ conceptually (cash ledger vs invoice settlement) — intentional separation.
- No automatic stock/journal rewrite from reconciliation report.
- VPS / production migrate / push not authorized from this workstream.
