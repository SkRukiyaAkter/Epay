# E-Payment System — Progress Log

> Update this file after each session with what was built, problems faced, and next steps.

---

## Session 6 — Project Cleanup & Documentation

### What Was Done

| Task | Details |
|---|---|
| **README.md created** | Comprehensive root-level README with setup instructions, architecture docs, API reference |
| **Missing bcrypt added** | Added `bcrypt==4.2.1` to `backend/requirements.txt` |
| **.env files generated** | Backend `.env` and frontend `.env.local` created with cryptographically random secrets |
| **Python venv setup** | Virtual environment created, all deps installed |
| **npm install** | All frontend dependencies installed |
| **Markdown files updated** | All docs reviewed and updated to reflect current codebase state |
| **SECURITY_AUDIT.md corrected** | All CRITICAL and HIGH items now show correct status |

### Credits
- Security audit & hardening (Session 5): All 5 critical + 6 high findings resolved

---

## Session 5 — Security Hardening + Landing Page + Notifications

### Security Fixes Applied (5 CRITICAL + 6 HIGH)

| # | Finding | Fix | Status |
|---|---|---|---|
| C1 | SHA-256 as password hash | Replaced with bcrypt (12 rounds, salted) | ✅ Done |
| C2 | Client-hash pass-the-hash | Removed client-side hashing; raw password over TLS, bcrypt on server | ✅ Done |
| C3 | No TLS on Nginx | Added TLS 1.3 with self-signed cert + HSTS + CSP headers | ✅ Done |
| C4 | Browser fingerprint spoofable | Now generated server-side from User-Agent + Accept-Language | ✅ Done |
| C5 | Weak session secret | Replaced with 32-byte cryptographically random hex via `os.urandom` | ✅ Done |
| H1 | Non-constant-time compare | bcrypt.checkpw() is constant-time by design | ✅ Done |
| H3 | Double-spend race condition | TimestampKey row now locked with `FOR UPDATE` | ✅ Done |
| H4 | Hardcoded nonce `"placeholder-nonce"` | Deleted unused `verify_payload()` function | ✅ Done |
| H5 | Weak config fallback defaults | Removed all defaults; crashes on missing env vars with clear error | ✅ Done |
| H6 | No CSRF token | Added CSRF cookie + `X-CSRF-Token` header validation on POST/PUT | ✅ Done |
| H2 | In-memory rate limiter | Migrated to Redis-backed rate limiter with sorted sets; fallback to in-memory | ✅ Done |
| L1 | 7-day session timeout | Reduced to 1 hour | ✅ Done |

### Features Added

| Feature | Details |
|---|---|
| **Notifications system** | Backend: `notifications` table + model, 3 API endpoints, auto-trigger on incoming transfers. Frontend: bell dropdown with unread badge, 30s polling, mark-read/mark-all. |
| **Landing page** | Dynamic landing at `/` with hero section, particle animations, "How It Works", security features, CTA. Red/black/white theme. |
| **Profile page** | `/dashboard/profile` — account status, device status, daily limits, security notice |
| **Reusable components** | StatCard, BalanceCard, TransactionRow, QuickActionCard, EmptyState, LoadingSkeleton, NotificationDropdown |
| **Device API BFF** | Frontend `GET /api/device/status` → Flask proxy |

