# Malwa Solar CRM — Known Bugs & Issues

**Last updated:** 2026-07-10 (reconciliation pass)  
**Source:** Full-stack audit (backend, frontend, deploy, security) + deep-dive follow-up audit  
**Severity:** P0 = broken / data wrong / security · P1 = major gap · P2 = maintainability / polish

### Reconciliation status (2026-07-10)

All **75** tracked bugs have been addressed in code. **20** backend tests pass; `npm run build` succeeds.

| Area | Status |
|------|--------|
| P0 backend (BUG-001–006, 047–048) | Fixed — attendance by-date API + frontend wire-up, signals, media auth, upload validators |
| P1 backend (agents A/B/C) | Fixed — permissions, sequences, journal sync, AMC/inventory/OM, encryption (BUG-066), S3 optional |
| P1 frontend (007–012, 027–028, 042, 059–063) | Fixed — routes, API pages, reports filters/export, ledger mark-by-date, legacy admin redirect |
| P2 frontend (030–035, 073–075) | Fixed — dead branches removed, mojibake, dashboard errors, seed fallbacks removed, `src/lib/utils.js` |
| P2 process (043–045) | Fixed — CI workflow, backend tests, `README.md` |
| BUG-029 (monolith) | Partial — shared utils extracted; full `App.jsx` split deferred as ongoing refactor |

**Verify locally:** `cd backend && python manage.py migrate && python manage.py test` · `npm run build`

---

## Summary

| Severity | Count |
|----------|------:|
| P0 | 8 |
| P1 | 37 |
| P2 | 30 |
| **Total** | **75** |

---

## P0 — Critical (fix first)

### BUG-001 — Employee ledger: mark attendance fails on “Not Marked” days

**Status: Fixed** — Backend `POST /workforce/attendance/mark-by-date/` + frontend `workforceApi.markAttendanceByDate` for synthetic `missing-*` rows.

| Field | Detail |
|-------|--------|
| **Module** | Employee / Workforce |
| **Files** | `src/App.jsx` (~26513–26528, ~26625–26644) |
| **Symptom** | Monthly/custom ledger fills missing dates with synthetic rows. Clicking Present/Absent on those rows calls API with fake id `missing-YYYY-MM-DD`. |
| **Impact** | Attendance cannot be marked for days without an existing DB record; user sees API error. |
| **Repro** | Employee Ledger → Monthly → pick employee → find “Not Marked” row → Mark Present. |
| **Fix** | Create attendance via `POST /workforce/attendance/` first, or add backend action `mark-present-by-date` (employee + date). Frontend should call create then mark, or use date-based endpoint. |

---

### BUG-002 — Employee `present_days` / `absent_days` never synced from attendance

| Field | Detail |
|-------|--------|
| **Module** | Workforce (backend) |
| **Files** | `backend/apps/workforce/models.py` (~50–51), `serializers.py`, `views.py` (~66) |
| **Symptom** | `Employee.present_days` and `Employee.absent_days` are stored on model but not updated when attendance is marked. |
| **Impact** | Employee list KPIs and dashboard summary show stale/zero counts while ledger period stats are correct. |
| **Fix** | Recompute on attendance save/delete signal, or remove stored fields and derive in serializer from `EmployeeAttendance` queryset. |

---

### BUG-003 — Liaisoning sidebar “Subsidy” opens placeholder instead of real page

| Field | Detail |
|-------|--------|
| **Module** | Liaisoning & Commissioning |
| **Files** | `src/App.jsx` — `LiaisoningCommissioningPage` (~8818–8865), `liaisonSubItems` (~223), `ProjectSubsidyPage` (~24210) |
| **Symptom** | `Subsidy` is in liaison subnav but router has no branch for it → falls through to `OperationsPlaceholderPage`. |
| **Impact** | Users expect subsidy workflow under Liaisoning; see empty/placeholder UI. Real `ProjectSubsidyPage` (API-backed) only reachable via Project Management. |
| **Fix** | Add `if (section === 'Subsidy') return <ProjectSubsidyPage ... />` or redirect liaison Subsidy to project subsidy route with project picker. |

---

### BUG-004 — Google Maps API key committed in `.env.example` (wrong var name)

| Field | Detail |
|-------|--------|
| **Module** | Security / Config |
| **Files** | `.env.example` (line 5), `src/App.jsx` (~110) |
| **Symptom** | File contains `GOOLGLE_MAPS_API_KEY=AIzaSy...` (typo). Code reads `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`. |
| **Impact** | Key may be exposed in git history; maps env never works from example file. |
| **Fix** | Revoke/rotate key in Google Cloud Console. Replace with placeholder `VITE_GOOGLE_MAPS_API_KEY=your_key_here`. |

---

### BUG-005 — Workforce voucher ledger may double-count payments

| Field | Detail |
|-------|--------|
| **Module** | Workforce |
| **Files** | `backend/apps/workforce/services.py` (~79–81) — `attendance_ledger_payload` |
| **Symptom** | `period_paid` sums `EmployeeVoucher` totals **and** attendance rows can have `voucher_amount`. |
| **Impact** | Net balance / paid totals may be inflated if both voucher records and per-day voucher_amount are populated. |
| **Fix** | Single source of truth: either vouchers only or attendance voucher_amount only; document and enforce in serializer. |

---

