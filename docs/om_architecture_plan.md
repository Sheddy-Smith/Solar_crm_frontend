# O&M Module — Phase 1 Audit & Architecture Plan

**Branch:** `feature/e2e-bom-dashboard-automation`  
**Date:** 2026-11-14  
**Status:** APPROVED TO IMPLEMENT (master prompt) — phased, no production deploy

---

## 1. Repository Audit Summary

| Area | Finding |
|------|---------|
| Existing `apps/om` | OmPlant (1:1 Project), OmBreakdownTicket, OmMaintenanceTask, OmSiteVisit, OmInsurance, OmAsset, OmSparePart, OmVisitPart, OmReport, OmDocument + pending flow + dashboard |
| Existing `apps/amc` | **Separate module** — AmcContract, AmcWarranty, AmcServiceRequest, AmcVisit, AmcRenewal, AmcClaim, AmcDocument; sidebar **AMC & Warranty** |
| Customer Master | `accounts_module.Account` (account_type=Customer) |
| Project | `projects.Project` — lead FK, customer FK, commissioning → OmPlant activation |
| Inventory | `StockMovement` (Inward/Outward) — authoritative stock |
| Accounts | Payment / invoices — authoritative finance |
| Permissions | Role module `O&M`, `O&M Field Work`, `AMC & Warranty` |
| FE today | O&M sidebar cleared to Dashboard only (user request); page code still present |

### Duplicate / Overlap Risk

| Prompt feature | Existing | Strategy |
|----------------|----------|----------|
| AMC Management | `apps/amc` AmcContract | **Reuse & extend** — do not create second AMC table |
| Service Requests | AmcServiceRequest + OmBreakdownTicket | Unify under O&M UI; prefer evolve Om tickets + link Amc SR |
| Site Visits | OmSiteVisit + AmcVisit | **Prefer OmSiteVisit** as canonical; AmcVisit read legacy |
| Warranty | AmcWarranty | **Reuse** under O&M → Warranty Management |
| Preventive | OmMaintenanceTask (Quarterly) | Extend with MaintenancePlan scheduler |
| Job Cards | **Missing** | **New** OmJobCard |
| Spare / Inventory | OmSparePart + StockMovement | Material request → Inventory issue (no stock write from O&M) |
| Plant Performance | OmAsset energy fields | Manual/import only — no fake live data |
| Feedback | Missing | New OmCustomerFeedback |

---

## 2. Data Ownership (One Source of Truth)

```
Customer Master + Project Management
        ↓ (FK fetch only)
   O&M Module (AMC • Complaints • Job Cards • Visits • Warranty)
     ↓                    ↓
 Inventory            Accounts
 (issue/return)       (invoice/payment)
        ↓
 Customer Profile + Client Ledger + Reports
```

- **Never** create duplicate Customer / Project / Employee / Inventory / Payment rows from O&M.
- Installation completion % stays on Project; O&M has separate service completion fields.

---

## 3. Target Sidebar (exactly 6 categories)

1. O&M Dashboard  
2. AMC & Warranty — tabs: Contracts, Renewals, Expiry, Warranty, Claims, Equipment Replacement  
3. Service & Complaints — tabs: Service Requests, Complaints, Breakdown, Preventive, Scheduling, Follow-ups  
4. Job Cards & Site Visits — tabs: Job Cards, Assignment, Visits, Checklist, Materials, Completion, History  
5. Plant Monitoring & Reports — tabs: Generation, Performance, Maintenance/Service Reports, Feedback, Export  
6. O&M Settings — tabs: Categories, AMC Plans, Schedules, Checklists, Notifications, Configuration  

Legacy deep-links map into these 6 via `OM_NAV_RESOLVE` (no feature removal).

---

## 4. Implementation Phases

| Phase | Scope | Status |
|-------|--------|--------|
| 1 | Audit + this plan | DONE |
| 2 | Sidebar + page shells + dashboard KPIs from real APIs | DONE |
| 3 | Extend AMC/Service/Complaint/PM/JobCard/Visits | PARTIAL (JobCard + MaterialRequest + Plan + Feedback + Generation APIs live) |
| 4 | Warranty/Equipment/Inventory/Accounts/Employee glue | PARTIAL (reuse AMC warranty + material link-issue; Accounts payment KPI pending) |
| 5 | Performance/Feedback/Reports/Notifications | PARTIAL (generation logs + feedback list) |
| 6 | UI polish | PARTIAL (hub pages wired) |
| 7 | Tests + build (no prod deploy) | IN PROGRESS |

---

## 5. Files (planned)

**Reuse:** `backend/apps/om/*`, `backend/apps/amc/*`, `src/omPlantPages.jsx`, `src/omServicePages.jsx`, `src/api.js`  
**New:** `OmJobCard`, `OmMaintenancePlan`, `OmMaterialRequest`, `OmCustomerFeedback`, `OmGenerationLog`, `src/omHubPages.jsx`  
**Nav:** `src/App.jsx`, `OM_SECTION_ROUTES`

---

## 6. Explicit Non-Goals (this rollout)

- No production deploy / no production DB writes  
- No second Customer/Project/Inventory/Accounts models  
- No fabricated live inverter generation  
- Do not silently overwrite Project installation completion  
