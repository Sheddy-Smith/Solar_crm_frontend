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
| **P0 - Critical** | 14 | 14 | 0 |
| **P1 - High** | 15 | 15 | 0 |
| **P2 - Medium** | 13 | 13 | 0 |
| **P3 - Low** | 2 | 2 | 0 |

_Last updated: 2026-07-06 (LC Module Deep Sweep — BUG-41 se BUG-44)_

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

---

## Deep Audit — 2026-07-03 (BUG-21 se BUG-36)

Poore project ke deep scan me mile bugs. Sabhi isi din fix kiye gaye. Regression tests: `backend/apps/accounts/tests.py`.

### BUG-21: Backend `page_size` param ignore karta tha — lists 100 par cap
- **Description:** Frontend ~15 jagah `page_size=200/500/1000` bhejta tha, lekin DRF me `page_size_query_param` configure nahi tha — param silently ignore hota tha aur har list 100 records par cut jaati.
- **Impact:** Data 100 se upar jaate hi dropdowns/lists me records gayab (bina error ke).
- **Affected Files:** `backend/malwa_solar/pagination.py` (new), `backend/malwa_solar/settings/base.py`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** Custom `DefaultPagination` class — `page_size_query_param='page_size'`, `max_page_size=1000`.

### BUG-22: Settings endpoints non–Super-Admin ke liye 500 crash
- **Description:** `HasModulePermission` `view.action` access karta tha jo plain `APIView`s (Company Profile, Category Settings, Dashboard, Maintenance, Backups) par exist nahi karta — `AttributeError` → 500.
- **Impact:** Settings permission wale kisi bhi non-superadmin role ke liye poora Settings module crash.
- **Affected Files:** `backend/apps/accounts/permissions.py`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** `getattr(view, 'action', None)` + APIViews ke liye HTTP-method se flag map (`permission_method_map` override support ke saath).

### BUG-23: View-only user Site Survey / System Config EDIT kar sakta tha
- **Description:** `system_config` aur `site_survey` actions GET+PUT dono lete hain lekin permission map dono ko `can_view` se gate karta tha.
- **Impact:** RBAC bypass — sirf view permission wala user data overwrite kar sakta tha.
- **Affected Files:** `backend/apps/accounts/permissions.py`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** Unsafe HTTP methods (PUT/POST/PATCH/DELETE) par `can_view` flag automatically `can_edit` me upgrade hota hai.

### BUG-24: Backups fake the — koi backup banta hi nahi tha
- **Description:** `create_backup_log` sirf demo row banata tha (hardcoded "12.4 MB", status Completed) — koi file create nahi hoti thi. `health_check` bhi hamesha OK bolta tha.
- **Impact:** Data-safety ka jhootha bharosa — real backup kabhi nahi bana.
- **Affected Files:** `backend/apps/crm_settings/services.py`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** Real `dumpdata` export gzip JSON me `media/backups/` ke andar, real file size, failure par status `Failed`. Health check ab DB/cache/media storage sach me test karta hai.

### BUG-25: Production me media files (uploads) serve nahi hoti thi
- **Description:** Media serving sirf `DEBUG=True` me thi; whitenoise sirf static serve karta hai. Prod me saare uploads 404.
- **Impact:** Project images, expense/subsidy/approval documents production me nahi khulte the.
- **Affected Files:** `backend/malwa_solar/urls.py`
- **Status:** **Fixed** (Note: host filesystem ephemeral hai — redeploy par files delete hoti hain; permanent fix ke liye S3/Cloudinary chahiye)
- **Priority:** P0
- **Fix:** Prod me media route add kiya (`django.views.static.serve`).

