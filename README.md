# E-Payment System (Epay)

> **Secure digital payment system** — replacing paper money for everyday transactions  
> Based on ICECTE 2022 paper — Extended with TLS 1.3 + AES-256-GCM dual-layer security

---

## Quick Start (5 Steps)

### Prerequisites

| Tool | Version | Get It |
|------|---------|--------|
| Python | 3.12+ | [python.org](https://python.org) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| PostgreSQL | 16 | [Supabase](https://supabase.com) (free) or local |

---

### Step 1 — Clone & Configure

```bash
git clone <repo-url> epay
cd epay
```

### Step 2 — Backend

```bash
cd backend

# Create virtual environment & activate
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit backend/.env — see below for required values
```

**`backend/.env` — Required fields:**

| Variable | How to Get |
|----------|-----------|
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_SECRET` | Same command |
| `SERVER_HMAC_SECRET` | Same command |
| `OFFICER_API_KEY` | Same command |
| `DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string (port 5432, NOT 6543) |
| `REDIS_URL` | Optional — `redis://localhost:6379/0` |

### Step 3 — Database Setup

**Option A: Supabase (recommended)**
1. Create free project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database → Connection string**
3. Use the **Direct connection** (port **5432**, not 6543/PgBouncer)
4. Copy it into `backend/.env` as `DATABASE_URL`

**Option B: Local PostgreSQL**
```bash
createdb epayment
psql epayment < supabase_schema.sql
```

### Step 4 — Initialize Database & Seed

```bash
cd backend

# Create tables
python -c "from app import create_app; from app.extensions import db; app=create_app(); app.app_context().push(); db.create_all(); print('Tables created')"

# Insert test users
python seeds/seed.py
```

**Test accounts:**

| Username | Password | Balance |
|----------|----------|---------|
| `alice` | `alice123` | 10,000.00 BDT |
| `bob` | `bob456` | 5,000.00 BDT |

### Step 5 — Run the Full Stack

**Terminal 1 — Backend (Flask API):**
```bash
cd backend
python wsgi.py
# → http://localhost:5000
```

**Terminal 2 — Frontend (Next.js):**
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
# → http://localhost:3000
```

Open **http://localhost:3000** → login as `alice` / `alice123` → send money to `bob`.

---

## Alternative: Docker Deployment

```bash
docker-compose up --build
# Nginx: https://localhost (TLS 1.3)
# Frontend: internal (behind Nginx)
# Backend: internal (behind Nginx)
# Redis: internal
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS 4 |
| Backend | Python + Flask + SQLAlchemy 2.0 |
| Database | PostgreSQL 16 (Supabase managed) |
| Cache | Redis 7 |
| Proxy | Nginx (TLS 1.3) |
| Container | Docker + Compose |

---

## Project Structure

```
epay/
├── backend/                    # Flask API
│   ├── app/
│   │   ├── models/             # 8 SQLAlchemy ORM models
│   │   ├── routes/             # 7 Flask blueprints
│   │   ├── services/           # Business logic layer
│   │   ├── middeware/          # JWT auth, rate limiting
│   │   └── tasks/              # Celery (placeholder)
│   ├── seeds/seed.py           # Test data (alice & bob)
│   ├── config.py               # Env-based configuration
│   └── wsgi.py                 # Entry point
│
├── frontend/                   # Next.js 14 App Router
│   ├── app/                    # Pages + BFF API routes
│   ├── components/             # Reusable UI components
│   ├── lib/                    # Crypto & session utils
│   └── types/                  # TypeScript interfaces
│
├── nginx/                      # Reverse proxy config
├── docker-compose.yml          # Full-stack orchestration
├── supabase_schema.sql         # Raw PostgreSQL DDL
└── schema.dbml                 # DBML schema definition
```

---

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/auth/login` | POST | — | Login |
| `/api/v1/auth/register` | POST | Officer key | Register user |
| `/api/v1/auth/refresh` | POST | JWT | Refresh token |
| `/api/v1/auth/logout` | POST | JWT | Logout |
| `/api/v1/transaction/initiate` | POST | JWT | Send money |
| `/api/v1/transaction/initiate-bff` | POST | JWT | Send (BFF-friendly) |
| `/api/v1/transaction/history` | GET | JWT | Transaction history |
| `/api/v1/transaction/:id` | GET | JWT | Transaction detail |
| `/api/v1/account/balance` | GET | JWT | Balance |
| `/api/v1/account/suspend` | POST | JWT | Suspend account |
| `/api/v1/device/status` | GET | JWT | Device info |
| `/api/v1/notification/list` | GET | JWT | Notifications |
| `/api/v1/notification/read` | POST | JWT | Mark read |
| `/api/v1/notification/unread-count` | GET | JWT | Unread count |
| `/api/v1/simulate/encrypt` | POST | JWT | Crypto simulation |
| `/api/v1/simulate/decrypt` | POST | JWT | Crypto simulation |
| `/api/v1/health` | GET | — | Health check |

---

## Security Architecture

```
┌─────────────────────────────────────┐
│ LAYER 4 — AUTH                      │
│ JWT (HS256, 15min) + bcrypt + CSRF  │
├─────────────────────────────────────┤
│ LAYER 3 — INTEGRITY                 │
│ HMAC-SHA256 (F1) + GCM auth tag     │
├─────────────────────────────────────┤
│ LAYER 2 — CONFIDENTIALITY           │
│ AES-256-GCM + HKDF-derived key      │
├─────────────────────────────────────┤
│ LAYER 1 — TRANSPORT                 │
│ TLS 1.3 (Nginx) + HSTS + CSP       │
└─────────────────────────────────────┘
```

### Transaction Flow (10-Step Pipeline)

1. Load sender + device + account + timestamp_key
2. Device active + account active check
3. Replay check (t_version must match)
4. Recompute K1 + derive AES key via HKDF
5. AES-GCM decrypt (verify auth tag)
6. Parse M (JSON) + F1 (HMAC) from plaintext
7. HMAC verify: recompute F2, compare with F1
8. Business checks: receiver exists, funds sufficient, daily limit OK
9. Atomic PostgreSQL: FOR UPDATE locks → UPDATE balances → INSERT transaction → UPDATE T chain
10. Return result + new T/version

---

## Documentation

| File | Description |
|------|-------------|
| [`docs/epayment_project_overview.md`](./docs/epayment_project_overview.md) | Full technical deep-dive (crypto, keys, threat model) |
| [`docs/PAPER_COMPLIANCE.md`](./docs/PAPER_COMPLIANCE.md) | ICECTE 2022 framework compliance report |
| [`docs/SECURITY_AUDIT.md`](./docs/SECURITY_AUDIT.md) | Security audit (5 critical + 6 high — all fixed) |
| [`docs/TESTING_PLAN.md`](./docs/TESTING_PLAN.md) | Security testing strategy |
| [`docs/PROGRESS.md`](./docs/PROGRESS.md) | Development progress log |
| [`supabase_schema.sql`](./supabase_schema.sql) | Raw PostgreSQL DDL |
| [`schema.dbml`](./schema.dbml) | DBML schema definition |
