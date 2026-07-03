# Malwa Solar CRM - Bug Tracking

Is file me project ke sabhi bugs, unki priority, status, aur details track ki jaayengi.

**Priorities:**
- **P0 (Critical):** Data loss, security issue, ya poora page break kar de. Turant fix karna zaroori hai.
- **P1 (High):** Major feature kaam na kare, galat data dikhe, ya user experience bahut kharab ho.
- **P2 (Medium):** Minor UI issue, performance problem, ya edge case me aane wala bug.

---

## Bug Summary

| Priority | Total | Fixed | Tracked |
|:---|:---:|:---:|:---:|
| **P0 - Critical** | 6 | 6 | 0 |
| **P1 - High** | 9 | 9 | 0 |
| **P2 - Medium** | 5 | 5 | 0 |

---

## P0 - Critical Bugs

### BUG-01: Local development me API URL galat hai
- **Description:** `.env.local` file na hone par local development me API calls fail ho sakti hain.
- **Impact:** Developer local machine par app run nahi kar pata.
- **Affected Files:** `src/api.js`, `.env.local`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** Dev mode me default `/api/v1` (Vite proxy) use hota hai. `.env.local` template add kiya gaya with optional `VITE_API_URL`.

### BUG-02: JWT Refresh Token update nahi ho raha tha
- **Description:** Refresh API se naya refresh token discard ho jaata tha.
- **Impact:** Session bahut jaldi expire ho jaata tha.
- **Affected Files:** `src/api.js`
- **Status:** **Fixed**
- **Priority:** P0

### BUG-03: Bina login ke Dashboard access ho raha tha
- **Description:** Token validation ke bina dashboard render ho raha tha.
- **Impact:** Unauthorized access.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P0

### BUG-04: Lead Details page par data fetch nahi ho raha tha
- **Description:** Lead details hardcoded data dikha raha tha.
- **Impact:** User actual lead details nahi dekh paa raha tha.
- **Affected Files:** `src/App.jsx` (`LeadDetailsPage`)
- **Status:** **Fixed**
- **Priority:** P0

---

## P1 - High-Priority Bugs

### BUG-05: Project list ka default date filter saare projects hide kar raha tha
- **Description:** Default date filter galat set tha.
- **Impact:** Koi project nahi dikhta tha.
- **Affected Files:** `src/App.jsx` (`ProjectListPage`)
- **Status:** **Fixed**
- **Priority:** P1

### BUG-06: Dashboard par API se 0 record aane par bhi demo data dikh raha tha
- **Description:** Empty API response par hardcoded demo data dikhta tha.
- **Impact:** Galat information.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P1

### BUG-07: Lead list me API error chup-chaap ignore ho rahe the
- **Description:** API fail hone par user ko error nahi dikhta tha.
- **Impact:** User ko problem ka pata nahi chalta tha.
- **Affected Files:** `src/App.jsx` (`LeadListPage`)
- **Status:** **Fixed**
- **Priority:** P1

### BUG-08: Quotation page ka route define nahi hai
- **Description:** Browser refresh par `/quotation` route resolve nahi hota tha.
- **Impact:** Tooti hui navigation.
- **Affected Files:** `src/App.jsx` (`sectionRoutes`)
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** `Quotation: '/quotation'` added to `sectionRoutes`.

### BUG-09: Login form par label galat hai
- **Description:** "Email / Mobile" likha tha lekin backend sirf email support karta hai.
- **Impact:** User confusion aur login failure.
- **Affected Files:** `src/App.jsx` (`SignInPage`)
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** Label changed to "Email Address".

### BUG-10: Lead list me Follow-up date filter kaam nahi kar raha
- **Description:** Date picker `YYYY-MM-DD` format me tha, table `DD Mon YYYY` — filter match nahi hota tha.
- **Impact:** Date filter bekaar tha.
- **Affected Files:** `src/App.jsx` (`LeadListPage`)
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** Filter ab `nextFollowUpRaw` ISO date se compare karta hai.

---

## P2 - Medium-Priority Bugs

