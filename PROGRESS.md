# E-Payment System — Progress Log

> Update this file after each session with what was built, problems faced, and next steps.

---

## Session 1 — Backend Scaffold + Supabase + Seed Data

### What Was Implemented

| Area | Details |
|------|---------|
| **Supabase Connection** | Connected via Session Pooler (IPv4 proxy): `aws-1-ap-south-1.pooler.supabase.com:5432` |
| **Database Schema** | 7 tables + 2 enums created via `supabase_schema.sql` in SQL Editor |
| **Alembic** | Initialized, migration auto-generated, stamped as `head` without altering existing tables |
| **Flask Backend** | App factory, SQLAlchemy models for all 7 tables, config, wsgi entry point |
| **Seed Data** | Idempotent seed script with Alice (10,000 BDT) and Bob (5,000 BDT) test users |

### Files Created

| File | Purpose |
|------|---------|
| `backend/app/__init__.py` | Flask app factory |
| `backend/app/extensions.py` | SQLAlchemy + Migrate instances |
| `backend/app/config.py` | Configuration class (DB URL, secrets) |
| `backend/app/models/*.py` | 7 SQLAlchemy models (user, account, device_credential, timestamp_key, transaction, audit_log, tls_certificate) |
| `backend/app/services/crypto_service.py` | K1 derivation, T initial key generation, SHA256 |
| `backend/app/services/auth_service.py` | User registration with full crypto material generation |
| `backend/seeds/seed.py` | Idempotent seeder for alice/bob |
| `backend/requirements.txt` | Python dependencies |
| `backend/wsgi.py` | Gunicorn/Flask entry point |
| `backend/migrations/` | Alembic migration (stamped) |
| `schema.dbml` | DBML schema for dbdiagram.io |
| `supabase_schema.sql` | PostgreSQL SQL schema |
| `.gitignore` | Exclude .env, secrets, pycache |
| `epayment_project_overview.md` | Full project documentation |

### Problems Faced

1. **Supabase IPv6-only**: Project host only had AAAA (IPv6) record. Machine had no IPv6 default route → "Network is unreachable".
   - **Solution**: Used Supabase Session Pooler at `aws-1-ap-south-1.pooler.supabase.com` which provides free IPv4 proxying.

2. **DATABASE_URL corruption**: Missing `@` symbol between password and host in connection string.
   - **Solution**: Fixed URL format to `postgresql://user:password%23@host:port/db?sslmode=require`

---

## Session 2 — Phase 1: Backend Crypto + Auth API

### What Was Implemented

| Area | Details |
|------|---------|
| **Crypto Service** | Full AES-256-GCM decrypt, HKDF key derivation, HMAC-SHA256 verification, chained T key derivation |
| **Auth Service** | JWT creation (HS256, 15-min expiry), Fernet encryption for K2/session_secret storage, login with password_hash verification |
| **Auth Routes** | `POST /api/v1/auth/login` — returns JWT + t_current + t_version (tested working via HTTP) |
| **Audit Service** | Append-only security event logging |
| **Auth Middleware** | `@require_jwt` decorator for protected routes |
| **User Model** | Added `password_hash` column |

### Files Created/Modified

| File | Change |
|------|--------|
| `backend/app/services/crypto_service.py` | **Rewritten** — added `derive_aes_key()`, `aes_gcm_decrypt()`, `hmac_verify()`, `derive_next_t()`, `fernet_encrypt()`, `fernet_decrypt()`, `verify_payload()` |
| `backend/app/services/auth_service.py` | **Rewritten** — added `login_user()`, `_make_jwt()`, Fernet encrypt at registration |
| `backend/app/services/audit_service.py` | **New** — `log_event()` writes to `audit_log` table |
| `backend/app/middeware/auth_middleware.py` | **New** — `@require_jwt` validates JWT, sets `g.current_user` |
| `backend/app/routes/auth.py` | **New** — `POST /login`, `/logout`, `/refresh` |
| `backend/app/models/user.py` | **Modified** — added `password_hash` column |
| `backend/config.py` | **Modified** — added `JWT_SECRET`, `SERVER_HMAC_SECRET` |
| `backend/app/__init__.py` | **Modified** — register auth blueprint |
| `backend/tests/test_login.py` | **New** — script to verify login flow |
| `backend/.env` | **Fixed** — corrected DATABASE_URL format |

