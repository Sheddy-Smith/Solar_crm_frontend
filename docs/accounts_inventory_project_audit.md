# Accounts ↔ Inventory ↔ Project Data Flow — Deep Audit Report

**Project:** Malwa Solar CRM  
**Mode:** AUDIT ONLY (no source/DB/deploy changes)  
**Date:** 2026-11-19  
**Scope:** Backend `accounts_module`, `inventory`, `projects` (+ related FE entry points)  
**Git tip reviewed:** feature branch / `main` @ `7cae8c9` era code paths (local working tree)

---

## A. Executive Summary

| Question | Verdict |
|---|---|
| Overall status | **UNHEALTHY for Sell-stock + reconciliation; Purchase IN / Project Dispatch mostly work** |
| Can Accounts / Inventory / Project data be bypassed? | **YES** — multiple confirmed bypass paths |
| Purchase Invoice → Stock IN | **WORKS** (when item resolves + warehouse exists + status Recorded/Paid) |
| Sell Invoice → Stock OUT | **BROKEN** for physical inventory lines (`'Sell Invoice'` missing from `REFERENCE_TYPE_CHOICES`) |
| Project-wise stock tracking | **PARTIAL** — Dispatch → Jobs Outward OK; `StockMovement` has **no project FK** |
| Project Billing double Stock OUT | **Project-source skips stock (OK)**; **Accounts-source Sell Invoice/Challan with project can double-deduct (RISK)** once Sell Invoice choice is fixed |
| Ledger / Stock / P&L reconcile? | **NO** — GST-in-total journals, dispatch credits Cash/Bank not Inventory, rate overwrite, silent skips |

### Critical risks (top)

1. **P0 — Sell Invoice Stock OUT cannot persist** when a line maps to an `InventoryItem` (`reference_type='Sell Invoice'` fails `full_clean()`). Invoice may already be committed → partial state + duplicate retries.  
2. **P0 — Non-atomic invoice/dispatch save** (`ATOMIC_REQUESTS=False`; `serializer.save()` then sync). Failures leave invoice/plan without stock/journal.  
3. **P0 — StockMovement API + Admin + O&M sync bypass ledger** (manual create/edit/delete; O&M overwrites `current_stock`).  
4. **P1 — Challan + Invoice for same goods** can double Stock IN/OUT (no document link).  
5. **P1 — Fuzzy `name__icontains` item resolution** can attach wrong inventory item silently.  
6. **P1 — Dispatch journal credits Cash/Bank**, never Inventory COA; no COGS on sell.  
7. **P1 — `InventoryItem.rate` overwritten** on every purchase receipt → P&L material cost drifts.  

---

## B. Transaction Flow Matrix

| Flow | Expected Behavior | Actual Code Behavior | Status | Evidence |
|---|---|---|---|---|
| Purchase Invoice | Stock IN on Recorded/Paid | `_sync_document_line_stock(..., Inward, 'Purchase Invoice')` after `perform_create/update` | **OK** (happy path) | `document_views.py:37-41`; `document_services.py:398-417`; e2e asserts stock 0→10 |
| Sell Invoice | Stock OUT on Issued/Paid | Passes `reference_type='Sell Invoice'` but choices reject it | **CONFIRMED BUG** | `document_services.py:420-439`; `inventory/models.py:95-102`; shell `clean('Sell Invoice')` → INVALID |
| Purchase Challan | Stock IN on Received | Inward + `reference_type='Purchase Challan'` | **OK** | `document_services.py:206-266`; e2e `test_05_purchase_challan_grn_stock_in` |
| Sell Challan | Stock OUT on Dispatched/Delivered | Outward + `reference_type='Sell Challan'` (choice exists) | **OK path / RISK vs invoice** | `document_services.py:270-328` |
| Project Dispatch | Stock OUT once per plan line | Outward `Jobs`; update-in-place via `plan.stock_movement` | **OK** | `dispatch_sync.py:33-117`; `projects/serializers.py:488-508` |
| Project Billing (source=Project) | No duplicate OUT | `active = … and invoice.source != 'Project'` | **OK** | `models.py:432-434`; `document_services.py:424`; `billing_views.py:264-269` |
| Accounts Sell Invoice + Project | Should not re-OUT after dispatch | Still attempts Outward when source=Accounts | **RISK** (latent until Sell choice fixed) | `document_services.py:424-439` |
| Project Purchase (PI.project) | Project-linked IN | PI.project optional; movement has **no project FK** | **PARTIAL** | `accounts_module/models.py` PI.project; `inventory/models.py` StockMovement fields |
| Manual Adjustment | Authorized inventory adjust only | `quick_adjust` + full `StockMovementViewSet` CRUD | **RISK** (Manual OK; doc spoof possible) | `inventory/views.py:65-123` |
| Invoice edit with lines | Update same movement | Deletes all line movements then recreates; can fail mid-loop | **RISK / BUG** | `document_serializers.py:54-60` |
| Invoice cancel | Reverse stock | Status change clears movements when not terminal | **OK intent / non-atomic RISK** | `document_services.py:402-407`, `424-428` |

