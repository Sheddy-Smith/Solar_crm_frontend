# Project ↔ Accounts Connectivity — Implementation Checklist

**Status:** COMPLETE (local only — **NOT DEPLOYED**)  
**Date:** 2026-11-19

## Phase 0 — Audit

| Area | Result |
|---|---|
| Models project FK (PI/SI/PC/SC/Payment/PaymentVoucher) | Present |
| Serializers project writable + `project_name` | Present |
| ViewSet `?project=` filter | Present |
| Project payment → Cash Receipt (`update_or_create` on `project_payment`) | Idempotent |
| Material dispatch → cost voucher | Working |
| `GET /projects/{id}/pnl/` | Present; now also used by FE |
| Payment Voucher FE project field | **Fixed** (was missing) |
| Document lookup `page_size: 25` | **Fixed** via `fetchEveryPage` |
| Sell Invoice/Challan project required | **Fixed** (FE + BE) |
| Settings Chart of Accounts | **Fixed** (live API; was static DEMO) |

## Phase 1 — Voucher + Project dropdown

- [x] `src/components/ProjectSearchSelect.jsx` — searchable, paginated, retry
- [x] Payment Voucher form Project field + list/detail column
- [x] Labour vouchers set `category=Labour` for P&L inclusion
- [x] Solar document pages: full project/party/inventory lookups

## Phase 2 — Sell / Cash Receipt validation + sync

- [x] Sell Invoice / Sell Challan: FE `requireProject` + BE `ValidationError`
- [x] Cash Receipt: project required except `receipt_source=Other`
- [x] `sync_source` (`From Project` / `Accounts`) on Payment serializer + UI badge
- [x] Project payment sync sets `receipt_source=Project` + `received_from`
- [x] Sync remains idempotent via OneToOne `project_payment`

## Phase 3 — Project Accounts Summary

- [x] Expanded `project_pnl` (other expenses, margin, billing aliases)
- [x] `GET /api/v1/projects/{id}/accounts-summary/`
- [x] `projectApi.accountsSummary(id)`
- [x] Project Detail → **Accounts Summary** card (live aggregates)

## Phase 4 — Lists Project column + filters

- [x] Document lists: Project column + Project filter (toolbar + header filter)
- [x] Document list load via `fetchEveryPage` (no 25-row truncation)
- [x] Cash Receipt / Voucher / Payment pages already expose Project column

## Phase 5 — Accuracy / consistency

- [x] Invoice `balance_due = total − payment_amount` (existing `apply_invoice_totals`)
- [x] Labour cost includes category/payee Labour vouchers (not only workforce-mirrored)
- [x] Material cost from dispatch vouchers; planning difference remains report-only
- [x] Other Expense vouchers counted separately in P&L

## Phase 6 — Settings CoA + tests

- [x] Settings → Chart of Accounts loads live `accountsModuleApi.chartOfAccounts`
- [x] Seed Recommended / Refresh / Manage in Accounts actions
- [x] Tests: `apps.accounts_module.tests_project_accounts_connectivity` — **5/5 OK**

## Deploy

**NOT DEPLOYED.** Production deploy / main merge requires separate authorization.

## Key files touched

- `src/components/ProjectSearchSelect.jsx` (new)
- `src/accountsVoucherForm.jsx`, `src/accountsSolarPages.jsx`, `src/App.jsx`, `src/api.js`
- `backend/apps/accounts_module/document_serializers.py`
- `backend/apps/accounts_module/serializers.py`
- `backend/apps/accounts_module/project_financial_sync.py`
- `backend/apps/accounts_module/services.py`
- `backend/apps/projects/views.py`
- `backend/apps/accounts_module/tests_project_accounts_connectivity.py` (new)