### Schema Changes (Run in Supabase SQL Editor)

```sql
ALTER TABLE users ADD COLUMN password_hash VARCHAR(128) NOT NULL DEFAULT '';
```

### Verified

- `POST /api/v1/auth/login` with alice/alice123 returns 200 + JWT + t_current + t_version ✅
- `GET /api/v1/account/balance` with JWT returns balance + daily limit ✅

---

## Session 3 — Phase 2: Transaction + Account APIs (Current)

### What Was Implemented

| Area | Details |
|------|---------|
| **Transaction Service** | Full 10-step processing: replay check → AES-GCM decrypt → HMAC verify → business logic → atomic DB update → T chain rotation |
| **Transaction Routes** | `POST /initiate`, `GET /history` (paginated), `GET /:transaction_id` |
| **Account Routes** | `GET /balance`, `POST /suspend` |
| **Device Routes** | `GET /status`, `POST /revoke-certificate` (no-op MVP) |
| **Fernet Encryption** | K2 and session_secret encrypted under SECRET_KEY before DB storage |

### Files Created/Modified

| File | Change |
|------|--------|
| `backend/app/services/transaction_service.py` | **New** — `process()` with all 10 steps, atomic balance updates, T chain rotation |
| `backend/app/routes/transaction.py` | **New** — `POST /initiate`, `GET /history`, `GET /:id` |
| `backend/app/routes/account.py` | **New** — `GET /balance` (working), `POST /suspend` |
| `backend/app/routes/device.py` | **New** — `GET /status`, `POST /revoke-certificate` |
| `backend/app/__init__.py` | **Modified** — register all 4 blueprints |
| `backend/app/services/crypto_service.py` | **Modified** — added `fernet_encrypt()`, `fernet_decrypt()`, `_get_fernet()` |
| `backend/app/services/auth_service.py` | **Modified** — encrypt K2/session_secret at registration, return in login response |
| `backend/app/models/device_credential.py` | **Modified** — added `k2_encrypted`, `session_secret_encrypted` columns |
| `backend/tests/update_users.py` | **New** — populate encrypted fields for existing seed users |

### Schema Changes (Run in Supabase SQL Editor)

```sql
ALTER TABLE device_credentials 
ADD COLUMN k2_encrypted TEXT,
ADD COLUMN session_secret_encrypted TEXT;
```

---

## Project Structure (Complete After Session 3)