---

## C. Bypass Risk Matrix

Severity: **Critical / High / Medium / Low**.  
Type: **CONFIRMED BUG** vs **RISK** vs **OK**.

### C1. Sell Invoice physical Stock OUT always rejected — Critical / CONFIRMED BUG

| Field | Detail |
|---|---|
| File | `backend/apps/inventory/models.py` L95-102; `backend/apps/accounts_module/document_services.py` L435; `inventory/models.py` L148 |
| Function | `StockMovement.REFERENCE_TYPE_CHOICES`; `sync_inventory_for_sell_invoice`; `StockMovement.save` → `full_clean()` |
| Root cause | `'Sell Invoice'` not in choices; validation rejects create/update |
| Bypass / failure mode | User creates Issued/Paid Sell Invoice with inventory line → HTTP 400 after invoice already saved (`document_views.py:72-76`) → no stock OUT, no journal, party balance not updated; retry duplicates invoice |
| Business impact | Physical sales do not reduce stock; AR journal missing; stock vs sales mismatch |
| Runtime proof | `manage.py shell`: `clean('Sell Invoice')` → `INVALID: not a valid choice` |

### C2. Invoice + stock + journal not one atomic unit — Critical / CONFIRMED BUG

| Field | Detail |
|---|---|
| File | `document_views.py` L37-58, L72-103; Django settings `ATOMIC_REQUESTS=False` |
| Function | `PurchaseInvoiceViewSet.perform_*`, `SellInvoiceViewSet.perform_*` |
| Root cause | `serializer.save()` commits first; sync services are separate `@transaction.atomic` blocks |
| How | Stock/journal ValidationError → 400 with persisted invoice; destroy deletes journal before stock reverse can fail |
| Impact | Orphan invoices, missing journals, stuck stock, duplicate retries |

### C3. StockMovement unrestricted CRUD — Critical / CONFIRMED BUG

| Field | Detail |
|---|---|
| File | `inventory/views.py` L100-123; `inventory/serializers.py` L169-172 |
| Function | `StockMovementViewSet` (ModelViewSet); `fields='__all__'` |
| Root cause | No document existence check; invoice-generated movements editable/deletable |
| How | POST Manual or spoofed `reference_type='Purchase Invoice'`; DELETE Sets line FK NULL then next invoice re-creates → double stock |
| Impact | Ledger bypass; forged document references |

### C4. O&M overwrite of `current_stock` — High / CONFIRMED BUG

| Field | Detail |
|---|---|
| File | `backend/apps/om/views.py` L37-43 |
| Function | `_maybe_sync_linked_inventory` |
| Root cause | `InventoryItem.objects.filter(...).update(current_stock=...)` with no StockMovement |
| Impact | Stock quantity diverges from movement ledger |

### C5. `_save_lines` unlink-then-delete — High / CONFIRMED BUG

