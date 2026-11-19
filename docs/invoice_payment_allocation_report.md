# Invoice-wise Payment Allocation — Implementation Report

**Branch:** `feature/e2e-bom-dashboard-automation`  
**Date:** 2026-11-19  
**Deploy:** **NOT DEPLOYED** — Production VPS deployment requires separate authorization.

## 1. Existing architecture audit

- `PaymentAllocation` = Payment → Project advance (preserved).
- `SellInvoice.payment_amount` = manual scalar; `balance_due = total − payment_amount`.
- No Payment ↔ SellInvoice through-model existed.
- `sync_journal_for_invoice` used Cash/Bank when `balance_due <= 0` → double Cash risk with separate Payment journals.

## 2. Root causes

1. Missing `InvoicePaymentAllocation` join entity.
2. Invoice “paid” amount not derived from real receipts.
3. Fully-paid invoice journal bypassed AR (Cash debit) while Payment also posted Cash.

## 3. Database / migration

- Model: `InvoicePaymentAllocation` (payment FK, invoice FK, amount, Active/Reversed, audit fields).
- Migration: `accounts_module.0026_invoice_payment_allocation`.
- Existing `PaymentAllocation` untouched.

## 4. API endpoints

| Method | Path |
|---|---|
| POST | `/api/v1/accounts/invoice-payment-allocations/` |
| POST | `/api/v1/accounts/invoice-payment-allocations/bulk/` |
| GET | `/api/v1/accounts/invoice-payment-allocations/?payment_id=&invoice_id=&customer_id=&project_id=` |
| POST | `/api/v1/accounts/invoice-payment-allocations/{id}/reverse/` |
| GET | `/api/v1/accounts/invoice-payment-allocations/eligible-invoices/` |
| GET | `/api/v1/accounts/invoice-payment-allocations/legacy-audit/` |
| GET | `/api/v1/accounts/sell-invoices/{id}/payment-summary/` |

## 5. Frontend files

- `src/components/InvoicePaymentAllocationPanel.jsx` (allocate + history)
- `src/App.jsx` — Cash Receipt “Allocate to Invoices”
- `src/accountsSolarPages.jsx` — Sell Invoice Payment History
- `src/api.js` — API wrappers
- Project Accounts Summary shows Invoice Allocated / Unallocated Advance

## 6. Journal corrections

- Sell/Purchase invoice journals **always** post AR/AP (never Cash based on paid status).
- Cash/Bank movement remains on Payment journals only.
- Allocation creates **no** cash journal.

## 7. Legacy data

- Invoices with `payment_amount > 0` and no IPA rows flagged via `legacy-audit` endpoint.
- No fabricated Payment/bank rows created.

## 8. Customer Ledger / Project P&L

- Receipt credited once; settlement rows are detail-only (`credit: 0`).
- Project outstanding = sum of invoice outstanding (allocation-aware).
- Unallocated advance = project receipts − invoice allocations.

## 9. Tests

```text
python manage.py test apps.accounts_module.tests_invoice_payment_allocation apps.accounts_module.tests_project_accounts_connectivity -v 1
→ Ran 16 tests — OK (skipped=1 concurrency placeholder on SQLite)
```

## 10. Remaining blockers

- Historical journals already posted with Cash-on-fully-paid invoices need controlled reconciliation (not auto-rewritten).
- Full thread concurrency test skipped on SQLite; `select_for_update` used in service.
- VPS deploy not authorized.

## 11. Push scope

- Push to **822 / Sheddy-Smith** only (per user request). Lab sync / VPS deploy not included unless separately requested.
