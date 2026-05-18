# Malwa Solar CRM - User Side Working

Is file me project ki user-facing working module-wise document hogi. Har module me screen par user ko kya dikhta hai, user kya action kar sakta hai, aur expected workflow kya hai, ye likhna hai.

Future rule: jab Lead module document karna ho, to Lead ki user-side working isi file ke `Lead` section me add karni hai.

---

## Dashboard

Dashboard login ke baad default landing screen hai. User yahan CRM ka quick business overview dekh sakta hai.

### Main KPI Cards

Dashboard ke top par 5 summary cards dikhte hain:

- Total Leads: total lead count aur last month comparison.
- Today Follow-ups: aaj ke scheduled follow-ups ka count.
- Pending Quotations: pending quotation count.
- Won Projects: won projects ka count.
- Revenue Overview: revenue summary.

In cards ka purpose user ko high-level performance snapshot dena hai.

### Today Follow-ups

User aaj ke follow-ups dekh sakta hai. Table/card me ye details hoti hain:

- Customer Name
- Mobile Number
- IVRS Number
- Project Name
- Assigned To
- Follow-up Date
- Action/View button

Desktop par ye table view me dikhta hai. Mobile par same information card layout me dikhti hai. View action click karne par toast message aata hai ki selected follow-up opened.

### Quick Actions

Dashboard side panel me quick action buttons hain:

- Add Lead
- Add Follow-up
- Create Quotation (UI)

Abhi ye buttons actual form navigation ke bajay toast action show karte hain, jaise `Add Lead action started`.

### Recent Leads

Recent Leads section me recently added leads dikhte hain:

- Customer Name
- Mobile Number
- Project Name
- Status
- Assigned To
- Created On

Status badge ke through lead state visible hoti hai, jaise New, Follow-up, Quotation, Lost.

### Overdue Follow-ups

Dashboard right side me overdue follow-ups list dikhati hai:

- Customer Name
- Project Name
- Delay, jaise `2 Days Overdue`, `1 Day Overdue`, `Today Overdue`

Iska purpose user ko delayed follow-ups par quick attention dena hai.

### Footer

Dashboard footer me copyright text aur sustainability branding message dikhaya gaya hai.

---

## Lead

Lead module me user leads ko view, filter, create, inspect, follow-up, aur admin approval flow me manage kar sakta hai.

### Lead List

Lead List screen par user ko lead records table/card format me dikhte hain. Desktop par table view hota hai aur mobile par card view.

Lead list me ye information dikhayi jati hai:

- Customer Name
- Mobile Number
- IVRS Number
- Project Name
- Project Type
- Status
- Assigned To
- Next Follow-up
- Action

Top actions:

- Export: lead export start karne ke liye.
- Create Lead: new lead form open karne ke liye.

### Lead Categories

Lead List me quality/status buckets ke quick tabs dikhte hain:

- New leads
- Hot leads
- Warm leads
- Cool leads
- Lost leads

User kisi category par click karke us category ki filtered lead list dekh sakta hai. Category view me priority, demo lead count, aur next action bhi visible hota hai. Clear View se category filter remove hota hai.

### Lead Filters

Lead List par filters available hain:

- Search by name, mobile, IVRS
- Project Type
- Status
- Assigned To
- Follow-up Date
- Reset Filters

Abhi filters ka UI ready hai. Reset Filters selected follow-up date aur category view clear karta hai.

### Create Lead

Create Lead page par user new lead entry kar sakta hai. Form sections:

- Basic Information: Customer Name, Mobile Number, IVRS Number, Alternate Number, Email Address.
- Project Information: Project Name, Project Type, Requirement Details, Source, Estimated Capacity.
- Assignment & Follow-up: Assigned Employee, Follow-up Date, Lead Status, Priority, Remarks.
- Location Information: Address, Latitude, Longitude.

Important note: Mobile Number aur IVRS Number mandatory hain. IVRS Number unique hona chahiye.

Save Lead click karne par abhi duplicate IVRS modal open hota hai.

### Duplicate IVRS Flow

Agar same IVRS detect hota hai to modal me warning show hoti hai:

- Entered IVRS Number
- Existing lead(s) with same IVRS
- System rule: same IVRS means same customer
- Different project with same IVRS requires admin approval

User ke options:

- Request Admin Approval
- Cancel and use different IVRS Number

Request Approval click karne par Admin Approval page open hota hai.

### Lead Details

Lead Details page par selected lead ki complete information dikhti hai.

Header actions:

- Edit Lead
- Add Follow-up
- More actions

Lead Details me ye panels hain:

- IVRS summary: IVRS Number, duplicate check, lead status.
- Basic Information: customer details, contact, IVRS, email, address, source, assigned user, created date.
- Project Information: project name/type, requirement, estimated capacity, follow-up date, status, priority.
- Follow-up History preview.
- IVRS Intelligence.
- Linked Leads with same mobile number.
- Quick Actions.

Quick Actions:

- Add Follow-up
- Create Quotation (UI)
- Assign Lead
- Change Status
- Add Note

### Add Follow-up

Lead Details aur Follow-up History se Add Follow-up modal open hota hai.

Modal fields:

- Lead Name
- Mobile Number
- IVRS Number
- Project Name
- Follow-up Type
- Follow-up Date
- Follow-up Time
- Talked To
- Follow-up Notes
- Next Follow-up Date
- Next Follow-up Time
- Reminder
- Assigned To
- Priority
- Attachment
- Add to today follow-ups checkbox

Save Follow-up click karne par success toast show hota hai.

### Follow-up History

Follow-up History page par selected lead ka timeline dikhaya jata hai.

Screen par visible information:

- Lead summary: name, status, mobile, IVRS, project, assigned user.
- Next Follow-up date/time.
- Timeline entries: completed follow-up, scheduled follow-up, site visit, note, missed call.
- Follow-up Summary: total, completed, scheduled, notes, missed.
- Next Follow-up Details.

Quick actions:

- Add Follow-up
- Schedule Site Visit
- Add Note
- Change Lead Status

### Admin Approval

Admin Approval page duplicate IVRS requests ko approve/reject karne ke liye hai.

Screen sections:

- Approval stats: Pending Approvals, Approved Today, Rejected Today, Total Requests.
- Approval tabs: Pending, Approved, Rejected, All.
- Search by IVRS, name, mobile.
- Approval request table.
- Approve / Reject actions.
- IVRS Request Details side panel.
- IVRS Intelligence panel.
- Quick Actions: View Lead Details, View IVRS Intelligence, Refresh List.

---

## Accounts

TODO

---

## Inventory

TODO

---

## Settings

TODO