| Field | Detail |
|---|---|
| File | `document_serializers.py` L54-60 (and sell/challan equivalents) |
| Function | `PurchaseInvoiceSerializer._save_lines` |
| Root cause | Nulls `stock_movement` then `movement.delete()`; if delete fails (consumed inward), orphan movement remains; loop not atomic |
| Impact | Inflated stock / blocked edits after partial consumption |

### C6. Challan ↔ Invoice no conversion link — High / RISK

| Field | Detail |
|---|---|
| File | `accounts_module/models.py` (separate PI/PC/SI/SC models); `document_services.py` challan + invoice syncs |
| Root cause | No FK / convert API |
| How | Receive Purchase Challan then record Purchase Invoice for same goods → two Inwards; Sell Challan then Sell Invoice → two Outwards (once Sell Invoice works) |
| Impact | Double stock movement |

### C7. Fuzzy inventory name match — High / RISK

| Field | Detail |
|---|---|
| File | `document_services.py` L170-184; `dispatch_sync.py` L15-30 |
| Function | `_resolve_inventory_item` / `resolve_inventory_item` |
| Root cause | Fallback `name__icontains` + `order_by('id').first()` |
| Impact | Wrong item Stock IN/OUT; silent auto-link on line |

### C8. Silent skip (no item / no warehouse) — Medium / RISK

| Field | Detail |
|---|---|
| File | `document_services.py` L221-231, L356-357 |
| Root cause | Missing item or warehouse → `return` without error |
| Impact | Invoice saved, stock unchanged, no user warning |

### C9. Rate overwrite on purchase — High / RISK

| Field | Detail |
|---|---|
| File | `document_services.py` L196-203, L394-395 |
| Function | `_apply_received_item_rate` |
| Root cause | Last purchase rate written to `InventoryItem.rate` via QuerySet.update |
| Impact | Dispatch P&L cost uses live rate (`project_financial_sync.py:49-50`); old PI edit rewrites current cost |

### C10. Dispatch plan save not atomic with stock — High / CONFIRMED RISK

| Field | Detail |
|---|---|
| File | `projects/serializers.py` L488-508 |
| Function | `MaterialPlanSerializer.create/update` |
| Root cause | `super().update` then `_sync_dispatch_stock`; insufficient stock rolls back movement only |
| Impact | Plan shows Dispatched qty with no movement; P&L fallback may still cost that qty (`project_financial_sync.py:252-257`) |

### C11. Accounts-source project sell after dispatch — High / RISK (latent)

| Field | Detail |
|---|---|
| File | `document_services.py` L424; `models.py` L432-434 |
| Root cause | Only `source=='Project'` skips stock; Accounts invoices require project but still OUT |
| Impact | Same material Outward via Jobs then Sell Invoice |

### C12. Allocation ViewSet leftover CRUD — High / RISK

| Field | Detail |
|---|---|
| File | `invoice_allocation_views.py`; `invoice_allocation_serializers.py` |
| Root cause | ModelViewSet leaves PUT/PATCH/DELETE; bypass create validations / stale balances |
| Impact | Settlement integrity |

### C13. Payment / invoice destroy journal-first — High / CONFIRMED BUG

| Field | Detail |
|---|---|
| File | `services.py` L504-508; `document_views.py` L52-58, L91-103; `views.py` payment destroy |
| Root cause | Journal deleted before ProtectedError / stock reverse failure |
| Impact | Missing journals with surviving documents |

### C14. Duplicate journals on invoice_no/date change — Medium / CONFIRMED BUG

| Field | Detail |
|---|---|
| File | `services.py` L474-478; unique on `(reference_number, transaction_date)` |
| Root cause | Keyed update_or_create; old key orphaned when no/date changes |
| Impact | Double GL postings |

### C15. Dispatch voucher credits Cash/Bank — High / CONFIRMED

| Field | Detail |
|---|---|
| File | `project_financial_sync.py` L70; `services.py` L532-570 |
| Root cause | `payment_mode='Other'` → credit cash/bank COA; Inventory 1200 never credited; no COGS on sell |
| Impact | GL cash/inventory mismatch vs warehouse reality |