### BUG-26: Failed login attempts kabhi log nahi hote the + no throttling
- **Description:** Galat password par simplejwt exception raise karta hai, response return nahi — isliye "Login Failed" logging branch kabhi execute nahi hui. Login par koi rate limit bhi nahi tha.
- **Impact:** Audit trail me failed attempts ka zero record; unlimited brute-force possible.
- **Affected Files:** `backend/apps/accounts/views.py`, `backend/malwa_solar/settings/base.py`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** try/except me logging + attempted email record; `ScopedRateThrottle` 10/min login par.

### BUG-27: Expense summary ka math galat
- **Description:** `other = total - material - labour` — transport/equipment/misc double-count hote the. `total_budget` project filter ignore karke saare projects ka budget dikhata tha. Summary par project/category/status filters bhi apply nahi hote the.
- **Impact:** Galat financial totals.
- **Affected Files:** `backend/apps/projects/views.py`
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** Sab categories subtract; budget project-filtered; `filter_queryset()` apply kiya.

### BUG-28: Lead assign par invalid user id se 500
- **Description:** `assign` action bina validation ke `assigned_to_id` set karta tha.
- **Impact:** Invalid/inactive user id par IntegrityError 500.
- **Affected Files:** `backend/apps/leads/views.py`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Active user existence check, warna 400.

### BUG-29: Party sirf name se match hoti thi
- **Description:** `get_or_create_party_for_project` sirf `name` par match karta tha — same naam ke do customers ka ek hi ledger ban jaata.
- **Impact:** Alag customers ke payments ek hi account me mix.
- **Affected Files:** `backend/apps/accounts_module/services.py`
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** Pehle lead ke phone se match, phir name (conflicting phone wale exclude), warna new party with phone/email/city.

### BUG-30: Payment mode change par stale Cheque record reh jaata tha
- **Description:** Payment Cheque se doosre mode me change ho (ya status Completed se hate) to purana Cheque row delete nahi hota tha.
- **Impact:** Cheque register me ghost entries.
- **Affected Files:** `backend/apps/accounts_module/services.py`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Early-return path me stale cheque delete.

### BUG-31: StockMovement edit me item change par galat stock
- **Description:** Movement ka item badalne par purana delta naye item par revert hota tha, purane item ka stock galat reh jaata.
- **Impact:** Inventory stock mismatch.
- **Affected Files:** `backend/apps/inventory/models.py`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Old item ko alag se lock karke revert, negative-stock guard ke saath.

### BUG-32: api.js — failed token refresh par silent `null` return
- **Description:** Refresh fail hone par `request()` `null` return karta tha — callers ise "no data" samajhte the.
- **Impact:** Session expire hone par blank screens, koi error message nahi.
- **Affected Files:** `src/api.js`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Ab `Session expired` error throw hota hai (logout event pehle se dispatch hota tha).

### BUG-33: Prod build me `VITE_API_URL` missing hone par silently localhost
- **Description:** Env var build time par na ho to prod bundle `http://localhost:8000` hit karta tha.
- **Impact:** Misconfigured deploy chupke se fail hota.
- **Affected Files:** `src/api.js`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Fallback `/api/v1` + prod me missing env var par loud `console.error`.

### BUG-34: Header me fake notifications / WhatsApp messages
- **Description:** Hardcoded demo entries ("Amit Sharma", "64 quotations need review") real data jaise dikhte the.
- **Impact:** Users ko misleading information.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Arrays empty kiye + proper empty states ("No new notifications" / "No unread messages").

### BUG-35: UI me Hinglish strings (English-only policy violation)
- **Description:** ~40 user-visible strings Hinglish me the — module subnav helperText, LC/Project subcategory notes, settings placeholders.
- **Impact:** Inconsistent UI language.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Saare UI strings English me translate kiye (code comments Hinglish me hi hain — wo dev-facing hain).

### BUG-36: Repo hygiene — junk file git me + unused heavy dependencies
- **Description:** `et --hard 398e221` (mistyped git command ka output) git me tracked thi. `requirements.txt` me pandas/numpy/matplotlib/seaborn/openpyxl the jo kahin use nahi hote (sirf ek dead pandas import tha).
- **Impact:** Repo clutter; Render deploys slow.
- **Affected Files:** root, `backend/requirements.txt`, `backend/apps/leads/views.py`
- **Status:** **Fixed**
- **Priority:** P3
- **Fix:** Junk file git rm; unused deps + dead import removed.

