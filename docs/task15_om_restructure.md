# TASK 15 – O&M MODULE RESTRUCTURING & COMPLETE WORKFLOW OPTIMIZATION

**Project:** Malwa Solar CRM  
**Module:** Operation & Maintenance (O&M)  
**Objective:** Simplify O&M navigation, remove duplicate tabs, organize all service operations and establish a complete Solar Service ERP workflow.

## 1. O&M SIDEBAR – REDUCE TO 5 MAIN SECTIONS

1. **Dashboard & Plants** — Dashboard, Plant List, Add Existing Plant, Plant Details tabs  
2. **Service Desk** — Complaint Tickets (with request types), Job Cards, Site Visits, Material Requests, Customer Feedback  
3. **Maintenance Management** — Quarterly PM, Panel Cleaning, Monthly/Quarterly/Yearly/Upcoming/Overdue filters  
4. **Warranty, Insurance & AMC** — Panel/Inverter/Service warranties, Claims, Replacement, Insurance, AMC  
5. **Reports & Monitoring** — Service/Job history, unified Performance & Generation, Engineer/Customer reports  

**Tracker stays separate** (Work Order → Quotation → Dispatch → Installation → Invoice).

## 2–11.

See full acceptance criteria: preserve DB/APIs, map deep-links, local test only, no prod deploy without authorization.

## Implementation notes (local — verified)

- Primary files: `src/omHubPages.jsx`, `src/App.jsx`, `src/omPlantPages.jsx`, `src/omServicePages.jsx`
- BE: `om/models.py` + migration `0011_complaint_request_types.py` (request types; no data delete)
- No model deletion; navigation + workflow wiring only
- Tracker remains separate (`/om/pending-*`)
- Local checks: all 5 hub routes, Plant Digital History tabs, legacy `/om/overview` → Dashboard & Plants
- **No production deploy** without authorization