```
epayment-mvp/
├── .gitignore
├── schema.dbml                          # DBML schema (dbdiagram.io)
├── supabase_schema.sql                  # PostgreSQL schema for Supabase
├── epayment_project_overview.md         # Full project docs
├── PROGRESS.md                          # This file
│
├── backend/
│   ├── .env                             # DB connection + secrets (gitignored)
│   ├── config.py                        # Flask config
│   ├── wsgi.py                          # Entry point
│   ├── requirements.txt
│   │
│   ├── app/
│   │   ├── __init__.py                  # App factory (registers all blueprints)
│   │   ├── extensions.py                # db = SQLAlchemy()
│   │   │
│   │   ├── models/
│   │   │   ├── user.py                  # users table
│   │   │   ├── account.py               # accounts table (1:1)
│   │   │   ├── device_credential.py     # device_credentials table (1:1)
│   │   │   ├── timestamp_key.py         # timestamp_keys table (1:1)
│   │   │   ├── transaction.py           # transactions table (immutable ledger)
│   │   │   ├── audit_log.py             # audit_log table (append-only)
│   │   │   └── tls_certificate.py       # tls_certificates table (future)
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.py                  # POST /api/v1/auth/login|logout|refresh
│   │   │   ├── transaction.py           # POST /initiate, GET /history, GET /:id
│   │   │   ├── account.py               # GET /balance, POST /suspend
│   │   │   └── device.py                # GET /status, POST /revoke-certificate
│   │   │
│   │   ├── services/
│   │   │   ├── crypto_service.py        # AES-GCM, HMAC, HKDF, Fernet, T chain, K1
│   │   │   ├── auth_service.py          # Registration + login with JWT
│   │   │   ├── transaction_service.py   # Full 10-step transaction processing
│   │   │   └── audit_service.py         # Security event logger
│   │   │
│   │   ├── middeware/
│   │   │   └── auth_middleware.py       # @require_jwt decorator
│   │   │
│   │   └── tasks/
│   │       └── __init__.py
│   │
│   ├── seeds/
│   │   └── seed.py                      # Idempotent test user seeder
│   │
│   ├── migrations/
│   │   └── versions/
│   │       └── b0a38563f880_*.py        # Initial schema (stamped)
│   │
│   └── tests/
│       ├── test_login.py                # Login flow test
│       └── update_users.py              # Update existing users with encrypted fields
│
└── frontend/                            # NOT YET CREATED — Phase 3+
```

---

## Seeded Test Users

| Username | Password | Balance | Daily Limit |
|----------|----------|---------|-------------|
| `alice` | `alice123` | 10,000.00 BDT | 5,000.00 |
| `bob` | `bob456` | 5,000.00 BDT | 3,000.00 |

---

## Where to Start Next (Session 4)

### Phase 3: Next.js Frontend Scaffold + Auth UI

1. **Scaffold Next.js project** — `npx create-next-app@14 frontend` with App Router + TypeScript + Tailwind
2. **Login page** — `frontend/app/(auth)/login/page.tsx` with form
3. **BFF auth routes** — `frontend/app/api/auth/[...nextauth]/route.ts` proxies login/refresh/logout to Flask
4. **Session management** — httpOnly JWT cookies, store `t_current`, `t_version`, `k2_encrypted`, `session_secret_encrypted` in encrypted server session
5. **Dashboard** — Balance overview page with auth guard

### Key Files to Create

```
frontend/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx        # Auth guard + nav
│   │   └── page.tsx          # Balance overview
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── transaction/route.ts
│   │   └── account/route.ts
│   └── layout.tsx
├── lib/
│   ├── crypto.ts             # Web Crypto API (AES-GCM, HMAC, HKDF)
│   ├── api-client.ts         # Typed fetch wrapper
│   └── session.ts            # JWT decode/validate
├── components/
│   ├── TransactionForm.tsx
│   ├── BalanceCard.tsx
│   └── TransactionHistory.tsx
└── types/
    └── index.ts
```

### Remaining Phases

| Phase | What | Status |
|-------|------|--------|
| Phase 1 | Backend Crypto + Auth API | ✅ Complete |
| Phase 2 | Backend Transaction + Account APIs | ✅ Complete (core logic written, endpoints live) |
| Phase 3 | Next.js Scaffold + Auth UI | 🔜 Next |
| Phase 4 | Frontend Crypto + Send Money + History | ❌ |
| Phase 5 | Docker, Nginx, Polish | ❌ |

---

## Quick Reference

### Run Flask Server
```bash
cd backend
$env:FLASK_APP = "wsgi.py"
$env:FLASK_DEBUG = "1"
flask run --port 5000
```

### Re-seed Database
```bash
cd backend
python seeds/seed.py
```

### Login Test (curl)
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password_hash":"<sha256-of-alice123>"}'
```

### Alembic
```bash
flask db migrate -m "description"   # Generate migration
flask db upgrade                     # Apply
flask db stamp head                  # Mark current without running
```