---

## PM Live Sweep — 2026-07-03 shaam (BUG-37 se BUG-40)

User ne Site Survey view popup par "formatCurrencyPrecise is not defined" crash report kiya. ESLint (`no-undef` + React rules) se pura App.jsx scan kiya aur headless Chrome (CDP) me saare 36 Project Management routes + popups/tabs/menus live drive karke verify kiya. ESLint config ab repo me hai (`eslint.config.mjs`) — `npx eslint src/App.jsx` se aise crashes build se pehle pakde ja sakte hain.

### BUG-37: `formatCurrencyPrecise` kahin defined hi nahi tha — PM pages crash
- **Description:** 25+ jagah use hota tha (project financial stats, expense tables, quotation totals) lekin function kahin defined nahi tha. Jo bhi page/popup ise render karta — Project List financials, Site Survey View popup, Project Details Financials tab, Quotation form — turant "Something went wrong / formatCurrencyPrecise is not defined" error boundary par gir jaata.
- **Impact:** Project Management ke kai pages + Site Survey view/edit popups totally broken.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** Module-level `formatCurrencyPrecise()` define kiya (₹ + en-IN formatting, max 2 decimals). CDP sweep me sab 36 PM routes ab clean load hote hain.

### BUG-38: PaymentSettingsPage me Save handler aur settings-load effect missing
- **Description:** Duplicate `PaymentSettingsPage` component me `savePaymentSettings` defined nahi tha (purane sibling component me tha) — "Save Changes" click par ReferenceError crash. Saved settings load karne wala useEffect bhi missing tha, isliye page hamesha defaults dikhata tha.
- **Impact:** Payment Settings save par page crash; saved values kabhi load nahi hote the.
- **Affected Files:** `src/App.jsx` (`PaymentSettingsPage`)
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** `settingsApi.payment.get()` load effect + `savePaymentSettings` handler add kiye.

### BUG-39: `onOpenSection` prop missing — Dashboard breadcrumb click par crash
- **Description:** `UserDetailsPage` aur `ActivityLogsPage` breadcrumb me `onOpenSection('Dashboard')` call karte the lekin prop destructure/pass nahi hota tha.
- **Impact:** In pages par Dashboard breadcrumb click karte hi ReferenceError crash.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** Dono components me prop add kiya; `UserManagementPage` se `UserDetailsPage` ko pass-through kiya (ActivityLogsPage ka call site pehle se pass kar raha tha).

### BUG-40: Lead Details — renamed state ka leftover call (`setConfirmingQuotationDelete`)
- **Description:** State ka naam `deleteConfirm` ho chuka tha lekin lead-change useEffect me purana `setConfirmingQuotationDelete(false)` call reh gaya tha — Lead Details kholte hi ReferenceError.
- **Impact:** Lead Details page mount par hi crash.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P0
- **Fix:** Call ko `setDeleteConfirm(null)` kiya.

**Verification (2026-07-03):** Headless Chrome CDP sweep — 36/36 PM routes bina exception/console-error/error-boundary ke load hue; View popup (eye), Edit popup (pencil), 3-dot menu, saare Project Details tabs (Overview se Notes tak), aur har PM page ke Add/Upload/Create modals open-close clean. `npm run build` pass, ESLint `no-undef` = 0.

**Note (tracked, not fixed):** ESLint ne 43 `react/jsx-key` warnings bhi diye (static arrays me JSX without key) — ye crash nahi karte, sirf list-reorder par subtle UI issues de sakte hain. Alag cleanup pass me theek karne layak.

---

## LC Module Deep Sweep — 2026-07-06 (BUG-41 se BUG-44)

