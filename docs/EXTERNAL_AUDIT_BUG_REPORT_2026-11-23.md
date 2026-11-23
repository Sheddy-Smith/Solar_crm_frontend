# External Repo Audit — Bug Report (2026-11-23)

**Source:** Independent clone audit (lint / build / Django tests)  
**Verified against:** Local tree `C:\Malwa_Solar_CRM` (same day)  
**Status:** Fixes applied 2026-11-23 (except BUG-029 full App.jsx split + ARCH-001 microservices — deferred)  
**Also related:** Architecture debt → microservices (see `.cursor/rules/architecture-debt-microservices.mdc`)

---

## Verdict snapshot

| Check | Result |
|-------|--------|
| `npm run lint` | Clean (0 errors; audit noted 4 warnings) |
| `npm run build` | Pass (+ Android 8.1 syntax guard) |
| Django tests | **192 / 194** pass; **2 fail** (1 stale test, 1 SQLite locking limitation) |
| Real secrets in tree | None found (`.env` gitignored; dump guard script present) |

Overall: **repo healthy**, with test/CI/docs/security-debt items below.

---

## Confirmed bugs / debt

### BUG-085 — P1 — Stale inventory test (real CI failure)
| Field | Detail |
|-------|--------|
| **Status** | Open |
| **Type** | Test drift (not production logic bug) |
| **Files** | `backend/apps/inventory/tests.py` → `test_quick_adjust_updates_stock` |
| **Evidence** | View `quick_adjust` requires non-empty `notes` (`views.py`); test POSTs only `quantity` + `direction` → **400** |
| **Impact** | Suite fails / CI red |
| **Fix** | Add `notes: 'Cycle count'` (or any reason) to the test payload |

### BUG-086 — P2 — Concurrent BOM activate test fails on SQLite
| Field | Detail |
|-------|--------|
| **Status** | Open (environment limitation) |
| **Type** | Test / engine mismatch — **not** a confirmed production MySQL bug |
| **Files** | `backend/apps/projects/tests_bom_e2e.py` → `test_concurrent_activate_leaves_one_active` |
| **Evidence** | Uses threads + `select_for_update`; SQLite reports **table is locked**. Dev settings already document MySQL for this via `DJANGO_TEST_USE_MYSQL=1` |
| **Impact** | Local/CI SQLite suite noise |
| **Fix** | `@skipUnless` MySQL / mark as MySQL-only, or run that test under MySQL job |

### BUG-087 — P1 — CI may fail without `DATABASE_URL`
| Field | Detail |
|-------|--------|
| **Status** | Open (risk confirmed in code) |
| **Type** | CI / settings bootstrap |
| **Files** | `.github/workflows/ci.yml`; `backend/malwa_solar/settings/base.py` (`env.db('DATABASE_URL')`) |
| **Evidence** | CI sets only `SECRET_KEY`. `development.py` swaps to SQLite **after** importing `base`, so missing `DATABASE_URL` can raise `ImproperlyConfigured` before override |
| **Impact** | GitHub Actions can go red even when tests themselves are fine |
| **Fix** | Set dummy `DATABASE_URL=sqlite:///...` (or mysql CI service) in `ci.yml` **before** Django import; or make `DATABASE_URL` optional in base for test |

### BUG-029 — P2 — `App.jsx` monolith (already tracked)
| Field | Detail |
|-------|--------|
| **Status** | Partial / ongoing (BUGS.md) |
| **Evidence** | ~41k+ lines; main bundle ~2.4 MB (gzip ~519 KB) |
| **Impact** | Merge conflicts, slow IDE, onboarding cost |
| **Fix** | Continue module extraction (deferred refactor) |

### BUG-088 — P1 — JWT access token in `localStorage` (XSS theft surface)
| Field | Detail |
|-------|--------|
| **Status** | Open (security debt) |
| **Files** | `src/api.js` → `tokenStore`; JWT access lifetime **8 hours** (`SIMPLE_JWT`) |
| **Impact** | XSS can steal token; CSP in production reduces risk but does not eliminate it |
| **Fix** | Prefer httpOnly secure cookie session / BFF pattern; shorten access TTL + rotate refresh |

### BUG-089 — P1 — Field encryption key derived from `SECRET_KEY`
| Field | Detail |
|-------|--------|
| **Status** | Open (ops / crypto debt) |
| **Files** | `backend/malwa_solar/encryption.py` (Fernet from SHA256(`SECRET_KEY`)); used for Wi‑Fi / solar app passwords; Aadhaar helpers present |
| **Impact** | Rotating `SECRET_KEY` breaks decryption of existing ciphertext unless a separate `FIELD_ENCRYPTION_KEY` + re-encrypt path exists |
| **Fix** | Dedicated `FIELD_ENCRYPTION_KEY` env; document rotation / re-encrypt playbook |

### BUG-090 — P2 — README DB engine wrong
| Field | Detail |
|-------|--------|
| **Status** | Open |
| **Files** | `README.md` (“PostgreSQL (production)”) |
| **Evidence** | Live / local production path is **MySQL** (Hostinger / `DATABASE_URL` mysql) |
| **Fix** | Update README to MySQL (production) / SQLite (tests) / optional Postgres |

### BUG-091 — P2 — Hostinger SQL schema dump in public tree
| Field | Detail |
|-------|--------|
| **Status** | Open (hygiene) |
| **Files** | `deploy/u808821982_crm_tables.sql` |
| **Impact** | Exposes hosting username / DB naming; structure-only but unnecessary in public repo |
| **Fix** | Remove from git (or move to private ops vault); keep `check_no_secret_dumps.py` |

### BUG-092 — P2 — Dev/staging open hosts + CORS
| Field | Detail |
|-------|--------|
| **Status** | Accepted for local/staging only |
| **Files** | `settings/development.py`, `settings/staging_local.py` — `ALLOWED_HOSTS=['*']`, `CORS_ALLOW_ALL_ORIGINS=True` |
| **Impact** | Unsafe if these settings are ever used on a public host |
| **Fix** | Keep production hardened; document “never deploy with development settings” |

### ARCH-001 — Architecture debt — should be microservices
| Field | Detail |
|-------|--------|
| **Status** | Deferred (user-flagged; saved separately) |
| **As-is** | Modular Django monolith |
| **To-be** | Microservices |
| **Rule** | Do **not** migrate until explicitly requested |

---

## Not bugs (or already mitigated)

| Item | Notes |
|------|--------|
| Lint/build | Healthy |
| Production HTTPS / HSTS / secure cookies | OK in production settings |
| No committed API keys / `.env` | OK |
| SQLite concurrency fail | Engine limitation for locking tests, not MySQL prod proof of bug |

---

## Suggested fix order (when asked)

1. BUG-085 — add `notes` to test (minutes)  
2. BUG-087 — CI `DATABASE_URL` (minutes)  
3. BUG-086 — skipUnless MySQL  
4. BUG-090 / BUG-091 — docs + remove dump  
5. BUG-088 / BUG-089 — security design  
6. BUG-029 / ARCH-001 — large refactors only on explicit ask  