### C16. GST included in AR/Inventory/Revenue totals — Medium / RISK

| Field | Detail |
|---|---|
| File | `services.py` L465-485; `project_financial_sync.py` L147-155 |
| Root cause | Journals/P&L use `total_amount` (tax inclusive); no GST payable/receivable split |
| Impact | Inflated inventory asset & revenue vs stock valuation at line rate |

### C17. Transaction.TYPE_CHOICES missing invoice types — Medium / RISK

| Field | Detail |
|---|---|
| File | `accounts_module/models.py` L279-283 vs `services.py` L466-471 |
| Root cause | ORM `update_or_create` does not `full_clean`; API PUT would reject |
| Impact | Inconsistent model contract; admin/API edits fragile |

### C18. Admin InventoryItem.current_stock editable / bulk delete movements — Medium / RISK

| Field | Detail |
|---|---|
| File | `inventory/admin.py` |
| Root cause | Default ModelAdmin; QS.delete bypasses `StockMovement.delete()` |
| Impact | Ledger bypass |

### Legitimate manual paths (OK if authorized)

- `quick_adjust` → Adjustment + `reference_type='Manual'` (`inventory/views.py:65-97`) — intended.  
- Opening stock via item create Inward (`inventory/serializers.py`) — intended.  
- Negative stock guarded with `select_for_update` (`inventory/models.py:144-186`) — OK.  
- Project `source` read-only / forced server-side — OK against spoofing.

---

## D. Project-Wise Reconciliation

### Intended chain

```
Project
 ├─ MaterialPlan ──FK stock_movement──► StockMovement (Jobs / Outward) ──► InventoryItem
 │       └─ PaymentVoucher.material_plan ──► Transaction ──► P&L actual_material
 ├─ SellInvoice.project ──► revenue (Issued/Paid)
 │       └─ SellInvoiceLine.stock_movement (Accounts source only; currently broken for physical)
 └─ Payment(project) ──► collections (cash flow, not revenue)
```

### What works

- **Dispatch → one Outward per plan line**, idempotent update (`dispatch_sync.py`).  
- **P&L revenue** = Sell Invoice totals (accrual), **not** customer receipts (`project_financial_sync.py:147-163, 196`).  
- **Actual material** prefers dispatch cost vouchers = `dispatched_qty × InventoryItem.rate` (not planning price) (`project_financial_sync.py:34-96, 212-216`).  
- **Planning difference** report-only (`project_financial_sync.py:1-5, 240-249`).  
- **Project Billing source=Project** does not move stock (comment + code).  

### Missing / broken links

| Link | Status |
|---|---|
| `StockMovement → Project` FK | **MISSING** — only text `reference` / notes |
| Filter movements by project | **NOT SUPPORTED** (`filterset_fields` = type/item/reference_type only) |
| SellInvoiceLine ↔ MaterialPlan | **MISSING** |
| PurchaseInvoice.project → StockMovement | **MISSING** (project on invoice only) |
| Purchase stock IN as “consumed project material” | Correctly **not** treated as consumed until dispatch — OK |
| Sell physical Stock OUT | **BROKEN** (C1) |
| Accounts sell after dispatch | **Double OUT risk** (C11) |
| Soft/hard project delete | Soft: stock untouched; hard: MaterialPlan cascades, movement SET_NULL → Outward orphan, stock not restored — **RISK** |

### Traceability answer

Can you always go `Project → Accounts Document → Invoice Line → Stock Movement → Inventory Item → Project P&L`?

- **Dispatch path:** Project → MaterialPlan → StockMovement → Item → voucher → P&L — **YES** (forward). Reverse from arbitrary StockMovement — **NO** (no project FK).  
- **Sell Invoice path (physical):** Project → SellInvoice → Line → StockMovement — **INTENDED but BROKEN** at movement create.  
- **Purchase path:** Project → PI (optional) → Line → Inward — **YES forward**; P&L **does not** consume purchase as project material cost (only dispatch) — by design, but project purchases without dispatch never hit P&L material.

---

## E. Test Coverage