Liaisoning & Commissioning module ka full audit: backend (models/serializers/views) review + headless Chrome (CDP) me har page ka har button/modal/filter live drive + Applications par real create→edit→delete E2E. Is sweep me ek **global routing bug** bhi pakda gaya jo saare modules ko affect karta tha.

### BUG-41: Direct URL / refresh par module pages Dashboard par gir jaate the (global routing bug)
- **Description:** `sectionRoutes` me top-level module aliases (jaise `'Liaisoning & Commissioning': '/liaisoning/applications'`, `'Accounts': '/accounts/overview'`, `'AMC & Warranty': '/amc/overview'`) sub-route maps se PEHLE listed the. `resolveSectionFromPath` pehla match return karta hai, to direct URL kholne ya refresh par section top-level label resolve hota tha — jiske liye renderer me koi branch nahi hai (e.g. `liaisonRelatedPages` me 'Liaisoning & Commissioning' label shamil hi nahi) — aur app chupchaap Dashboard render kar deta tha.
- **Impact:** `/liaisoning/applications` jaise URL ko directly kholne/refresh par LC (aur Accounts/AMC/Inventory/O&M/Summary) pages ki jagah Dashboard dikhta tha. Bookmark/shared links tootey hue the.
- **Affected Files:** `src/App.jsx` (`sectionRoutes`)
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** Sub-route spreads ko aliases se pehle rakha — ab shared path par specific sub-section jeet-ta hai. CDP se verify: `/liaisoning/applications` direct URL ab Applications list kholta hai; saare 36 PM routes ka regression bhi pass.

### BUG-42: LC ke 12 "action" routes fake placeholder pages the — dummy data + Save jo kuch save nahi karta
- **Description:** `LiaisonActionPage` (~280 lines) hardcoded demo data dikhata tha ("Ravi Industries Pvt. Ltd.", "LC-2024-0009") aur uska Save button sirf ek toast dikhata tha — koi API call nahi. Ye `/liaisoning/applications/create`, `/liaisoning/inspections/create`, `/liaisoning/documents/upload`, `/liaisoning/reports` samet 12 routes par render hota tha.
- **Impact:** In URLs par user ko real jaisa dikhne wala form milta tha jo data save hi nahi karta — misleading + data-loss illusion.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P1
- **Fix:** Ye routes ab usi entity ke REAL list page par resolve hote hain (jahan asli create/edit popups hain); dead `LiaisonActionPage` component delete kiya. CDP se verify: sab 5 legacy routes ab real pages dikhate hain, fake data kahin nahi.

### BUG-43: LC lists aur dropdowns 100 records par cap
- **Description:** `LiaisonCrudPage` ka `loadRows`, project/user/lookup dropdowns, aur Documents page — sab bina `page_size` ke API call karte the, to default 100 par cut jaate.
- **Impact:** 100+ records/projects hone par tables aur dropdowns me data gayab (silently).
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P2
- **Fix:** Lists par `page_size: 1000`, users par `page_size: 500`.

### BUG-44: Compliance "overdue" highlight aaj due items ko bhi overdue dikhata tha
- **Description:** `new Date(r.due_date) < new Date()` time-of-day compare karta tha — aaj due item din chadhte hi overdue red ho jaata.
- **Impact:** Galat overdue indication.
- **Affected Files:** `src/App.jsx`
- **Status:** **Fixed**
- **Priority:** P3
- **Fix:** Date-only ISO string compare.

**Verification (2026-07-06):** CDP sweep — LC ke saare 6 list pages + 5 legacy routes clean load; har page par New/View/Edit/Delete-confirm/Reject modals open-close, status filters, Clear — zero exceptions/console-errors/error-boundaries. Applications par full E2E: record create hua, list me dikha, edit save hua, delete se hata. PM regression: 36/36 routes pass. `npm run build` pass, ESLint me koi naya error nahi.
