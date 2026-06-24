# Malwa Solar CRM — Bug Report

> Audit date: 24 Jun 2026  
> Frontend: `src/App.jsx`, `src/api.js`  
> Backend API: `http://127.0.0.1:8000/api/v1`  
> Login tested: `admin@malwasolar.com` / `Malwa@2024` ✅

---

## P0 — Critical (data loss / auth breakage / broken pages)

### BUG-01 · Wrong / unreachable API URL in `.env.local`
| | |
|---|---|
| **File** | `.env.local` line 1 |
| **Current value** | `VITE_API_URL=http://192.168.1.16:8000/api/v1` |
| **Problem** | IP `192.168.1.16` times out — all API calls hang or silently fail. Lead list, Project list, Quotation list show empty / stuck spinner. |
| **Fix** | Change to the correct server IP or `http://127.0.0.1:8000/api/v1` for local dev. Then restart `npm run dev`. |
| **Status** | ⚠️ Manual — `.env.local` must be updated per deployment environment |

---

### BUG-02 · JWT refresh token discarded after token rotation
| | |
|---|---|
| **File** | `src/api.js` line 44–46 |
| **Code** | `const { access } = await rRes.json(); tokenStore.set(access, null);` |
| **Problem** | Backend has `ROTATE_REFRESH_TOKENS = True`. When a mid-session 401 triggers a refresh, the **new** `refresh` token from the response is ignored (`null` passed). After the original refresh token expires, the next 401 causes immediate logout even though the user was active. |
| **Fix** | Destructure both `access` and `refresh` from the refresh response and store both. |
| **Status** | ✅ Fixed in code |

---

### BUG-03 · Dashboard restored without token validation
| | |
|---|---|
| **File** | `src/App.jsx` line 1793 |
| **Code** | `useState(initialPreferences.currentPage === 'dashboard' ? 'dashboard' : 'signin')` |
| **Problem** | `currentPage` is restored from `localStorage`. If the page was `'dashboard'` before, it opens dashboard directly even if `malwa_access` token is missing/expired. All API calls then fail silently with 401 → demo data shown to unauthenticated user. |
| **Fix** | Also check `tokenStore.getAccess()` before restoring dashboard; redirect to sign-in if no token present. |
| **Status** | ✅ Fixed in code |

---

### BUG-04 · Lead Details page does not fetch lead data from API on mount
| | |
|---|---|
| **File** | `src/App.jsx` line 30150–30173 |
| **Problem** | When navigating to Lead Details directly, `selectedLead` is only `{ id }`. `LeadDetailsPage` reads `lead.customer`, `lead.mobile`, `lead.ivrs`, etc. — but **never calls `leadApi.get(id)`**. All info fields show `—`. Follow-up linked-lead query bails early because `!lead?.mobile`. |
| **Fix** | Add a `useEffect` that calls `leadApi.get(lead.id)` when customer/mobile/ivrs are missing, then patches state via `onLeadUpdated`. |
| **Status** | ✅ Fixed in code |

---

## P1 — High (missing data, incorrect UI, navigation broken)

### BUG-05 · Project list default date filter hides all projects
| | |
|---|---|
| **File** | `src/App.jsx` line 16840–16841 |
| **Code** | `useState('2026-01-01')` / `useState('2026-12-31')` |
| **Problem** | Frontend filters projects by `start_date` client-side. All API projects have empty `start_date`. Projects outside Jan–Dec 2026 (or with blank `start_date` that doesn't satisfy the range) are hidden → **"No projects found"** on empty-start-date rows. |
| **Fix** | Default `dateFrom` and `dateTo` to `''` (no restriction). |
| **Status** | ✅ Fixed in code |

---

### BUG-06 · Dashboard shows hardcoded demo data when API returns empty
| | |
|---|---|
| **File** | `src/App.jsx` line 1897–1952 |
| **Problem** | `dashboardFollowUps` initialises to seed data. The API success handlers have early returns (`if (!rows.length) return`) — so when real data is 0 rows, seed data stays on screen. Dashboard "Today Follow-ups", "Recent Leads", "Overdue" sections show fake names and dates. |
| **Fix** | Always update state on API success, even if rows is empty (`setDashboardFollowUps([])`). |
| **Status** | ✅ Fixed in code |

---

### BUG-07 · Lead list API errors silently swallowed
| | |
|---|---|
| **File** | `src/App.jsx` line 3643 |
| **Code** | `.catch(() => {})` |
| **Problem** | Any network error or 500 on `/leads/` shows "No leads found" with no feedback. User doesn't know if it's empty data or a real error. |
| **Fix** | Show an error toast on catch. |
| **Status** | ✅ Fixed in code |

---

### BUG-08 · Quotation page missing from URL routes
| | |
|---|---|
| **File** | `src/App.jsx` `sectionRoutes` object (~line 387) |
| **Problem** | `'Quotation'` has no entry in `sectionRoutes`. `buildPathForSection('Quotation')` returns `'/'`. Browser URL stays `/` or `/dashboard` — refreshing while on Quotation page loses the view. |
| **Fix** | Add `'Quotation': '/quotations'` to `sectionRoutes`. |
| **Status** | ⚠️ Tracked — not yet fixed |

---

### BUG-09 · Login label says "Email / Mobile" but API only accepts email
| | |
|---|---|
| **File** | `src/App.jsx` Sign-in form; `src/api.js` line 77–78 |
| **Problem** | UI text says "Email / Mobile Number". Backend `USERNAME_FIELD = 'email'`. Mobile-only input always fails with auth error. |
| **Fix** | Change label to "Email Address" only. |
| **Status** | ⚠️ Tracked — not yet fixed |

---

### BUG-10 · Follow-up date filter locale mismatch
| | |
|---|---|
| **File** | `src/App.jsx` line 3640, 3714 |
| **Problem** | Lead's `nextFollowUp` is formatted with `en-IN` locale (`24 Jun 2026`). Filter comparison uses `formatReportDate()` which outputs a different format. The filter never matches → zero rows returned. |
| **Fix** | Compare raw ISO date strings instead of locale-formatted strings. |
| **Status** | ⚠️ Tracked — not yet fixed |

---

## P2 — Medium (UX / edge cases)

### BUG-11 · Project list missing loading spinner
| **File** | `src/App.jsx` ~line 16846 |
| **Problem** | `loading` state is set but never rendered → empty state "No projects found" flashes before data loads. |
| **Status** | ⚠️ Tracked |

### BUG-12 · Lead list search triggers API on every keystroke (no debounce)
| **File** | `src/App.jsx` ~line 3621 |
| **Problem** | `useEffect` dep `searchQuery` fires `leadApi.list()` on each character. Slow on poor network. |
| **Status** | ⚠️ Tracked |

### BUG-13 · No fetch timeout in `api.js`
| **File** | `src/api.js` |
| **Problem** | Hung backend keeps `loading = true` forever. No `AbortController` or timeout. |
| **Status** | ⚠️ Tracked |

### BUG-14 · `authApi.me()` failure silently ignored
| **File** | `src/App.jsx` ~line 1877–1878 |
| **Problem** | `.catch(() => {})` — profile/header never shows auth error. |
| **Status** | ⚠️ Tracked |

---

## Summary

| Priority | Count | Fixed here |
|----------|-------|------------|
| P0 Critical | 4 | 3 ✅ + 1 manual (env URL) |
| P1 High | 6 | 3 ✅ + 3 tracked |
| P2 Medium | 4 | 0 (tracked) |

---

*Report generated by code audit + live API test on 24 Jun 2026.*
