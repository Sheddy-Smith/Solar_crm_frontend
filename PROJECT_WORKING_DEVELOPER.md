# Malwa Solar CRM - Developer Side Working

Is file me project ki developer-facing working module-wise document hogi. Har module me code structure, data source, components, state, events, styling, aur backend/API integration points likhne hain.

Future rule: jab Lead module document karna ho, to Lead ki developer-side implementation details isi file ke `Lead` section me add karni hain.

---

## Dashboard

Dashboard currently `src/App.jsx` ke main `App` component ke default render branch me implemented hai. Jab `activeSidebarItem` kisi specific module route se match nahi hota, tab Dashboard UI render hota hai.

### Main Files

- `src/App.jsx`: Dashboard data, layout, components, interactions.
- `src/index.css`: global table styles, responsive overflow behavior, base app styling.

### Dashboard Data Sources

Dashboard ke data abhi static constants se aa rahe hain:

- `stats`: top KPI cards.
- `todayFollowUps`: today follow-up table/card data.
- `recentLeads`: recent leads table/card data.
- `overdueFollowUps`: overdue follow-up list data.
- `quickActions`: quick action button configuration.
- `tableHeaders`: today follow-up table headers.
- `recentHeaders`: recent leads table headers.

Future backend integration me in constants ko API/state layer se replace karna hoga.

### Main Components Used

Dashboard UI me ye reusable components use ho rahe hain:

- `StatCard`: KPI summary card.
- `SectionHeader`: section title, icon, optional action button.
- `FollowUpCard`: mobile card for today follow-ups.
- `RecentLeadCard`: mobile card for recent leads.
- `AssigneeCell`: assigned user avatar/name display.
- `StatusBadge`: lead status badge.
- `Toast`: click feedback/status message.

### Layout Behavior

- Top KPI grid: `sm:grid-cols-2`, `lg:grid-cols-3`, `xl:grid-cols-5`.
- Today Follow-ups + Quick Actions: responsive grid with main content and right aside.
- Recent Leads + Overdue Follow-ups: responsive grid with main content and right aside.
- Tables use `.crm-table` and horizontal overflow containers.
- Mobile views switch tables to card layouts for follow-ups and recent leads.

### Current Click Behavior

Most Dashboard actions currently call `notify(...)` and show a toast. Examples:

- View follow-up: `${customer} follow-up opened`
- View all follow-ups: `All follow-ups opened`
- Quick action: `${action.label} action started`
- View all recent leads: `All recent leads opened`
- View all overdue follow-ups: `All overdue follow-ups opened`

Future improvement: quick actions should route to real module pages:

- Add Lead -> Create Lead page
- Add Follow-up -> Follow-up create/update flow
- Create Quotation -> quotation module/form

### Styling Notes

Dashboard uses Tailwind utility classes heavily inside JSX. Shared visual shells:

- `panelClass`: regular white panel/card style.
- `dataPanelClass`: table/data panel style.
- `.crm-table`: table styling in `src/index.css`.

### Integration Notes

For backend integration, Dashboard needs APIs for:

- KPI summary counts.
- Today follow-ups.
- Recent leads.
- Overdue follow-ups.
- Revenue overview.
- Notification/message counts if header badges become dynamic.

Recommended API shape:

```json
{
  "stats": [],
  "todayFollowUps": [],
  "recentLeads": [],
  "overdueFollowUps": []
}
```

---

## Lead

Lead module currently `src/App.jsx` me implemented hai. It uses local React state, static demo arrays, route-like `activeSidebarItem` switching, and reusable UI components.

### Route / Navigation Mapping

Lead related constants:

- `leadSubItems`: `Lead List`, `Create Lead`.
- `leadRelatedPages`: `Lead List`, `Create Lead`, `Lead Details`, `Follow-up History`, `Admin Approval`.
- `leadSubRoutes`: stores route-like strings for Lead List and Create Lead buttons.

Main `App` component `activeSidebarItem` ke basis par Lead pages render karta hai:

- `Lead List` -> `LeadListPage`
- `Create Lead` -> `CreateLeadPage`
- `Lead Details` -> `LeadDetailsPage`
- `Follow-up History` -> `FollowUpHistoryPage`
- `Admin Approval` -> `AdminApprovalPage`

### Data Sources

Lead data abhi static constants se aa raha hai:

- `leadListRows`: lead table/card rows.
- `leadCategoryTabs`: New, Hot, Warm, Cool, Lost category metadata.
- `leadCategoryToneClasses`: category UI tone classes.
- `getLeadRowsForCategory(category)`: selected category ke basis par rows filter karta hai.

Future backend integration me in constants ko API-driven data se replace karna hoga.

### Lead List Implementation

Component: `LeadListPage`

Local state:

- `followUpDate`: follow-up date filter value.
- `activeLeadCategory`: selected category tab.

Refs:

- `followUpDateInputRef`: hidden date input picker trigger ke liye.
- `leadTableSectionRef`: category select hone par table section tak smooth scroll ke liye.

Key behavior:

- Category click -> `setActiveLeadCategory(category)` + notification.
- Follow-up date picker uses native `showPicker()` where available.
- Reset Filters -> date aur category clear.
- View action -> `onOpenLead`, which `App` me `Lead Details` open karta hai.
- More action -> toast only.

Responsive behavior:

- Mobile: `LeadListMobileCard`.
- Desktop: `.crm-table` table with horizontal overflow.

### Create Lead Implementation

Component: `CreateLeadPage`

Local state:

- `duplicateModalOpen`: save ke baad duplicate IVRS modal show/hide.

Form behavior:

- Form id: `create-lead-form`.
- Save button submits form.
- `onSubmit` prevents default and opens `DuplicateIvrsModal`.
- Cancel calls `onCancel`, which Lead List open karta hai.
- Request Approval calls `onRequestApproval`, which Admin Approval page open karta hai.

Reusable form components:

- `LeadFormSection`
- `LeadInput`
- `LeadPhoneInput`
- `LeadSelect`
- `LeadDateInput`
- `LeadTextarea`
- `LeadLabel`
- `CreateLeadNotice`

Current limitation:

- Inputs are mostly uncontrolled.
- Save does not persist data.
- Duplicate IVRS detection is mocked by always opening modal.

### Duplicate IVRS Modal

Component: `DuplicateIvrsModal`

Purpose:

- Duplicate IVRS warning.
- Existing lead table preview.
- IVRS protection business rule.
- Approval request flow.

Actions:

- Cancel -> close modal.
- Request Approval -> closes modal and opens Admin Approval route.

Future API needs:

- Validate IVRS uniqueness.
- Fetch linked/existing leads by IVRS.
- Create approval request.

### Lead Details Implementation

Component: `LeadDetailsPage`

Local state:

- `followUpModalOpen`: Add Follow-up modal show/hide.

Quick action config:

- `quickDetailActions`: Add Follow-up, Create Quotation, Assign Lead, Change Status, Add Note.

Reusable display components:

- `PageHeading`
- `InfoPanel`
- `DetailRow`
- `TimelineItem`
- `MiniActionButton`
- `StatusBadge`
- `AssigneeCell`
- `AddFollowUpModal`

Current data is hardcoded for Amit Sharma / IVRS123456. Backend integration should pass selected lead id and fetch lead details dynamically.

### Follow-up History Implementation

Component: `FollowUpHistoryPage`

Local state:

- `followUpModalOpen`: Add/Edit Follow-up modal state.

Local data:

- `timeline`: array of follow-up history entries.

UI sections:

- Lead summary header.
- Timeline list using `HistoryItem`.
- Follow-up Summary.
- Next Follow-up Details.
- Quick Actions.

Current limitation:

- Timeline is static.
- Load More only shows toast.
- Add/Edit follow-up uses modal but no persistence.

### Add Follow-up Modal

Component: `AddFollowUpModal`

Uses:

- `ReadonlyField`
- `LeadSelect`
- `LeadDateInput`
- `LeadInput`
- `LeadTextarea`

Actions:

- Cancel closes modal.
- Save closes modal and triggers `Follow-up saved` notification.

Future API needs:

- Create follow-up entry.
- Update next follow-up date/time.
- Assign reminder.
- Optional attachment upload.

### Admin Approval Implementation

Component: `AdminApprovalPage`

Local data:

- `rows`: demo IVRS request IDs.

UI sections:

- Approval stats via `ApprovalStat`.
- Tabs: Pending, Approved, Rejected, All.
- Search field and Filters button.
- Approval request table.
- Approve/Reject inline buttons.
- Request detail side panel.
- IVRS Intelligence side panel.
- Quick Actions.

Current limitation:

- Approve/Reject only show toast.
- Search/filter tabs do not change data.
- Request details are static.

Future API needs:

- Fetch approval requests.
- Filter/search requests.
- Approve/reject request with audit log.
- Link approval request to lead creation.

### Integration Notes

Recommended APIs:

```json
{
  "GET /leads": "Lead list with filters and pagination",
  "POST /leads": "Create lead",
  "GET /leads/:id": "Lead details",
  "PUT /leads/:id": "Update lead",
  "GET /leads/:id/follow-ups": "Follow-up history",
  "POST /leads/:id/follow-ups": "Create follow-up",
  "GET /ivrs/:number/validate": "IVRS duplicate check",
  "POST /ivrs-approval-requests": "Request admin approval",
  "GET /ivrs-approval-requests": "Approval list",
  "POST /ivrs-approval-requests/:id/approve": "Approve request",
  "POST /ivrs-approval-requests/:id/reject": "Reject request"
}
```

---

## Accounts

TODO

---

## Inventory

TODO

---

## Settings

TODO