### Theme Change
- Switched from blue/emerald to **red/black/white** across all pages
- Primary color: red shades (#ef4444 base)
- Dark backgrounds: black (#000) to dark gray (#1a1a1a)
- Cards: white with subtle borders
- Success/accent: emerald retained for received transactions (universal convention)

### Files Changed

| File | Change |
|---|---|
| `backend/app/services/auth_service.py` | bcrypt password hashing, constant-time compare |
| `backend/app/services/crypto_service.py` | Deleted dead `verify_payload()` with hardcoded nonce |
| `backend/app/services/transaction_service.py` | TimestampKey row locked with `FOR UPDATE` |
| `backend/config.py` | Removed fallback defaults, env validation, explicit .env path |
| `backend/app/__init__.py` | Config validate() call on startup, notification blueprint + model |
| `backend/app/routes/auth.py` | Server-side fingerprint from headers, bcrypt compatibility |
| `backend/app/routes/notification.py` | NEW: `/list`, `/unread-count`, `/read` endpoints |
| `backend/app/models/notification.py` | NEW: notifications table model |
| `backend/app/middeware/rate_limit.py` | Redis-backed rate limiter with sorted sets |
| `frontend/app/api/auth/login/route.ts` | Removed client-side SHA-256; sends raw password; sets CSRF cookie |
| `frontend/app/api/transaction/route.ts` | CSRF validation on POST |
| `frontend/app/page.tsx` | NEW: dynamic landing page (red/black/white) |
| `frontend/app/globals.css` | Red color palette replacing blue |
| `frontend/app/login/page.tsx` | Red theme update |
| `frontend/app/dashboard/page.tsx` | Component-based refactor with BalanceCard, StatCard, etc. |
| `frontend/app/dashboard/send/page.tsx` | Red theme, CSRF token in headers |
| `frontend/app/dashboard/history/page.tsx` | Component-based refactor |
| `frontend/app/dashboard/profile/page.tsx` | NEW: profile page |
| `frontend/components/DashboardShell.tsx` | NotificationDropdown integration, Profile nav item |
| `frontend/components/StatCard.tsx` | NEW |
| `frontend/components/BalanceCard.tsx` | NEW |
| `frontend/components/TransactionRow.tsx` | NEW |
| `frontend/components/QuickActionCard.tsx` | NEW |
| `frontend/components/EmptyState.tsx` | NEW |
| `frontend/components/LoadingSkeleton.tsx` | NEW |
| `frontend/components/NotificationDropdown.tsx` | NEW |
| `frontend/types/index.ts` | AppNotification, NotificationListResponse types |
| `frontend/lib/session.ts` | CSRF get/set/validate helpers, 1hr session |
| `frontend/middeware.ts` | Removed `/` redirect to allow landing page |
| `frontend/.env.local` | Strong session secret generated |
| `nginx/nginx.conf` | TLS 1.3 + HSTS + CSP + Permissions-Policy + cert mount |
| `nginx/ssl/` | NEW: self-signed cert for dev |
| `docker-compose.yml` | SSL cert volume mount for nginx |
| `SECURITY_AUDIT.md` | NEW: complete security audit report |

### Architecture Verification — Paper vs Implementation

| Paper Concept | Implementation | Status |
|---|---|---|
| K1 = HMAC(activation_code, NID_hash \|\| MAC \|\| BP) | K1 = HMAC(activation_code, NID_hash \|\| browser_fp_hash) | ✅ (MVP: MAC→browser_fp, BP→session_secret) |
| K2 = user password (private) | bcrypt-hashed for auth, Fernet-encrypted for crypto | ✅ |
| BP (biometric fingerprint) | Random 32-byte session_secret | ✅ (MVP trade-off) |
| F1 = HMAC-SHA256(K1, M) | HMAC-SHA256 computed both sides | ✅ |
| AES encryption of M\|F1 with K2\|BP\|T | AES-256-GCM with K2+sess_secret+T | ✅ |
| Server decrypts → verifies K1 → processes | decrypt → HMAC verify → atomic PostgreSQL | ✅ |
| T updated after each transaction | HMAC-chained T with version counter | ✅ |
| Replay attack prevention | t_version match check + FOR UPDATE lock | ✅ |
| NID/BRC-based registration | Via seed script (officer UI deferred) | ✅ |

### Security Audit Summary

| Severity | Total | Fixed | Remaining |
|---|---|---|---|
| CRITICAL | 5 | 5 | 0 |
| HIGH | 6 | 6 | 0 |
| MEDIUM | 13 | 2 | 11 |
| LOW | 15 | 1 | 14 |

Remaining medium items are architecturally complex (Gunicorn worker sharing, idempotency keys, per-transaction caps) — deferred to production hardening phase.

### How to Run

See [README.md](./README.md) for full setup instructions.

```bash
# Backend
cd backend && python wsgi.py

# Frontend
cd frontend && npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5001
- **Login**: alice / alice123 or bob / bob456