### BUG-11: Project list par loading spinner nahi hai
- **Description:** Data fetch tak blank screen.
- **Impact:** Kharab user experience.
- **Affected Files:** `src/App.jsx` (`ProjectListPage`)
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** `PageLoadingState` already present during fetch.

### BUG-12: Lead list search har keystroke par API call bhej raha hai
- **Description:** Har character par API call trigger hoti thi.
- **Impact:** Performance issue.
- **Affected Files:** `src/App.jsx` (`LeadListPage`)
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** 300ms debounce on search input.

### BUG-13: API calls me timeout nahi hai
- **Description:** `fetch` calls me timeout mechanism nahi tha.
- **Impact:** Unresponsive UI on slow backend.
- **Affected Files:** `src/api.js`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** 20 second `AbortController` timeout with user-friendly error.

### BUG-14: User profile fetch fail hone par error nahi dikhta
- **Description:** `authApi.me()` fail hone par catch block khaali tha.
- **Impact:** User ko session issue ka pata nahi chalta.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Error toast on profile fetch failure.

---

## New Bugs Fixed (2026-07-03)

### BUG-15: Project Management page blank aa raha tha
- **Description:** `formatProjectDisplayDate` aur `formatProjectDateRange` functions use ho rahe the but define nahi the. Page render hote hi crash hota tha.
- **Impact:** Poora Project Management module blank dikhta tha.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** Dono functions define kiye gaye `projectDaysLeft` ke paas.

### BUG-16: ProjectTimelinePage — delete confirm crash
- **Description:** `handleDeleteMilestone` mein `setDeleteConfirm` call ho raha tha lekin `deleteConfirm` state `ProjectTimelinePage` mein declare nahi thi. Delete click karne par `ReferenceError` aata tha.
- **Impact:** Timeline par task delete karna possible nahi tha — crash.
- **Affected Files:** `src/App.jsx` (`ProjectTimelinePage`)
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** `const [deleteConfirm, setDeleteConfirm] = useState(null)` add ki aur delete confirm dialog render kiya.

### BUG-17: ProjectWorkOrdersPage — poora hardcoded dummy data
- **Description:** Work Orders page mein project info, stats, orders list, overdue list, recent activity — sab hardcoded demo data tha. Koi bhi real API call nahi ho rahi thi.
- **Impact:** Galat data dikha raha tha, real work orders nahi dikhte the.
- **Affected Files:** `src/App.jsx` (`ProjectWorkOrdersPage`), `src/api.js`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** Poora component rewrite kiya — project picker (Installation jaise), `workOrderApi.list()` se real data load, real status counts, add/delete functionality. `workOrderApi.delete()` bhi add ki.

### BUG-18: ProjectWorkOrdersPage — selectedProject prop pass nahi ho rahi thi
- **Description:** Project list se work orders navigate karne par `selectedProject` `ProjectManagementPage` mein set hoti thi lekin `ProjectWorkOrdersPage` ko pass nahi hoti thi.
- **Impact:** Work orders page context-less open hota tha.
- **Affected Files:** `src/App.jsx` (`ProjectManagementPage`)
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** `ProjectManagementPage` mein `ProjectWorkOrdersPage` ko `selectedProject` aur `onSelectProject` props pass kiye.

### BUG-19: ProjectTimelinePage — hardcoded "In Progress" status badge
- **Description:** Project summary header mein status badge hardcoded "In Progress" dikha raha tha, chahe project ka actual status kuch bhi ho.
- **Impact:** Galat project status dikhta tha.
- **Affected Files:** `src/App.jsx` (`ProjectTimelinePage`)
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** `<span>In Progress</span>` ko `<ProjectPhaseBadge label={d.status} />` se replace kiya.

### BUG-20: ProjectWorkOrdersPage (WorkOrders) — workOrderApi mein delete method missing
- **Description:** `workOrderApi` mein sirf `list`, `create`, `update` the — `delete` method nahi tha.
- **Impact:** Work orders delete karna possible nahi tha.
- **Affected Files:** `src/api.js`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** `delete: (id) => request(...)` add ki.