### Executed (isolated Django test DB — 2026-11-19)

Command:

```text
python manage.py test \
  apps.accounts_module.tests_e2e_solar_flow \
  apps.accounts_module.tests_project_accounts_connectivity \
  apps.accounts_module.tests_invoice_payment_allocation \
  apps.inventory.tests \
  apps.accounts_module.tests_financial_interop \
  --verbosity=1
```

| Result | Count |
|---|---|
| Ran | **38** |
| Failures | **3** |
| Skipped | **1** |
| Pass (implied) | **34** |
| Duration | ~17s |
| DB | Temporary test DB for alias `default` (destroyed after run) |

#### Failures (actual)

1. `SolarE2EFlowTests.test_02_full_solar_crm_data_flow` — `pnl['billing']['outstanding_receivable']` expected `110000.0`, got `160000.0` (`tests_e2e_solar_flow.py:370`).  
2. `SolarE2EFlowTests.test_03_idempotency_resync` — fails because it re-calls test_02.  
3. `FinancialInteropTests.test_project_pnl_separates_planning_difference` — outstanding expected `0.0`, got `150000.0` (`tests_financial_interop.py:226`).  

**Interpretation:** Allocation-aware outstanding helpers / payment linking appear out of sync with test expectations (false confidence that P&L settlement is green). Purchase IN + Dispatch OUT portions of e2e still exercise stock before the failing assert.

### What is covered vs gaps

| Area | Covered? | Notes |
|---|---|---|
| Purchase Invoice Stock IN | Yes | e2e |
| Purchase Challan Stock IN | Yes | e2e test_05 |
| Dispatch Jobs Outward | Yes | e2e |
| Sell Invoice journal (service line) | Yes | No inventory item → **misses C1** |
| Sell Invoice physical Stock OUT | **No** | False confidence |
| Sell Challan Stock OUT | Sparse | |
| Challan+Invoice double move | **No** | |
| Invoice edit with `lines` after consumption | **No** | Idempotency patches remarks only |
| API-level dispatch atomicity | **No** | test_04 calls service directly |
| StockMovement API abuse | **No** | |
| O&M current_stock overwrite | **No** | |
| Non-zero GST journals | **No** | |
| Dispatch credit side (Inventory vs Cash) | **No** | Debit-only asserts |
| Allocation PUT/PATCH/DELETE | **No** | |
| Concurrency | Partial / NOT VERIFIED in this audit run | Allocation suite has concurrency test; skipped=1 in this run |

### False confidence

- E2E “full solar flow” looks complete but Sell Invoice uses a **service package** without inventory — never validates Sell Stock OUT.  
- Journal “balanced” helpers that only check presence of debit+credit do not validate **correct COA** (Cash vs Inventory).  
- Connectivity tests require project on Sell Invoice but do not assert stock skip/double-deduct.

---

## F. Recommended Fix Plan (DO NOT IMPLEMENT IN THIS AUDIT)

### P0 — Critical data integrity

1. Add `'Sell Invoice'` to `StockMovement.REFERENCE_TYPE_CHOICES` (+ migration). Add regression test with physical inventory sell line.  
2. Wrap invoice create/update/destroy in **one outer `transaction.atomic()`** (or enable careful `ATOMIC_REQUESTS`) so stock+journal+document commit together.  
3. Fix `_save_lines` to delete movements safely inside atomic block **before** nulling links / or reverse-order with rollback.  
4. Restrict `StockMovementViewSet`: read-only for document-linked types; block spoofed reference_types; require reason for Manual.  
5. Remove/replace O&M `current_stock` direct update with a proper Adjustment movement.  
6. Fix destroy paths: reverse stock first, then journal, then document (or single atomic).  

### P1 — Project traceability & workflow