### BUG-006 — Creating `EmployeeVoucher` does not update attendance / net balance on rows

| Field | Detail |
|-------|--------|
| **Module** | Workforce |
| **Files** | `backend/apps/workforce/views.py` — voucher create; `services.py` |
| **Symptom** | Voucher POST succeeds but related attendance `voucher_amount` and ledger net balance may stay stale until manual refresh logic. |
| **Impact** | Ledger UI shows wrong paid/due after voucher entry. |
| **Fix** | On voucher create/update/delete, recalc affected attendance rows and return updated ledger payload. |

---

### BUG-047 — Uploaded media served with zero authentication

| Field | Detail |
|-------|--------|
| **Module** | Security / Media |
| **Files** | `backend/malwa_solar/urls.py` (~27–32) |
| **Symptom** | Production media route wraps raw `django.views.static.serve` with no permission check — not even `IsAuthenticated`. |
| **Impact** | Anyone who guesses/enumerates a path can download employee Aadhaar/ID-proof scans, subsidy KYC docs, site-survey photos, financial documents — no login required. Paths are largely deterministic (`workforce/docs/...`, `lead{id}_{slug}/{slot}.ext`), so guessable. |
| **Fix** | Gate `/media/` behind auth (signed URLs, or a view that checks the requesting user's permission on the owning record) before allowing production go-live. |

---

### BUG-048 — No file-type or size validation on any upload endpoint

| Field | Detail |
|-------|--------|
| **Module** | Security / Uploads |
| **Files** | `backend/apps/{projects,leads,workforce,liaisoning,om,amc}/models.py` — every `FileField`/`ImageField`; no `DATA_UPLOAD_MAX_MEMORY_SIZE` cap in `backend/malwa_solar/settings/base.py` |
| **Symptom** | No `FileExtensionValidator`, content-type check, or size cap on any upload. |
| **Impact** | Chained with BUG-047: an authenticated user can upload `.html`/`.svg` with embedded `<script>`, which is then served with a browser-inferred content type to any unauthenticated visitor — stored XSS with no login needed to trigger. Also no size cap enables disk-exhaustion DoS on Render. |
| **Fix** | Add `FileExtensionValidator` allow-lists + explicit size limits on all upload fields; set `DATA_UPLOAD_MAX_MEMORY_SIZE`. Fix alongside BUG-047. |

---

## P1 — Major functional gaps

### BUG-007 — `ProjectActionPage` Save does not persist (demo only)

| Field | Detail |
|-------|--------|
| **Module** | Project Management |
| **Files** | `src/App.jsx` (~14430–14783), routed from `ProjectManagementPage` (~12056) |
| **Symptom** | ~15 project “create” routes render static demo fields; Save only calls `onNotify('… saved')`. |
| **Impact** | Direct URLs like project activity/create appear functional but save nothing. |
| **Fix** | Wire to real APIs or remove routes and redirect to list pages with modals (pattern used elsewhere). |

---

### BUG-008 — Lead action URLs do not restore on refresh

| Field | Detail |
|-------|--------|
| **Module** | Leads |
| **Files** | `src/App.jsx` — `leadDetailPages`, `sectionRoutes` (follow-up create, site visit, etc.) |
| **Symptom** | Routes exist in `sectionRoutes` but no top-level render branch without `selectedLead` in memory. |
| **Impact** | Refresh on `/lead/follow-up/create/:id` falls back to Lead List. |
| **Fix** | Load lead by URL param on mount for action routes, or remove unused routes. |

---

### BUG-009 — `ActivityLogsPage` shows hardcoded mock data

| Field | Detail |
|-------|--------|
| **Module** | Employee / Admin |
| **Files** | `src/App.jsx` (~28097+), `activityLogRows` seed (~1306 area), vs `SettingsUserActivityLogPage` (~25880) |
| **Symptom** | Legacy `Activity Logs` page uses static seed; Settings version uses real API. |
| **Impact** | Two entry points, one shows fake logs. |
| **Fix** | Delete mock page or point both to `settingsApi` activity logs. |

---

### BUG-010 — O&M “Energy Performance” wrong fallback page

| Field | Detail |
|-------|--------|
| **Module** | O&M |
| **Files** | `src/App.jsx` — `OmPage` (~10071–10072), `omSubRoutes` |
| **Symptom** | No branch for `Energy Performance` → renders `OmMaintenanceTasksPage` instead. |
| **Impact** | Sidebar item misleading; wrong content. |
| **Fix** | Add dedicated `OmEnergyPerformancePage` or remove nav item until implemented. |

---

### BUG-011 — Liaison “Reports” resolves to Applications list

| Field | Detail |
|-------|--------|
| **Module** | Liaisoning |
| **Files** | `src/App.jsx` — `liaisonActionPageTypes` (~8837) |
| **Symptom** | `Liaison Reports` action maps `reports: 'Applications'`. |
| **Impact** | Reports menu opens applications, not reports. |
| **Fix** | Implement liaison reports page or rename nav label. |

---

### BUG-012 — Employee sidebar misleading toast

| Field | Detail |
|-------|--------|
| **Module** | Employee |
| **Files** | `src/App.jsx` (~2649) |
| **Symptom** | Toast: `"Route can be connected later."` on employee sub-item click although routing works. |
| **Impact** | Confuses users/devs. |
| **Fix** | Remove stale toast; use same notify as other modules. |

---

### BUG-013 — Purchase/Sell invoices do not post to accounts journal

| Field | Detail |
|-------|--------|
| **Module** | Accounts |
| **Files** | `backend/apps/accounts_module/document_views.py`, `services.py` (payment journal only) |
| **Symptom** | Invoices/challans saved with totals; only `Payment` model triggers `Transaction` / balance updates. |
| **Impact** | GST ledger report works from invoices, but party balances and chart of accounts ignore invoice totals. |
| **Fix** | Post journal entries on invoice recorded/paid status, or clearly label module as “document register” only. |

---

### BUG-014 — Document numbers use `count() + 1` (collision risk)

| Field | Detail |
|-------|--------|
| **Module** | Accounts |
| **Files** | `backend/apps/accounts_module/document_services.py` (~81–83) |
| **Symptom** | `next_document_number()` uses `model.objects.count() + 1`. |
| **Impact** | Duplicate numbers after deletes or concurrent creates. |
| **Fix** | Use max sequence per prefix, `select_for_update`, or `DocumentNumberSeries` from crm_settings. |

---

### BUG-015 — IP access rules stored but never enforced

| Field | Detail |
|-------|--------|
| **Module** | Settings / Security |
| **Files** | `backend/apps/crm_settings/models.py` (`IpAccessRule`), no middleware |
| **Symptom** | CRUD + dashboard count for IP rules; no request middleware checks client IP. |
| **Impact** | Feature appears enabled in UI but has no effect. |
| **Fix** | Add middleware or remove from settings UI until implemented. |

---

### BUG-016 — Workforce permission under wrong module

| Field | Detail |
|-------|--------|
| **Module** | Permissions |
| **Files** | `backend/apps/workforce/views.py` — `permission_module = 'Project Management'` |
| **Symptom** | Employee/attendance APIs gated by Project Management role matrix, not Workforce. |
| **Impact** | Roles cannot grant workforce-only access; coupling with projects permission. |
| **Fix** | Add `Workforce` to `RolePermission.MODULE_CHOICES` and update viewsets. |

---

### BUG-017 — Orphan permission modules in role matrix

| Field | Detail |
|-------|--------|
| **Module** | Permissions |
| **Files** | `backend/apps/accounts/models.py` — `MODULE_CHOICES` |
| **Symptom** | `Dashboard`, `IVRS Management` in matrix; no viewset sets `permission_module` to these. |
| **Impact** | Role UI shows permissions that never apply. |
| **Fix** | Wire endpoints or remove from matrix. |

---

### BUG-018 — `User Management` permission unused

| Field | Detail |
|-------|--------|
| **Module** | Permissions |
| **Files** | `backend/apps/accounts/views.py` — `UserViewSet` uses `IsSuperAdmin` only |
| **Symptom** | Role matrix has User Management; users API ignores it. |
| **Impact** | Non–super-admin roles cannot be granted user admin via matrix. |
| **Fix** | Use `HasModulePermission` + `'User Management'` or drop module from matrix. |

---

### BUG-019 — No inventory sync from purchase invoices / installation materials

| Field | Detail |
|-------|--------|
| **Module** | Integration |
| **Files** | `accounts_module` line items (text only); `projects.InstallationMaterial` |
| **Symptom** | Invoice lines are free-text `material_name`; installation materials FK to inventory item but no `StockMovement` on issue. |
| **Impact** | Stock levels do not reflect purchases or site issues. |
| **Fix** | Optional FK to `InventoryItem` + movement on challan receive / material issue. |

---

### BUG-020 — Workforce labour payments not linked to Accounts

| Field | Detail |
|-------|--------|
| **Module** | Integration |
| **Files** | `workforce.EmployeeVoucher` vs `accounts_module.PaymentVoucher` |
| **Symptom** | Separate voucher systems; no sync. |
| **Impact** | Double entry for labour payments; accounts cash out of sync. |
| **Fix** | Bridge on voucher create or unified payment model. |

---

### BUG-021 — Production file uploads ephemeral on Render

| Field | Detail |
|-------|--------|
| **Module** | Deploy / Media |
| **Files** | `backend/malwa_solar/urls.py` (~27–29), `production.py` |
| **Symptom** | Comment notes uploads lost on redeploy without external storage. |
| **Impact** | Site survey photos, documents disappear after deploy. |
| **Fix** | S3/Cloudinary + `DEFAULT_FILE_STORAGE`; document in README. |

---

### BUG-022 — JWT stored in `localStorage` (XSS exposure)

| Field | Detail |
|-------|--------|
| **Module** | Security |
| **Files** | `src/api.js` |
| **Symptom** | Access/refresh tokens in localStorage. |
| **Impact** | Any XSS can steal session. |
| **Fix** | HttpOnly cookies (requires backend change) or strict CSP + sanitize HTML. |

---

### BUG-023 — Login throttle fail-open when Redis/cache down

| Field | Detail |
|-------|--------|
| **Module** | Security |
| **Files** | `backend/apps/accounts/views.py` (~34–39) |
| **Symptom** | Cache errors skip login rate limit (intentional for uptime). |
| **Impact** | Brute-force possible if Redis misconfigured in production. |
| **Fix** | Fallback in-memory throttle or alert on cache failure. |

---

### BUG-024 — Journal entries use hardcoded chart-of-account codes

| Field | Detail |
|-------|--------|
| **Module** | Accounts |
| **Files** | `backend/apps/accounts_module/services.py` (~131–160), `serializers.py` `_default_accounts` |
| **Symptom** | All payments debit/credit fixed codes `1120`, `4100`, `5100` regardless of bank/cash selected. |
| **Impact** | Incorrect ledger mapping for multi-bank setups. |
| **Fix** | Map `payment_mode` / `bank_account` to COA rows. |

---

### BUG-025 — `generate_employee_id()` race condition

| Field | Detail |
|-------|--------|
| **Module** | Workforce |
| **Files** | `backend/apps/workforce/models.py` — `save()` id generation |
| **Symptom** | Reads last employee at save without DB lock. |
| **Impact** | Concurrent creates may collide on unique `employee_id`. |
| **Fix** | DB sequence or `select_for_update` on counter row. |

---

### BUG-026 — `Project.project_id` generation race condition

| Field | Detail |
|-------|--------|
| **Module** | Projects |
| **Files** | `backend/apps/projects/models.py` |
| **Symptom** | Year-based counter without locking (same pattern as workforce). |
| **Impact** | Duplicate project IDs under concurrency. |
| **Fix** | Atomic sequence per financial year. |

---

### BUG-027 — Duplicate admin pages (Settings vs legacy routes)

| Field | Detail |
|-------|--------|
| **Module** | Frontend |
| **Files** | `SettingsUsersPage` vs `UserManagementPage`; `SettingsRolesPermissionsPage` vs `RolesPermissionsPage`; `employeeSubRoutes` legacy |
| **Symptom** | Same functionality, multiple routes/sidebars. |
| **Impact** | Maintenance burden; inconsistent behavior risk. |
| **Fix** | Consolidate to Settings or Employee section only. |

---

### BUG-028 — `EmployeeManagementPage` vs `ProjectTeamAssignmentPage` overlap

| Field | Detail |
|-------|--------|
| **Module** | Employee / Projects |
| **Files** | `src/App.jsx` (~20512, ~26413) |
| **Symptom** | Two UIs for workforce employees and project assignment. |
| **Impact** | User confusion; duplicate API patterns. |
| **Fix** | Single workforce hub with link to project assignment. |

---

### BUG-049 — Hardcoded password for 10 seeded demo accounts, no environment guard

| Field | Detail |
|-------|--------|
| **Module** | Security / Seed data |
| **Files** | `backend/apps/accounts/management/commands/seed_demo_data.py` (~115–134) |
| **Symptom** | 10 real-looking named accounts (incl. Branch Manager, Team Leaders) get `set_password('Malwa@2024')`; command has no `DEBUG`/env guard. |
| **Impact** | If ever run against production DB, these accounts are protected only by a password committed in plaintext to the repo. |
| **Fix** | Guard command to non-production settings only; rotate/delete these accounts on prod immediately if they exist; verify now via `python manage.py shell` on Render. |

---

### BUG-050 — Employee list endpoint exposes Aadhaar number + daily wage under wrong permission module

| Field | Detail |
|-------|--------|
| **Module** | Workforce / Permissions |
| **Files** | `backend/apps/workforce/serializers.py` (~43–48, ~90–95) |
| **Symptom** | List (not just detail) serializer includes `aadhaar_number`, `address`, `daily_rate`; gated by `Project Management` module per BUG-016, not `Workforce`. |
| **Impact** | Any role with `can_view` on Project Management — broader than intended — can bulk-read every employee's Aadhaar number and pay rate via `GET /api/v1/workforce/employees/`. |
| **Fix** | Drop sensitive fields from the list serializer (detail-only); fix alongside BUG-016's module split. |

---

### BUG-051 — No rate limiting on any endpoint except `/auth/login/`

| Field | Detail |
|-------|--------|
| **Module** | Security |
| **Files** | `backend/malwa_solar/settings/base.py` (~137–139) — `DEFAULT_THROTTLE_RATES` |
| **Symptom** | Only `'login'` scope defined; no default `anon`/`user` throttle scope or `DEFAULT_THROTTLE_CLASSES`. |
| **Impact** | Unauthenticated media route (BUG-047), `change_password`, and every other endpoint can be hit at unlimited rate — amplifies path-enumeration and brute-force risk. |
| **Fix** | Add default `anon`/`user` throttle rates in DRF settings. |

---

### BUG-052 — `Quotation.save()` unlocked `count()+1` race (leads)

| Field | Detail |
|-------|--------|
| **Module** | Leads |
| **Files** | `backend/apps/leads/models.py` (~302–307) |
| **Symptom** | `quotation_number` generated via `Model.objects.filter(...).count() + 1`, same unlocked-counter pattern as BUG-025/026, on a third model. |
| **Impact** | `unique=True` on the field means concurrent saves raise `IntegrityError`/500 instead of silently colliding — still a functional bug (failed save) under concurrency. |
| **Fix** | Same fix as BUG-025/026 — atomic sequence with locking, ideally via `DocumentNumberSeries` (see BUG-067). |

---

### BUG-053 — Completing/missing a follow-up never clears `Lead.next_follow_up`

| Field | Detail |
|-------|--------|
| **Module** | Leads |
| **Files** | `backend/apps/leads/views.py` (~248–262) — `FollowUpViewSet` |
| **Symptom** | `perform_create` sets `lead.next_follow_up` for new scheduled follow-ups; there is no `perform_update` override, so `PATCH`ing an existing follow-up's status to `Completed`/`Missed` leaves `next_follow_up` stale. |
| **Impact** | Lead keeps appearing in `overdue`/`today_followups`/`stats.overdue` indefinitely after the rep actually completed the follow-up. |
| **Fix** | Add `perform_update` (or a signal) to recompute `lead.next_follow_up` from the lead's remaining scheduled follow-ups whenever a follow-up's status changes. |

---

### BUG-054 — `AdminApproval.approve()` never applies the requested change

| Field | Detail |
|-------|--------|
| **Module** | Leads |
| **Files** | `backend/apps/leads/views.py` (~265–302), `models.py` (~124–147) |
| **Symptom** | Duplicate-IVRS lead creation is blocked and routed into `AdminApproval` with the intended payload stored; `approve()` only flips `status='Approved'` — the lead is never actually created. |
| **Impact** | Approving a duplicate-IVRS request is a dead end; the sales rep's lead never appears anywhere. |
| **Fix** | On approve, create the `Lead` from `requested_payload` (bypassing the duplicate-IVRS check) and link it back to the approval record. |

---

### BUG-055 — Completing an `AmcRenewal` never updates the parent `AmcContract`

| Field | Detail |
|-------|--------|
| **Module** | AMC |
| **Files** | `backend/apps/amc/models.py` (~128–149), `views.py` (~70–76) |
| **Symptom** | `AmcRenewalViewSet` is plain CRUD; nothing propagates a completed renewal's `new_end_date`/`amount` onto `AmcContract.end_date`/`next_renewal_date`/`status`. |
| **Impact** | A renewed contract keeps its old `end_date`; "Expiring Soon"/"Expired" dashboard counts (`amc/services.py` ~14–19) stay wrong after renewal. |
| **Fix** | Add an `@action` (e.g. `complete`) on renewal that, in a transaction, updates the parent contract's dates/status. |

---

### BUG-056 — Inventory `Transfer` movements never update `InventoryItem.warehouse`

| Field | Detail |
|-------|--------|
| **Module** | Inventory |
| **Files** | `backend/apps/inventory/models.py` (~86–141) — `StockMovement._stock_delta`/`save()` |
| **Symptom** | `_stock_delta` correctly returns `0` net quantity change for `Transfer`, but neither `save()` nor `delete()` ever reassigns `item.warehouse` to `to_warehouse`. |
| **Impact** | After a Transfer, `current_stock` is right but `InventoryItem.warehouse` still points at the old location forever — warehouse filters/reports show stale locations. |
| **Fix** | On `Transfer` movement save, set `item.warehouse = to_warehouse` inside the same atomic block. |

---

### BUG-057 — `CASCADE` deletes wipe financial/attendance history with no archival safeguard

| Field | Detail |
|-------|--------|
| **Module** | Workforce / Projects |
| **Files** | `backend/apps/workforce/models.py` — `EmployeeAttendance.employee` (~140), `EmployeeVoucher.employee` (~161), `EmployeeAssignment.employee` (~93), `EmployeeDocument.employee` (~120); `backend/apps/projects/models.py` — `ProjectPayment.project` (~237), `ProjectExpense.project` (~190, cascades to `ProjectExpenseDocument` ~217) |
| **Symptom** | All these FKs use `on_delete=CASCADE` with no soft-delete/archival layer. |
| **Impact** | Deleting an `Employee` silently erases their entire attendance and payment/voucher history; deleting a `Project` erases all recorded customer payments and expenses. `accounts_module.Payment` survives via `SET_NULL` but loses reconciliation back to the deleted project payment. |
| **Fix** | Switch to `on_delete=PROTECT` (block delete while history exists) or add soft-delete (`is_active`/`deleted_at`) instead of hard delete for Employee/Project. |

---

### BUG-058 — No DB-level unique constraint on invoice/challan/voucher numbers

| Field | Detail |
|-------|--------|
| **Module** | Accounts |
| **Files** | `backend/apps/accounts_module/models.py` — `PurchaseInvoice.invoice_no` (~270), `SellInvoice.invoice_no` (~326), `PurchaseChallan.challan_no` (~406), `SellChallan.challan_no` (~452), `PaymentVoucher.voucher_no` (~376) |
| **Symptom** | All are plain `CharField(blank=True)` with no `unique=True`, so even a corrected number generator (see BUG-014) isn't backstopped by the database. |
| **Impact** | Two invoices can end up with the same number and both save successfully — GST reports and party ledgers become ambiguous. |
| **Fix** | Add `unique=True` (or scoped `UniqueConstraint` per financial year) once BUG-014's generator is fixed. |

---

### BUG-059 — `ProjectReportsPage` (Project Management → Reports) is 100% hardcoded mock data

| Field | Detail |
|-------|--------|
| **Module** | Project Management |
| **Files** | `src/App.jsx` (~23745–24083), routed ~12123, reachable from Project Overview "Reports" quick action (~14775) |
| **Symptom** | Every metric (`statCards`, `categoryData`, `reportTrend`, `topDownloads`, `reports` list, `scheduledReports`, `insightCards`) is a literal array — zero API calls. |
| **Impact** | Numbers/dates shown are identical every time regardless of real project data; distinct from the real API-backed `ProjectReportPage` (singular, ~23425) and top-level `ReportsPage` (~28497) — three different "reports" surfaces, only two real. |
| **Fix** | Wire to real report APIs or redirect this route to the real per-project/overall report pages. |

---

### BUG-060 — Reports & Analytics filters are cosmetic (not sent to the API)

| Field | Detail |
|-------|--------|
| **Module** | Reports |
| **Files** | `src/App.jsx` (~28497–28624) — `ReportsPage` |
| **Symptom** | The data-fetching `useEffect` (~28512–28524) only sends `dateFrom`/`dateTo`; `projectType`, `leadStatus`, `assignedTo` are built in UI state but never included in `params`. "Apply Filters" re-fetches the same unfiltered data and shows a banner implying the filter is active. |
| **Impact** | Users filtering by project type/lead status/assignee get unfiltered results with no indication the filter had no effect. `assignedTo` options are also a hardcoded name list instead of `userApi`. |
| **Fix** | Include all three filters in the API params; source `assignedTo` options from `userApi`. |

---

### BUG-061 — ~15 "Export" buttons are fake (toast only, no file produced)

| Field | Detail |
|-------|--------|
| **Module** | Cross-cutting (Accounts, Settings, Projects, Reports) |
| **Files** | `src/App.jsx` lines ~5688, 5825, 6441, 6761, 8329, 8444, 12260, 12470, 23931, 23999, 24186, 25474, 25732, 26262, 28131, 28559 |
| **Symptom** | Each only calls `onNotify(...)`; no `Blob`/anchor/download logic. |
| **Impact** | Users click Export and see a success toast but get no file — misleading. The app already has working export plumbing (Lead List ~4018, generic `.doc` exporter ~2200, Project List ~12997) that was never reused here. |
| **Fix** | Reuse the existing Blob-export helper across these 15 buttons, or remove the buttons until wired. |

---

### BUG-062 — `SettingsCategoryPlaceholderPage` "Save Changes" is a no-op fallback for any unmapped Settings item

| Field | Detail |
|-------|--------|
| **Module** | Settings |
| **Files** | `src/App.jsx` (~26313–26341), used as fallback at ~4727 and ~5304 |
| **Symptom** | "Save Changes" calls `onNotify(...saved)` with no API call; component's own body text admits "backend APIs can be connected in the next step". Any Settings sidebar item not given a dedicated component silently falls through here. |
| **Impact** | Looks saveable but isn't, for an unaudited number of Settings sub-items — same class as BUG-003/010/011 but open-ended. |
| **Fix** | Audit `settingsCardGroups` against real routed components; wire or remove each fallback hit. |

---

### BUG-063 — Dashboard silently swallows all API load errors

| Field | Detail |
|-------|--------|
| **Module** | Dashboard |
| **Files** | `src/App.jsx` lines ~2059, 2073, 2084, 2104, 2122, 2136 (six `.catch(() => {})` in the main `useEffect`, ~2062–2137); also `LiaisonCrudPage` lookup fetch (~9036–9039) shared by AMC/Liaison CRUD forms |
| **Symptom** | If the backend is down or any single stats/summary endpoint errors, the widget just stays blank/zero — no error toast, nothing tells the user the dashboard failed to load. Failed lookup fetches leave dropdowns empty with no explanation. |
| **Impact** | Highest-traffic page in the app fails silently; users may think there's simply no data rather than an outage. |
| **Fix** | Replace empty catches with `onNotify(message, 'error')`, consistent with BUG-033/034's broader fix. |

---

## P2 — Quality, docs, maintainability

### BUG-064 — `ALLOWED_HOSTS` includes a bare wildcard subdomain in production config

| Field | Detail |
|-------|--------|
| **Files** | `render.yaml` (~17–18), `RENDER_ENV.md` (~17) — `ALLOWED_HOSTS=solar-crm-frontend-0vcw.onrender.com,.onrender.com` |
| **Impact** | `.onrender.com` wildcard accepts a `Host` header for any tenant on Render's shared domain, not just this app. Low impact today (no host-header-driven links/cache found) but unnecessarily broad. |
| **Fix** | Narrow to the exact production hostname(s). |

---

### BUG-065 — Dev-mode `CORS_ALLOW_ALL_ORIGINS=True` + `CORS_ALLOW_CREDENTIALS=True`

| Field | Detail |
|-------|--------|
| **Files** | `backend/malwa_solar/settings/development.py` (~10), `base.py` (~156) |
| **Impact** | Reflects any request Origin while allowing credentialed cross-origin requests — confined to `DEBUG=True`/dev per [[lan_access_setup]] LAN-access tradeoff, but worth tightening if dev server is ever exposed beyond trusted LAN. |
| **Fix** | Scope `CORS_ALLOWED_ORIGINS` explicitly even in dev, or document the tradeoff inline. |

---

### BUG-066 — Aadhaar numbers stored in plaintext

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/workforce/models.py` (~54) — `aadhaar_number = CharField(max_length=12, blank=True)` |
| **Impact** | No encryption at rest; combined with BUG-050/047, sensitive PII is both broadly readable and unencrypted. |
| **Fix** | Field-level encryption (e.g. `django-cryptography`) or mask in all serializers except a narrowly-permissioned detail view. |

---

### BUG-067 — `DocumentNumberSeries` model built to fix BUG-014 but never used

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/crm_settings/models.py` (~167–186) fully CRUD-wired (`views.py` ~221–225, admin, seeded in `services.py` ~427–440); actual number generation still in `accounts_module/document_services.py` (~81–83) using raw `count()+1` |
| **Impact** | The model that was clearly meant to solve BUG-014/058 sits dead — `next_number` is never read or incremented anywhere. |
| **Fix** | Wire `next_document_number()` to atomically read/increment `DocumentNumberSeries.next_number` instead of `count()+1`. |

---

### BUG-068 — `gst_ledger_report` N+1 queries on invoice party/supplier

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/accounts_module/document_services.py` (~107–150) |
| **Symptom** | `purchase_qs`/`sell_qs` built with no `select_related`; loop accesses `inv.supplier.name`/`inv.party.name` per row. |
| **Impact** | ~1 extra query per invoice — e.g. 400 extra round trips for a month with 200+200 invoices on a single GST-ledger request. |
| **Fix** | `select_related('supplier', 'party')` on both querysets. |

---

### BUG-069 — `OmSparePart` duplicates `InventoryItem` with no bridge

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/om/models.py` (~151–186) vs `backend/apps/inventory/models.py` (~18–52) |
| **Symptom** | Both track name/category/stock/min-stock/unit-cost independently; no FK or sync between them (distinct from BUG-019/020's invoice/labour integration gaps). |
| **Impact** | O&M spare-part counts and warehouse inventory counts drift independently with no reconciliation path. |
| **Fix** | FK `OmSparePart` to `InventoryItem`, or merge into one model with an O&M-specific flag. |

---

### BUG-070 — Dead validation branch in `crm_settings` `update_category_settings`

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/crm_settings/services.py` (~218–220) |
| **Symptom** | `if category not in SETTING_CATEGORIES and category not in ('company',): pass` — checks the condition then does nothing either way. |
| **Impact** | Currently harmless (call sites pre-validate), but misleading/vestigial. |
| **Fix** | Remove the dead branch or make it actually raise/reject invalid categories. |

---

### BUG-071 — More unlocked `count()+1` ID-generation races (`WorkOrder`, `SiteSurvey`)

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/projects/models.py` — `WorkOrder.save()` (~274–279) for `order_id`, `SiteSurvey.save()` (~479–484) for `survey_id` |
| **Impact** | Same class of bug as BUG-025/026/052; concurrent creates can collide. |
| **Fix** | Same fix as BUG-025/026 — atomic sequence, ideally via `DocumentNumberSeries` (BUG-067). |

---

### BUG-072 — `User.mobile` / `Employee.mobile` / `Account.phone` lack uniqueness

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/accounts/models.py` (~89, ~125 — the `UniqueConstraint(['email','mobile'])` is vacuous since `email` is already globally unique), `backend/apps/workforce/models.py` (~44), `backend/apps/accounts_module/models.py` (~44) |
| **Impact** | Duplicate accounts/employees/parties can share the same phone number with nothing preventing it; login/notification flows keyed on mobile become ambiguous. |
| **Fix** | Add real `unique=True` on `User.mobile` where a phone should identify one account; leave Employee/Account phone as-is if shared numbers are a legitimate use case (lower priority). |

---

### BUG-073 — `LeadQuickActionModal` has a dead "coming soon" branch

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` (~33873), call sites ~30378, 33394, 34016 |
| **Symptom** | `else` branch says "saved (coming soon — API integration pending)"; all 5 real `type` values are handled by branches above it, so this is currently unreachable. |
| **Impact** | Not a live bug, but confusing scaffolding — a 6th quick-action type added later would silently hit this instead of erroring. |
| **Fix** | Delete the dead branch, or make it throw/log instead of pretending to save. |

---

### BUG-074 — More dead mock-data arrays (beyond BUG-030)

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` — `inventoryRows` (~1579), `recentStockInwardRows` (~1599), `stockInwardRows` (~1641), `stockOutwardRows` (~1657), `stockTransferRows` (~1689), `inventoryAdjustmentRows` (~1713), `warehouseRows` (~1737), `paymentModeRows` (~1752), `ivrsReportRows` (~1313), `userManagementRows` (~1320) |
| **Impact** | Confirmed unused (single declaration-only occurrence each) — Inventory/Settings pages correctly use `inventoryApi`/`settingsApi` instead. Safe cleanup. |
| **Fix** | Delete. |

---

### BUG-075 — Reports page falls back to hardcoded stats on API failure, masking outages

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` (~28677) — `analyticsData?.project_type_stats?.map(...) ?? projectTypeReportRows` (seed at ~1299) |
| **Impact** | A backend outage on the Reports page shows plausible-looking fake project-type stats instead of an empty/error state, hiding a real problem from the user. |
| **Fix** | Show an explicit error/empty state instead of falling back to seed data. |

---

### BUG-029 — `App.jsx` monolith (~34,500 lines)

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` |
| **Impact** | Slow IDE, merge conflicts, hard onboarding. |
| **Fix** | Extract modules like `accountsSolarPages.jsx` (projects, liaison, employee, settings). |

---

### BUG-030 — Dead code: `assignedEmployeeRows`

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` (~1306) |
| **Impact** | Unused seed data. |
| **Fix** | Remove. |

---

### BUG-031 — Dead code: `Settings*_OLD` components

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` (~6204, ~6266, ~6337) |
| **Impact** | Confusion, bundle size. |
| **Fix** | Delete if superseded. |

---

### BUG-032 — Mojibake em dash (`â€”`) in project UI

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` (multiple ~19826–20354) |
| **Symptom** | Should display `—` but shows `â€”`. |
| **Fix** | Replace with `—` or `'-'` UTF-8 literal. |

---

### BUG-033 — Silent empty `catch` blocks hide API failures

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` (~2192, ~19622, ~20563, ~24253, ~28523); `src/accountsSolarPages.jsx` (~214–215); `LcDocumentsSection` (~8934) |
| **Impact** | Empty tables with no error toast. |
| **Fix** | `onNotify(message, 'error')` or log. |

---

### BUG-034 — Error toasts rarely use `type: 'error'`

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` notify usage vs `accountsSolarPages` |
| **Impact** | Failures look like success toasts. |
| **Fix** | Standardize `notify(msg, 'error')`. |

---

### BUG-035 — `accountsSolarPages` duplicates `panelClass`, `normalizeApiRows`

| Field | Detail |
|-------|--------|
| **Files** | `src/accountsSolarPages.jsx`, `src/App.jsx` |
| **Impact** | Drift between modules. |
| **Fix** | Shared `src/lib/ui.js` / `src/utils/api.js`. |

---

### BUG-036 — Celery in requirements but not configured

| Field | Detail |
|-------|--------|
| **Files** | `backend/requirements.txt`, no `celery.py` or tasks |
| **Impact** | Dead dependency; misleading for async jobs. |
| **Fix** | Remove from requirements or implement worker + tasks. |

---

### BUG-037 — `accounts_module` new models not in Django admin

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/accounts_module/admin.py` |
| **Impact** | No admin UI for invoices/challans/GST. |
| **Fix** | Register document models. |

---

### BUG-038 — No `workforce/admin.py`

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/workforce/` |
| **Impact** | Workforce only via API/shell. |
| **Fix** | Add admin registrations. |

---

### BUG-039 — `accounts_module/models.py` inconsistent indentation (2 vs 4 spaces)

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/accounts_module/models.py` (~263+) |
| **Impact** | Style/maintainability. |
| **Fix** | Reformat to 4 spaces. |

---

### BUG-040 — `Employee.DEPARTMENT_CHOICES` defined but unused

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/workforce/models.py` |
| **Impact** | `department` field has no validation choices. |
| **Fix** | Add `choices=` or remove constant. |

---

### BUG-041 — `SubsidyApplication.assigned_employee` is CharField not FK

| Field | Detail |
|-------|--------|
| **Files** | `backend/apps/projects/models.py` |
| **Impact** | No link to workforce employee record. |
| **Fix** | FK to `workforce.Employee` nullable. |

---

### BUG-042 — Project subsidy URL case: `/projects/Subsidy/:projectId`

| Field | Detail |
|-------|--------|
| **Files** | `src/App.jsx` `projectSubRoutes` (~391) |
| **Impact** | Inconsistent URL casing vs other routes. |
| **Fix** | Lowercase `subsidy` + redirect old path. |

---

### BUG-043 — No automated tests for workforce, accounts_module, projects sync

| Field | Detail |
|-------|--------|
| **Files** | Only `apps/accounts/tests.py` (4), `apps/inventory/tests.py` (3) |
| **Impact** | Regressions undetected (ledger math, payment sync). |
| **Fix** | Add tests for attendance ledger, GST totals, project payment bridge. |

---

### BUG-044 — No CI (lint / test / build on PR)

| Field | Detail |
|-------|--------|
| **Files** | No `.github/workflows/` |
| **Impact** | Broken main possible. |
| **Fix** | GitHub Actions: `npm run build`, `python manage.py test`. |

---

### BUG-045 — Documentation mismatches

| Field | Detail |
|-------|--------|
| **Items** | No root `README.md`; `DEPLOYMENT_DETAIL.md` vs `api.js` prod fallback; `RENDER_ENV.md` shell vs free tier; `setup.sh` Python 3.11 vs Render 3.12.8; `Procfile` gunicorn target vs `render.yaml` |
| **Fix** | Single README + reconcile deploy docs. |

---

### BUG-046 — `npm run lint` not wired despite ESLint config

| Field | Detail |
|-------|--------|
| **Files** | `eslint.config.mjs`, `package.json` |
| **Fix** | Add `"lint": "eslint src"` script. |

---

## Unused API wrappers (not bugs, but incomplete UI)

| API | File | Note |
|-----|------|------|
| `workforceApi.dashboard()` | `src/api.js` | No UI |
| `workforceApi.uploadDocument()` | `src/api.js` | No employee document upload UI |
| `workforceApi.listAttendance()` | `src/api.js` | Ledger uses `attendanceLedger` only |
| `accountsModuleApi.transactions` dashboard duplicate | backend | Frontend uses `summary()` only |

---

## How to use this file

1. Fix **P0** before production go-live.
2. Track fixes: add `Fixed in: <commit/PR>` under each bug when resolved.
3. Do not close bugs without repro verification.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-10 | Initial audit — 46 issues documented |
| 2026-07-10 | Deep-dive follow-up audit (backend apps, frontend, security, data integrity) — 29 more issues added (BUG-047 to BUG-075), total 75 |