7. Add optional `project` FK on `StockMovement`; set from dispatch / invoices; filter API by project.  
8. Link Purchase/Sell Challan ↔ Invoice (or convert workflow) to prevent double stock.  
9. Disable stock sync for Accounts-source sell docs when project material already dispatched (or force Project billing only for project materials).  
10. Require explicit `inventory_item` for physical lines; remove or tighten `icontains` fallback.  
11. Dispatch journal: credit Inventory (1200) / debit COGS or material expense — not Cash/Bank; lock rate at dispatch time.  
12. Stop blind overwrite of `InventoryItem.rate` (weighted average or last-receipt with history).  
13. Atomic MaterialPlan update + stock + accounts sync.  
14. Soft/hard delete project: reverse Jobs movements.  

### P2 — UI / reporting

15. Surface warehouse + stock sync errors to UI (no silent skip).  
16. Split GST in journals and P&L displays.  
17. Align Transaction.TYPE_CHOICES with invoice journal types.  
18. Harden allocation ViewSet (disable raw CRUD; only create/reverse).  
19. Fix failing outstanding_receivable tests + production settlement drift.  
20. Project P&L UI: show stock traceability (movement IDs / project filter).  

---

## Architecture map (reference)

| Concern | Primary files |
|---|---|
| Invoice views | `accounts_module/document_views.py` |
| Stock bridge | `accounts_module/document_services.py` |
| Journals / party | `accounts_module/services.py` |
| Project P&L / dispatch cost | `accounts_module/project_financial_sync.py` |
| Stock ledger | `inventory/models.py` (`StockMovement.save/delete`) |
| Dispatch | `inventory/dispatch_sync.py` + `projects/serializers.py` |
| Project billing | `projects/billing_views.py` |
| Inventory API | `inventory/views.py`, `inventory/serializers.py` |
| Signals | **None for stock** (dashboard cache only) |

No Django stock signals; no Celery stock hooks found in this audit. Alternate writers: Admin, O&M sync, seed commands (`seed_demo_data`, `seed_local_bulk_dummy`) — **RISK if run in prod**.

---

## Direct answers to the six audit questions

1. **Can Accounts be bypassed to save data?**  
   **YES** — StockMovement API/Admin/O&M; invoice can persist without journal/stock; allocation PATCH; seeds.  

2. **Purchase Invoice → Stock IN?**  
   **YES** when status Recorded/Paid and item+warehouse resolve; otherwise silent skip.  

3. **Sell Invoice → Stock OUT?**  
   **NO for physical items today** (choice validation). Service-only lines skip stock by design.  

4. **Stock movement linked to correct Project?**  
   **Dispatch:** linked via MaterialPlan + text reference. **Movements themselves:** no project FK. **Purchases:** optional PI.project only.  

5. **Dispatch + Sell Invoice double deduct?**  
   Project-source billing: **protected**. Accounts-source sell with inventory: **designed to OUT again** (currently blocked by C1; becomes live double-deduct after naive fix of choices alone).  

6. **Ledger / Stock / P&L reconcile?**  
   **Not reliably** — GST-in-totals, Cash credit on dispatch, rate overwrite, silent skips, Sell OUT broken, outstanding test failures.  

---

## Hinglish summary (short)

Accounts, Inventory aur Project ke beech **happy-path Purchase Stock IN** aur **Project Dispatch Stock OUT** code se kaam karte hain. Lekin **Sell Invoice physical Stock OUT tootaa hua hai** kyunki `'Sell Invoice'` `StockMovement` ke allowed reference types mein hi nahi hai — invoice save ho sakta hai, stock/journal nahi. Invoice/dispatch saves **atomic nahi** hain, isliye fail hone par half-data reh jata hai. **StockMovement API, Admin aur O&M** se stock bina proper document ke change ho sakta hai. Challan + Invoice same maal pe **double movement** risk hai. Project Billing (source=Project) stock dobara nahi kaat-ta, lekin Accounts-source Sell Invoice project select karke **dobara OUT** kar sakta hai (choice fix ke baad). P&L mein revenue Sell Invoice se sahi aata hai aur receipts alag hain, magar **GL Cash/Inventory reconcile nahi** (dispatch Cash credit, no COGS) aur **outstanding tests fail** ho rahe hain. Abhi **sirf audit** — koi fix implement nahi kiya.
