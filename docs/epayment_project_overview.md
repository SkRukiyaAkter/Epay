# E-Payment System — Project Overview & Technical Documentation

> Based on: *"E-Payment System to Reduce Use of Paper Money for Daily Transactions"*
> 4th International Conference on Electrical, Computer & Telecommunication Engineering (ICECTE), December 2022
> Extended with TLS 1.3 integration for production-grade security
> **MVP Target: Web Application**

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [What We Are Trying to Implement](#2-what-we-are-trying-to-implement)
3. [Tech Stack & Architecture Decisions](#3-tech-stack--architecture-decisions)
4. [Core Security Philosophy](#4-core-security-philosophy)
5. [Project Structure](#5-project-structure)
6. [Database Schemas](#6-database-schemas)
7. [API Specification](#7-api-specification)
8. [Logic & Methodology — Original Framework](#8-logic--methodology--original-framework)
9. [Logic & Methodology — TLS-Modified Version](#9-logic--methodology--tls-modified-version)
10. [Security Threat Model & Mitigations](#10-security-threat-model--mitigations)
11. [Key Management Lifecycle](#11-key-management-lifecycle)
12. [Transaction State Machine](#12-transaction-state-machine)
13. [MVP Scope & Deferred Features](#13-mvp-scope--deferred-features)

---

## 1. What We Are Building

We are building a **web-based electronic payment system** as our first MVP, designed to replace the use of physical paper money for everyday, small-value (petty cash) transactions. The system targets real-world use cases in Bangladesh and similar emerging-economy contexts — paying for vegetable market purchases, fish markets, public transport fares, low-speed vehicle rides, utility bills, school and college fees, and general retail.

For the MVP, the system is delivered as a **responsive web application** accessible from any modern browser on desktop or mobile. It is not a native mobile app in this iteration — the browser is the runtime. This decision is deliberate: it removes the friction of app store distribution, works across Android and iOS without separate codebases, and lets us validate the core payment flow, cryptographic architecture, and user experience before committing to a native build.

The fundamental problem the system solves is threefold:

**Physical money degrades.** Paper notes become old, torn, burnt, and soiled through repeated handling. Damaged notes are frequently rejected at point-of-sale. The e-payment system eliminates this entirely — value exists as a digital balance, not a physical artifact.

**Physical money is insecure.** Cash is vulnerable to theft, robbery, and loss. There is no recovery mechanism for stolen cash. In the proposed system, even if a user's session is hijacked, the attacker cannot transact because every payment is cryptographically signed on the server side using keys derived from the user's registered credentials and a rolling timestamp.

**Existing systems are either insecure or overly complex.** Many e-payment systems in use (including local platforms like bKash, Nagad, and Rocket) rely on OTP (one-time password) mechanisms with known vulnerabilities — SIM swapping, SS7 attacks, social engineering. This framework eliminates OTP by replacing it with a cryptographic HMAC key bound to the user's identity and device fingerprint.

---

## 2. What We Are Trying to Implement

At its core, we are implementing a **secure message-passing architecture** between the user's browser (Next.js frontend) and a Python/Flask backend server. Every payment is a cryptographically protected message that carries:

- The identity of the sender (authenticated by their registered credentials and HMAC key K1)
- The identity of the receiver (a bank-assigned username)
- The amount to be transferred
- A timestamp key T that changes after every successful transaction (anti-replay)
- A hash F1 computed with HMAC-SHA-256 that proves the message has not been tampered with
- AES-256-GCM encryption that ensures no third party can read the message even if intercepted

We are extending the original paper's design by adding **Transport Layer Security (TLS 1.3)** as a transport-layer wrapper — enforced at the reverse proxy (Nginx) level in the MVP. This creates a two-layer security model:

- **Layer 1 (Transport):** TLS 1.3 via Nginx terminates HTTPS at the edge, preventing eavesdropping and server impersonation. All traffic between browser and server is encrypted at the network level.
- **Layer 2 (Application):** AES-256-GCM + HMAC-SHA-256 secures the transaction payload itself — ensuring the content is encrypted independently of the transport, the message is authenticated to a specific user and session, and replay attacks are structurally prevented via the rolling timestamp key.

**For the MVP web context**, biometric fingerprint (Bp) — which is physically impossible to capture in a standard browser without specialized hardware — is replaced by a **WebAuthn / FIDO2 passkey** or, in the simplest fallback, a **device-bound session secret** derived from browser fingerprinting and a PIN. This adaptation is fully documented in Section 13 (MVP Scope).

---

## 3. Tech Stack & Architecture Decisions

### 3.1 Chosen Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | **Next.js 14 (App Router)** + TypeScript | SSR for fast initial load, built-in API routes for BFF pattern, TypeScript for type-safe crypto operations |
| Styling | **Tailwind CSS** | Rapid UI iteration for MVP; no design system overhead |
| Frontend crypto | **Web Crypto API** (browser-native) | Zero-dependency AES-GCM + HMAC in the browser; hardware-accelerated; no third-party crypto library needed |
| Backend API | **Python 3.12 + Flask** | Fast to write, excellent cryptography library (`cryptography` package wraps OpenSSL), easy to reason about security-critical code paths |
| Backend crypto | **Python `cryptography` library** | Industry-standard OpenSSL bindings; AES-GCM, HMAC-SHA256, HKDF all available |
| Database | **PostgreSQL 16 via Supabase** (managed) | ACID transactions are non-negotiable for a payment system; `NUMERIC` type for money; row-level locking for atomic balance updates. Supabase is used **only** as the managed Postgres provider — connection via the **direct port (5432)**, not PgBouncer (port 6543), so `SELECT ... FOR UPDATE` works natively. No Supabase Auth, Edge Functions, or RLS features are used. |
| ORM | **SQLAlchemy 2.0** (Python) | Type-safe queries, connection pooling, transaction management |
| Database migrations | **Alembic** | Version-controlled schema changes |
| Reverse proxy / TLS | **Nginx** | TLS 1.3 termination, certificate management, rate limiting at the edge |
| TLS certificates | **Let's Encrypt + Certbot** (dev/staging) / commercial CA (production) | Automated renewal, widely trusted |
| Auth tokens | **PyJWT** (Flask) + **jose** (Next.js) | Short-lived JWTs for session management |
| Task queue | **Celery + Redis** | Async jobs: daily limit resets, audit log flushing, notification dispatch |
| Containerization | **Docker + Docker Compose** | Consistent dev/prod environments; easy local setup |

### 3.2 Why Flask Over Django / FastAPI

Flask is recommended over the alternatives for this specific project for the following reasons:

**Over Django:** Django's ORM, admin panel, and batteries-included approach introduce a large surface area that we do not need — and in a security-critical system, a smaller surface area is a feature. Flask gives us explicit control over every middleware, every route handler, and every database interaction. There are no magic behaviors to audit.

**Over FastAPI:** FastAPI's async-first model is excellent for high-throughput APIs with I/O-bound operations. However, our cryptographic operations (HMAC verification, AES decryption, key derivation) are CPU-bound and do not benefit from async concurrency in the same way. Flask with Gunicorn workers (sync or gevent) is simpler to reason about and debug in a financial context. FastAPI is the right choice when we scale horizontally; for MVP it adds complexity without benefit.

**Flask's strengths here:** Minimal surface area, explicit request handling, straightforward transaction management with SQLAlchemy, easy integration of the `cryptography` library, and a team-familiar mental model.

### 3.3 Why Next.js

Next.js is the right frontend choice because:

- The **App Router** with Server Components allows us to render the dashboard, transaction history, and balance UI on the server — meaning sensitive account summaries are not fetched via client-side JavaScript calls that could be intercepted.
- **Next.js API Routes / Route Handlers** let us build a Backend-for-Frontend (BFF) layer in TypeScript that sits between the browser and the Flask API. The BFF handles session token refresh, request signing, and response shaping — keeping the Flask API clean and stateless.
- **TypeScript** throughout the frontend means our cryptographic payload construction (the AES-GCM encryption logic that runs in the browser) is type-safe. Mistakes in key derivation or payload assembly are caught at compile time, not at runtime in a live payment.

### 3.4 Architecture Overview

```
Browser (Next.js)
      │
      │  HTTPS (TLS 1.3)
      ▼
  Nginx (reverse proxy)
  ├── TLS termination
  ├── Rate limiting (per-IP, per-user)
  └── Static asset serving
      │
      ├──► Next.js server (port 3000)
      │     ├── App Router pages (SSR)
      │     └── Route Handlers (BFF layer)
      │               │
      │               │ Internal HTTP (Docker network)
      │               ▼
      └──► Flask API server (port 5000, Gunicorn)
                ├── /api/v1/auth/*
                ├── /api/v1/transaction/*
                ├── /api/v1/account/*
                └── /api/v1/device/*
                          │
                ┌─────────┼─────────┐
                ▼         ▼         ▼
          PostgreSQL    Redis     Celery
          (primary DB)  (cache,   (async
                        sessions,  workers)
                        queue)
```

The Next.js server and Flask API server communicate over the internal Docker network — never exposed directly to the internet. Only Nginx is public-facing.

### 3.5 Environment Configuration

```
# .env.local (Next.js)
NEXT_PUBLIC_APP_NAME=E-Payment MVP
API_BASE_URL=http://flask:5000          # internal Docker service name
JWT_SECRET=<generated-secret>
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=https://yourdomain.com

# .env (Flask)
FLASK_ENV=production
DATABASE_URL=postgresql://user:pass@<supabase-db-host>:5432/postgres  # Supabase direct connection
REDIS_URL=redis://redis:6379/0
SECRET_KEY=<flask-secret-key>
JWT_SECRET=<same-as-nextjs-or-separate>
SERVER_HMAC_SECRET=<server-side-secret-for-T-derivation>
TLS_CERT_PATH=/etc/ssl/certs/server.crt
TLS_KEY_PATH=/etc/ssl/private/server.key
DAILY_RESET_CRON=0 0 * * *
```

---

## 4. Core Security Philosophy

The security architecture is built around four fundamental principles:

**Confidentiality** — No third party can read the transaction content. This is achieved through two independent layers: TLS at transport (Nginx) and AES-256-GCM at application (browser → Flask). Even if TLS is somehow stripped (e.g. by a compromised proxy), the AES layer remains intact.

**Integrity** — Any modification to the transaction message, even a single bit, is immediately detectable. HMAC-SHA-256 produces a hash mathematically bound to the exact message content and to the user's key K1. The server independently recomputes this hash and compares. AES-GCM's authentication tag provides a second integrity check at the encryption layer itself.

**Authentication** — The system authenticates at three independent levels: (1) the user knows their password K2; (2) the user possesses a session-bound device secret (Bp substitute in the web MVP); (3) the user's session is identified by the derived HMAC key K1. Compromise of any one factor alone is insufficient to transact.

**Non-repudiation** — Because K1 is bound to the user's registered identity and K2 is known only to the user, a valid transaction message could only have originated from that specific authenticated user. The timestamp chain ensures each transaction is unique and sequentially ordered.

---

## 5. Project Structure

```
epayment-mvp/
├── frontend/                          # Next.js 14 application
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Balance overview
│   │   │   ├── send/page.tsx          # Send money
│   │   │   └── history/page.tsx       # Transaction history
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── transaction/route.ts   # BFF: encrypts & forwards to Flask
│   │   │   └── account/route.ts
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── crypto.ts                  # Web Crypto API wrappers (AES-GCM, HMAC, HKDF)
│   │   ├── api-client.ts              # Typed fetch wrapper to BFF routes
│   │   └── session.ts                 # JWT decode/validate helpers
│   ├── components/
│   │   ├── TransactionForm.tsx
│   │   ├── BalanceCard.tsx
│   │   └── TransactionHistory.tsx
│   ├── types/
│   │   └── index.ts                   # Shared TypeScript types
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── backend/                           # Flask application
│   ├── app/
│   │   ├── __init__.py                # Flask app factory
│   │   ├── extensions.py              # db, redis, celery instances
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── account.py
│   │   │   ├── device_credential.py
│   │   │   ├── timestamp_key.py
│   │   │   ├── transaction.py
│   │   │   └── audit_log.py
│   │   ├── routes/
│   │   │   ├── auth.py                # /api/v1/auth/*
│   │   │   ├── transaction.py         # /api/v1/transaction/*
│   │   │   ├── account.py             # /api/v1/account/*
│   │   │   └── device.py              # /api/v1/device/*
│   │   ├── services/
│   │   │   ├── crypto_service.py      # AES-GCM, HMAC, HKDF logic
│   │   │   ├── transaction_service.py # Business logic, atomic DB ops
│   │   │   ├── auth_service.py        # JWT, session management
│   │   │   └── audit_service.py       # Audit log writes
│   │   ├── tasks/
│   │   │   └── daily_reset.py         # Celery task: reset daily_used
│   │   └── middleware/
│   │       ├── tls_verify.py          # mTLS cert check (future)
│   │       └── rate_limit.py
│   ├── seeds/
│   │   └── seed.py                    # Dev/demo data seeder (idempotent)
│   ├── migrations/                    # Alembic migration scripts
│   ├── tests/
│   │   ├── test_crypto_service.py
│   │   ├── test_transaction.py
│   │   └── test_auth.py
│   ├── config.py
│   ├── wsgi.py                        # Gunicorn entry point
│   └── requirements.txt
│
├── nginx/
│   ├── nginx.conf
│   └── ssl/                           # Certs (gitignored in production)
│
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

---

## 6. Database Schemas

PostgreSQL 16 is the database. All monetary values use `NUMERIC(15, 2)` — never `FLOAT` or `DOUBLE`, which introduce rounding errors unacceptable in a financial system. All IDs are UUID v4. All timestamps are `TIMESTAMPTZ` (timezone-aware).

The SQLAlchemy models below mirror the SQL schemas exactly. Both are provided so the Flask models and the raw SQL for Alembic migrations are unambiguous.

---

### 6.1 Users Table

Stores core identity and account status. Raw NID/BRC numbers are never stored — only their SHA-256 hash.

```sql
CREATE TABLE users (
    user_id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    username         VARCHAR(64)     UNIQUE NOT NULL,
    full_name        VARCHAR(255)    NOT NULL,
    nid_hash         VARCHAR(128)    NOT NULL UNIQUE,
    email            VARCHAR(255),
    account_status   VARCHAR(20)     NOT NULL DEFAULT 'active'
                                     CHECK (account_status IN
                                       ('active', 'suspended', 'locked', 'pending')),
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);
```

SQLAlchemy model (`backend/app/models/user.py`):

```python
from app.extensions import db
import uuid
from datetime import datetime, timezone

class User(db.Model):
    __tablename__ = "users"

    user_id        = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username       = db.Column(db.String(64), unique=True, nullable=False)
    full_name      = db.Column(db.String(255), nullable=False)
    nid_hash       = db.Column(db.String(128), unique=True, nullable=False)
    email          = db.Column(db.String(255))
    account_status = db.Column(db.String(20), nullable=False, default="active")
    created_at     = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at     = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                               onupdate=lambda: datetime.now(timezone.utc))

    account            = db.relationship("Account", back_populates="user", uselist=False)
    device_credential  = db.relationship("DeviceCredential", back_populates="user", uselist=False)
    timestamp_key      = db.relationship("TimestampKey", back_populates="user", uselist=False)
```

---

### 6.2 Accounts Table

Financial balances and daily limits. Separated from `users` so DB roles can restrict financial data access independently from identity data.

```sql
CREATE TABLE accounts (
    account_id       UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID            NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE RESTRICT,
    balance          NUMERIC(15, 2)  NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    daily_limit      NUMERIC(15, 2)  NOT NULL DEFAULT 5000.00,
    daily_used       NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
    daily_reset_at   DATE            NOT NULL DEFAULT CURRENT_DATE,
    currency         VARCHAR(3)      NOT NULL DEFAULT 'BDT',
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);
```

SQLAlchemy model (`backend/app/models/account.py`):

```python
from app.extensions import db
import uuid
from decimal import Decimal
from datetime import date, datetime, timezone

class Account(db.Model):
    __tablename__ = "accounts"

    account_id     = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id        = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.user_id"), unique=True, nullable=False)
    balance        = db.Column(db.Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    daily_limit    = db.Column(db.Numeric(15, 2), nullable=False, default=Decimal("5000.00"))
    daily_used     = db.Column(db.Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    daily_reset_at = db.Column(db.Date, nullable=False, default=date.today)
    currency       = db.Column(db.String(3), nullable=False, default="BDT")
    created_at     = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at     = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                               onupdate=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", back_populates="account")
```

**Design note on `daily_reset_at`:** Before processing any transaction, the Flask `transaction_service.py` checks `account.daily_reset_at < date.today()`. If true, it resets `daily_used = 0` and sets `daily_reset_at = today` within the same atomic transaction. This is safer than a cron job because it guarantees the reset is atomic with the transaction — a cron race condition could allow a user to exceed their limit in the window between reset and their transaction.

---

### 6.3 Device Credentials Table

Cryptographic credentials tied to a specific registered device/browser session. In the web MVP, "device" refers to the browser + machine combination identified at registration time.

```sql
CREATE TABLE device_credentials (
    device_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID        NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    browser_fingerprint    VARCHAR(128) NOT NULL,     -- SHA-256(user_agent + screen res + timezone + canvas hash)
    k1_hash                VARCHAR(128) NOT NULL,     -- SHA-256(K1); K1 never stored server-side in plaintext
    session_secret_hash    VARCHAR(128) NOT NULL,     -- SHA-256(Bp_substitute): device-bound session secret
    activation_code_hash   VARCHAR(128) NOT NULL,     -- consumed at registration; stored as hash for audit
    tls_client_cert_pem    TEXT,                      -- mTLS: nullable for MVP, required in production
    tls_cert_serial        VARCHAR(128),
    tls_cert_expires_at    TIMESTAMPTZ,
    app_version            VARCHAR(32),
    is_active              BOOLEAN     NOT NULL DEFAULT true,
    registered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at           TIMESTAMPTZ
);
```

SQLAlchemy model (`backend/app/models/device_credential.py`):

```python
from app.extensions import db
import uuid
from datetime import datetime, timezone

class DeviceCredential(db.Model):
    __tablename__ = "device_credentials"

    device_id             = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id               = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.user_id"), unique=True, nullable=False)
    browser_fingerprint   = db.Column(db.String(128), nullable=False)
    k1_hash               = db.Column(db.String(128), nullable=False)
    session_secret_hash   = db.Column(db.String(128), nullable=False)
    activation_code_hash  = db.Column(db.String(128), nullable=False)
    tls_client_cert_pem   = db.Column(db.Text)
    tls_cert_serial       = db.Column(db.String(128))
    tls_cert_expires_at   = db.Column(db.DateTime(timezone=True))
    app_version           = db.Column(db.String(32))
    is_active             = db.Column(db.Boolean, nullable=False, default=True)
    registered_at         = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_used_at          = db.Column(db.DateTime(timezone=True))

    user = db.relationship("User", back_populates="device_credential")
```

---

### 6.4 Timestamp Keys Table

The anti-replay state. After every successful transaction, `current_t` and `t_version` are updated atomically with the balance changes. A replayed message carries a stale `t_version` and is rejected before any other processing.

```sql
CREATE TABLE timestamp_keys (
    ts_key_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    current_t       VARCHAR(256) NOT NULL,
    t_version       BIGINT      NOT NULL DEFAULT 1,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

SQLAlchemy model (`backend/app/models/timestamp_key.py`):

```python
from app.extensions import db
import uuid
from datetime import datetime, timezone

class TimestampKey(db.Model):
    __tablename__ = "timestamp_keys"

    ts_key_id      = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id        = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.user_id"), unique=True, nullable=False)
    current_t      = db.Column(db.String(256), nullable=False)
    t_version      = db.Column(db.BigInteger, nullable=False, default=1)
    last_updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                                onupdate=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", back_populates="timestamp_key")
```

---

### 6.5 Transactions Table

Immutable financial ledger. Records are **never updated or deleted** — they are the ground truth of all value movements. The `status` field is the only column that changes after initial insert (from `pending` to `completed` or `failed`), and only within the atomic DB transaction that also modifies balances.

```sql
CREATE TABLE transactions (
    transaction_id   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id        UUID            NOT NULL REFERENCES users(user_id),
    receiver_id      UUID            NOT NULL REFERENCES users(user_id),
    amount           NUMERIC(15, 2)  NOT NULL CHECK (amount > 0),
    currency         VARCHAR(3)      NOT NULL DEFAULT 'BDT',
    status           VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                     CHECK (status IN
                                       ('pending', 'completed', 'failed', 'rejected')),
    failure_reason   TEXT,
    hmac_verified    BOOLEAN         NOT NULL DEFAULT false,
    t_version_used   BIGINT          NOT NULL,
    initiated_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ,
    tls_session_id   VARCHAR(128),
    ip_address       INET,
    device_id        UUID            REFERENCES device_credentials(device_id)
);
```

SQLAlchemy model (`backend/app/models/transaction.py`):

```python
from app.extensions import db
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import CheckConstraint

class Transaction(db.Model):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_amount_positive"),
    )

    transaction_id  = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id       = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.user_id"), nullable=False)
    receiver_id     = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.user_id"), nullable=False)
    amount          = db.Column(db.Numeric(15, 2), nullable=False)
    currency        = db.Column(db.String(3), nullable=False, default="BDT")
    status          = db.Column(db.String(20), nullable=False, default="pending")
    failure_reason  = db.Column(db.Text)
    hmac_verified   = db.Column(db.Boolean, nullable=False, default=False)
    t_version_used  = db.Column(db.BigInteger, nullable=False)
    initiated_at    = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at    = db.Column(db.DateTime(timezone=True))
    tls_session_id  = db.Column(db.String(128))
    ip_address      = db.Column(db.String(45))    # INET as string; cast in queries
    device_id       = db.Column(db.UUID(as_uuid=True), db.ForeignKey("device_credentials.device_id"))

    sender   = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])
```

---

### 6.6 Audit Log Table

Append-only log of every security-relevant event. Written to by `audit_service.py` on every auth failure, HMAC mismatch, replay detection, account status change, and suspicious pattern.

```sql
CREATE TABLE audit_log (
    log_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        REFERENCES users(user_id),
    device_id      UUID        REFERENCES device_credentials(device_id),
    event_type     VARCHAR(64) NOT NULL,
    event_detail   JSONB,
    ip_address     INET,
    tls_session_id VARCHAR(128),
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at DESC);
```

---

### 6.7 TLS Certificates Table

Tracks issued mTLS client certificates. Not used in the web MVP (no client cert in a browser context) but schema is included so the production upgrade path requires no migration rework.

```sql
CREATE TABLE tls_certificates (
    cert_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id         UUID        NOT NULL REFERENCES device_credentials(device_id) ON DELETE CASCADE,
    serial_number     VARCHAR(128) NOT NULL UNIQUE,
    issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL,
    revoked           BOOLEAN     NOT NULL DEFAULT false,
    revoked_at        TIMESTAMPTZ,
    revocation_reason VARCHAR(128)
);
```

---

## 7. API Specification

All endpoints are served over HTTPS (TLS 1.3, enforced at Nginx). All request/response bodies are JSON. Authenticated endpoints require `Authorization: Bearer <jwt>`.

The Next.js **Route Handlers** (`/app/api/*`) act as a BFF (Backend for Frontend). The browser never calls Flask directly — it calls the Next.js BFF, which performs the AES-GCM encryption, attaches the JWT, and forwards to Flask. This keeps the Flask API on the internal Docker network, never publicly routable.

---

### 7.1 Auth Endpoints (Flask: `/api/v1/auth/*`)

#### `POST /api/v1/auth/register`

Called by the bank officer's terminal (a protected admin interface) to register a new user.

Request:
```json
{
  "full_name": "string",
  "nid_number": "string",
  "phone_number": "string",
  "email": "string | null",
  "browser_fingerprint": "string",
  "session_secret_hash": "string",
  "daily_limit": 5000.00,
  "activation_code": "string"
}
```

Response `201`:
```json
{
  "user_id": "uuid",
  "username": "string",
  "account_id": "uuid",
  "registration_status": "success"
}
```

Flask handler sketch (`backend/app/routes/auth.py`):
```python
@auth_bp.route("/register", methods=["POST"])
@require_officer_jwt
def register():
    data = request.get_json()
    user, account = auth_service.register_user(
        full_name=data["full_name"],
        nid_number=data["nid_number"],        # hashed in auth_service before storage
        phone_number=data["phone_number"],
        email=data.get("email"),
        browser_fingerprint=data["browser_fingerprint"],
        session_secret_hash=data["session_secret_hash"],
        daily_limit=Decimal(str(data["daily_limit"])),
        activation_code=data["activation_code"],
    )
    return jsonify({
        "user_id": str(user.user_id),
        "username": user.username,
        "account_id": str(account.account_id),
        "registration_status": "success",
    }), 201
```

---

#### `POST /api/v1/auth/login`

Request:
```json
{
  "username": "string",
  "password_hash": "string"
}
```

Response `200`:
```json
{
  "session_token": "string",
  "t_current": "string",
  "t_version": 12
}
```

The `session_token` is a JWT signed with the server's `JWT_SECRET`, containing `user_id`, `device_id`, `exp` (15 minutes), and `iat`. It is stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie by the Next.js BFF — never exposed to JavaScript in the browser.

---

#### `POST /api/v1/auth/logout`

Authorization: Bearer JWT.

Response `200`:
```json
{ "logged_out": true }
```

Blacklists the JWT `jti` in Redis with a TTL matching the token's remaining lifetime.

---

#### `POST /api/v1/auth/refresh`

The Next.js BFF calls this automatically when the access token is near expiry. The refresh token (stored in a separate `httpOnly` cookie) is validated and a new access token is returned.

---

### 7.2 Transaction Endpoints (Flask: `/api/v1/transaction/*`)

#### `POST /api/v1/transaction/initiate`

This is the core endpoint. The browser's AES-GCM encrypted payload arrives here, having been forwarded by the Next.js BFF. Flask decrypts it, verifies HMAC, and processes the transfer.

Request:
```json
{
  "encrypted_payload": "string",
  "t_version": 12,
  "device_id": "uuid"
}
```

Where `encrypted_payload` is `Base64( IV || AES-256-GCM-ciphertext || GCM-auth-tag )` and the plaintext before encryption is:

```json
{
  "sender_username": "string",
  "receiver_username": "string",
  "amount": "string",
  "currency": "BDT",
  "timestamp": "ISO8601",
  "nonce": "string"
}
```

Response `200` (success):
```json
{
  "transaction_id": "uuid",
  "status": "completed",
  "sender_new_balance": "string",
  "t_next": "string",
  "t_version_next": 13,
  "completed_at": "ISO8601"
}
```

Response `400 / 403` (failure):
```json
{
  "transaction_id": "uuid",
  "status": "failed",
  "reason": "hmac_mismatch | replay_detected | insufficient_funds | daily_limit_exceeded | receiver_not_found | decryption_failed"
}
```

Flask handler sketch (`backend/app/routes/transaction.py`):
```python
@transaction_bp.route("/initiate", methods=["POST"])
@require_jwt
def initiate_transaction():
    data = request.get_json()
    result = transaction_service.process(
        encrypted_payload=data["encrypted_payload"],
        declared_t_version=data["t_version"],
        device_id=data["device_id"],
        sender_user_id=g.current_user_id,    # set by @require_jwt
        ip_address=request.remote_addr,
        tls_session_id=request.headers.get("X-TLS-Session-ID"),
    )
    status_code = 200 if result["status"] == "completed" else 400
    return jsonify(result), status_code
```

---

#### `GET /api/v1/transaction/history`

Query params: `?page=1&limit=20&from=ISO8601&to=ISO8601`

Response `200`:
```json
{
  "transactions": [
    {
      "transaction_id": "uuid",
      "direction": "sent | received",
      "counterparty_username": "string",
      "amount": "string",
      "currency": "string",
      "status": "string",
      "completed_at": "ISO8601"
    }
  ],
  "total": 42,
  "page": 1,
  "pages": 3
}
```

---

#### `GET /api/v1/transaction/:transaction_id`

Returns full detail for a single transaction. The requesting user must be the sender or receiver.

---

### 7.3 Account Endpoints (Flask: `/api/v1/account/*`)

#### `GET /api/v1/account/balance`

Response `200`:
```json
{
  "balance": "10250.00",
  "currency": "BDT",
  "daily_limit": "5000.00",
  "daily_used": "1200.00",
  "daily_remaining": "3800.00"
}
```

---

#### `POST /api/v1/account/suspend`

Request:
```json
{ "reason": "string" }
```

Immediately sets `account_status = 'suspended'` and `device_credentials.is_active = false`. Writes to audit log. Blacklists all active JWTs for this user in Redis.

---

### 7.4 Device Endpoints (Flask: `/api/v1/device/*`)

#### `GET /api/v1/device/status`

Returns whether the current device is active, registration date, last used timestamp.

#### `POST /api/v1/device/revoke-certificate`

Revokes the mTLS certificate (no-op in MVP web context, triggers re-registration flow). In the production native app context, this inserts a revocation record into `tls_certificates` and updates the OCSP responder.

---

### 7.5 Next.js BFF Route Handlers

These live in `frontend/app/api/` and are the only endpoints the browser calls directly.

#### `POST /api/transaction` (Next.js Route Handler)

This is where the browser-side cryptography happens. The Next.js server receives the raw transaction intent from the browser form, performs AES-GCM encryption using the Web Crypto API (running in the Next.js Node.js runtime, not the browser — giving us a trusted execution environment for key material), and forwards the encrypted payload to Flask.

```typescript
// frontend/app/api/transaction/route.ts
import { NextRequest, NextResponse } from "next/server";
import { encryptPayload } from "@/lib/crypto";
import { getServerSession } from "next-auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // AES-GCM encryption runs here in the Next.js server runtime
  const { encryptedPayload, hmacF1 } = await encryptPayload({
    senderUsername: session.user.username,
    receiverUsername: body.receiverUsername,
    amount: body.amount,
    currency: "BDT",
    k2: session.k2Derived,           // derived from login, stored in encrypted server session
    sessionSecret: session.sessionSecret,
    tCurrent: session.tCurrent,
    nonce: crypto.randomUUID(),
  });

  const flaskRes = await fetch(`${process.env.API_BASE_URL}/api/v1/transaction/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({
      encrypted_payload: encryptedPayload,
      t_version: session.tVersion,
      device_id: session.deviceId,
    }),
  });

  const data = await flaskRes.json();

  // Update session t_current and t_version on success
  if (data.status === "completed") {
    // update session store with t_next, t_version_next
  }

  return NextResponse.json(data, { status: flaskRes.status });
}
```

---

## 8. Logic & Methodology — Original Framework

### 8.1 Key Generation at Registration

When a user registers (via the bank officer's admin portal), three cryptographic artifacts are generated:

**K1 — The HMAC Key (Identity-Bound Key)**

```python
# backend/app/services/crypto_service.py
import hashlib, hmac

def derive_k1(activation_code: str, nid_number: str, browser_fingerprint: str) -> bytes:
    nid_hash = hashlib.sha256(nid_number.encode()).digest()
    fp_hash  = hashlib.sha256(browser_fingerprint.encode()).digest()
    msg      = nid_hash + fp_hash
    k1       = hmac.new(activation_code.encode(), msg, hashlib.sha256).digest()
    return k1
```

K1 is computed on the server at registration, sent to the client **once** (stored in the browser's `sessionStorage` encrypted under K2 for the session), and never stored server-side in plaintext. The server stores only `SHA-256(K1)`. At transaction time, the server recomputes K1 from the components it holds (activation_code_hash, nid_hash, browser_fingerprint_hash) to verify the HMAC.

In the web MVP, the original paper's MAC address is replaced with a **browser fingerprint** — a SHA-256 hash of: `User-Agent + screen resolution + timezone + canvas fingerprint + installed fonts hash`. This is computed at registration and stored in `device_credentials.browser_fingerprint`. It is not as hardware-bound as a MAC address, but it provides meaningful device differentiation for the MVP scope.

**K2 — The User's Password Key**

K2 is the user's chosen password. For AES key derivation it is used as raw key material (not its bcrypt hash used for login verification). The server needs the raw K2 or a consistent derivation of it to reconstruct the AES key during decryption. This is handled by storing an **encrypted form of K2** in the server session (encrypted under the server's `SECRET_KEY` via Fernet/AES-GCM), retrieved at transaction time. The raw K2 is never stored in the database.

**Bp substitute — Session Secret**

In the native app, Bp is the biometric fingerprint hash. In the web MVP, Bp is replaced by a **session-bound secret** (`session_secret`) that is generated at registration, stored in `device_credentials.session_secret_hash` (as SHA-256), and retrieved from the user's encrypted server-side session at transaction time. The user is not aware of this value — it is managed entirely by the system. This is a deliberate MVP simplification; the production native app will replace it with a real biometric hash.

**Development shortcut — Seeded Data**

For development and demo purposes, the bank-officer registration flow is bypassed. A seed script (`backend/seeds/seed.py`) calls the **same** `auth_service.register_user()` function with pre-determined values for `browser_fingerprint`, `password`, `nid_number`, and `activation_code`. This produces structurally identical user records — every cryptographic artifact (K1, K2 hash, session_secret, T_0) is generated exactly as it would be in production. See §13.1 for the full seeded data specification.

### 8.2 AES Key Derivation

```python
# backend/app/services/crypto_service.py
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
import os

def derive_aes_key(k2: bytes, session_secret: bytes, t_current: str, nonce: str) -> bytes:
    ikm = k2 + session_secret + t_current.encode()
    salt = nonce.encode()[:32].ljust(32, b'\x00')
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,          # AES-256
        salt=salt,
        info=b"epayment-transaction-v1",
    )
    return hkdf.derive(ikm)
```

The same function must be replicated in TypeScript for the Next.js BFF using the Web Crypto API:

```typescript
// frontend/lib/crypto.ts
export async function deriveAesKey(
  k2: string, sessionSecret: string, tCurrent: string, nonce: string
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const ikm = new Uint8Array([
    ...enc.encode(k2),
    ...enc.encode(sessionSecret),
    ...enc.encode(tCurrent),
  ]);
  const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode(nonce.slice(0, 32).padEnd(32, "\0")),
      info: enc.encode("epayment-transaction-v1"),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}
```

### 8.3 Transaction Encryption (Next.js BFF)

```typescript
// frontend/lib/crypto.ts
export async function encryptPayload(params: TransactionParams): Promise<EncryptedResult> {
  const enc = new TextEncoder();
  const M = JSON.stringify({
    sender_username:   params.senderUsername,
    receiver_username: params.receiverUsername,
    amount:            params.amount,
    currency:          params.currency,
    timestamp:         new Date().toISOString(),
    nonce:             params.nonce,
  });

  // Compute HMAC-SHA-256 (F1) using K1
  const k1Key = await crypto.subtle.importKey(
    "raw", enc.encode(params.k1), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const f1Buffer = await crypto.subtle.sign("HMAC", k1Key, enc.encode(M));
  const f1 = btoa(String.fromCharCode(...new Uint8Array(f1Buffer)));

  // Derive AES key
  const aesKey = await deriveAesKey(params.k2, params.sessionSecret, params.tCurrent, params.nonce);

  // Encrypt M + F1
  const iv = crypto.getRandomValues(new Uint8Array(12));   // 96-bit IV for GCM
  const plaintext = enc.encode(M + "|" + f1);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(params.senderUsername + params.tVersion) },
    aesKey,
    plaintext,
  );

  // IV (12 bytes) || ciphertext+tag (variable)
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);

  return { encryptedPayload: btoa(String.fromCharCode(...combined)) };
}
```

### 8.4 Transaction Verification (Flask)

```python
# backend/app/services/transaction_service.py
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hmac as crypto_hmac, hashes
import base64, json, hmac as stdlib_hmac, hashlib

def process(encrypted_payload: str, declared_t_version: int,
            device_id: str, sender_user_id: str,
            ip_address: str, tls_session_id: str) -> dict:

    # 1. Load sender, device, timestamp_key in one query
    sender   = User.query.get(sender_user_id)
    device   = DeviceCredential.query.filter_by(user_id=sender_user_id).first()
    ts_key   = TimestampKey.query.filter_by(user_id=sender_user_id).first()
    account  = Account.query.filter_by(user_id=sender_user_id).with_for_update().first()

    # 2. Guard: device active, account not suspended
    if not device.is_active or sender.account_status != "active":
        return _fail("account_suspended")

    # 3. Replay check: t_version must match exactly
    if ts_key.t_version != declared_t_version:
        audit_service.log(sender_user_id, "replay_detected", {"declared": declared_t_version, "expected": ts_key.t_version})
        return _fail("replay_detected")

    # 4. Recompute K1 and AES key (K2 retrieved from encrypted server session)
    k2             = _retrieve_k2_from_session(sender_user_id)
    session_secret = _retrieve_session_secret(device)
    k1             = crypto_service.derive_k1(device.activation_code_hash, sender.nid_hash, device.browser_fingerprint)
    aes_key_bytes  = crypto_service.derive_aes_key(k2, session_secret, ts_key.current_t, nonce_from_payload)

    # 5. AES-GCM decrypt
    raw = base64.b64decode(encrypted_payload)
    iv, ciphertext = raw[:12], raw[12:]
    aesgcm = AESGCM(aes_key_bytes)
    aad    = (sender.username + str(declared_t_version)).encode()
    try:
        plaintext = aesgcm.decrypt(iv, ciphertext, aad)
    except Exception:
        audit_service.log(sender_user_id, "decryption_failed", {})
        return _fail("decryption_failed")

    # 6. Parse M and F1
    plain_str   = plaintext.decode()
    M_str, f1   = plain_str.rsplit("|", 1)
    M           = json.loads(M_str)

    # 7. HMAC verify: recompute F2 = HMAC(K1, M_str)
    f2 = stdlib_hmac.new(k1, M_str.encode(), hashlib.sha256).digest()
    if not stdlib_hmac.compare_digest(base64.b64decode(f1), f2):
        audit_service.log(sender_user_id, "hmac_mismatch", {})
        return _fail("hmac_mismatch")

    # 8. Business logic checks
    amount   = Decimal(str(M["amount"]))
    receiver = User.query.filter_by(username=M["receiver_username"]).first()
    if not receiver:
        return _fail("receiver_not_found")

    # Daily limit reset check (inside atomic transaction)
    if account.daily_reset_at < date.today():
        account.daily_used     = Decimal("0.00")
        account.daily_reset_at = date.today()

    if account.balance < amount:
        return _fail("insufficient_funds")
    if account.daily_used + amount > account.daily_limit:
        return _fail("daily_limit_exceeded")

    # 9. Atomic DB transaction
    receiver_account = Account.query.filter_by(user_id=receiver.user_id).with_for_update().first()
    txn = Transaction(
        sender_id=sender.user_id, receiver_id=receiver.user_id,
        amount=amount, currency=M["currency"], status="pending",
        hmac_verified=True, t_version_used=declared_t_version,
        ip_address=ip_address, tls_session_id=tls_session_id,
        device_id=device.device_id,
    )
    db.session.add(txn)

    account.balance          -= amount
    account.daily_used       += amount
    receiver_account.balance += amount
    txn.status        = "completed"
    txn.completed_at  = datetime.now(timezone.utc)

    # 10. Update timestamp key T
    new_t = crypto_service.derive_next_t(ts_key.current_t, ts_key.t_version + 1, str(txn.transaction_id))
    ts_key.current_t      = new_t
    ts_key.t_version     += 1
    ts_key.last_updated_at = datetime.now(timezone.utc)

    db.session.commit()

    return {
        "transaction_id":  str(txn.transaction_id),
        "status":          "completed",
        "sender_new_balance": str(account.balance),
        "t_next":          new_t,
        "t_version_next":  ts_key.t_version,
        "completed_at":    txn.completed_at.isoformat(),
    }
```

### 8.5 Timestamp Key Derivation & Replay Prevention

```python
# backend/app/services/crypto_service.py
import hmac, hashlib, os

SERVER_HMAC_SECRET = os.environ["SERVER_HMAC_SECRET"].encode()

def derive_next_t(t_old: str, t_version_new: int, transaction_id: str) -> str:
    msg = t_old.encode() + str(t_version_new).encode() + hashlib.sha256(transaction_id.encode()).digest()
    return hmac.new(SERVER_HMAC_SECRET, msg, hashlib.sha256).hexdigest()

def derive_initial_t(user_id: str) -> str:
    msg = user_id.encode() + os.urandom(32)
    return hmac.new(SERVER_HMAC_SECRET, msg, hashlib.sha256).hexdigest()
```

The timestamp key T is not a wall-clock time — it is a chained HMAC value. Each T is derived from the previous T, the new version number, and the last transaction ID. This makes T unpredictable even to someone who has observed many T values, because `SERVER_HMAC_SECRET` is never exposed outside the Flask environment.

---

## 9. Logic & Methodology — TLS-Modified Version

### 9.1 Nginx TLS Configuration

TLS 1.3 is enforced at the Nginx reverse proxy. The Nginx configuration rejects TLS 1.2 and below, enforces strong cipher suites, and sets HSTS headers.

```nginx
# nginx/nginx.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/ssl/certs/fullchain.pem;
    ssl_certificate_key /etc/ssl/private/privkey.pem;

    ssl_protocols             TLSv1.3;           # TLS 1.3 ONLY — 1.2 explicitly rejected
    ssl_prefer_server_ciphers off;               # TLS 1.3 manages its own cipher selection
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;
    ssl_session_tickets       off;               # Disable tickets for perfect forward secrecy

    # HSTS: enforce HTTPS for 2 years, include subdomains
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;

    # Expose TLS session ID to Flask for audit logging
    add_header X-TLS-Session-ID $ssl_session_id always;
    proxy_set_header X-TLS-Session-ID $ssl_session_id;

    # Rate limiting: 30 requests/minute per IP to transaction endpoint
    limit_req_zone $binary_remote_addr zone=transaction:10m rate=30r/m;

    location / {
        proxy_pass http://nextjs:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /api/v1/ {
        limit_req zone=transaction burst=10 nodelay;
        proxy_pass http://flask:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}

server {
    listen 80;
    return 301 https://$host$request_uri;    # Hard redirect all HTTP to HTTPS
}
```

### 9.2 Why the Two-Layer Model Matters for a Web App

In the native mobile app (future iteration), TLS is enforced at the device level with certificate pinning — the app refuses to connect unless the server presents a specific certificate. In the web MVP, we cannot pin certificates in the browser without Service Worker tricks. Instead, we rely on:

- **HSTS preloading** — once a user has visited over HTTPS, the browser refuses to connect over HTTP for 2 years.
- **Certificate Transparency logs** — all certificates issued for our domain are publicly logged, making it detectable if a CA issues a rogue certificate for our domain.
- **Subresource Integrity (SRI)** on all CDN-loaded scripts — preventing script injection even if a CDN is compromised.

The AES-GCM application-layer encryption is critical precisely because browser TLS is not pinned: even if an attacker somehow intercepts the TLS-decrypted HTTP traffic (e.g. through a compromised corporate proxy or browser extension), the AES-GCM payload is still opaque to them. They would see the `encrypted_payload` field but cannot decrypt it without K2 + session_secret + T.

### 9.3 The Complete Two-Layer Flow (Web MVP)

```
Phase 0: TLS Handshake (Nginx ↔ Browser)
──────────────────────────────────────────
Browser → Nginx: ClientHello (TLS 1.3, cipher suites, ECDHE key share)
Nginx   → Browser: ServerHello, Certificate (signed by Let's Encrypt / CA)
Both sides derive session keys via ECDHE
[Secure TLS 1.3 tunnel established — all further traffic is encrypted at network level]

Phase 1: Login (inside TLS tunnel)
──────────────────────────────────
Browser → Next.js /api/auth: POST { username, SHA256(K2) }
Next.js → Flask /api/v1/auth/login: forward credentials
Flask   → Next.js: { session_token (JWT), t_current, t_version }
Next.js sets httpOnly cookie: access_token, refresh_token
Next.js stores t_current, t_version, k2_derived, session_secret in encrypted server session

Phase 2: Transaction Preparation (Next.js BFF server)
──────────────────────────────────────────────────────
User submits form in browser → POST /api/transaction (Next.js BFF)
Next.js BFF:
  M      = { sender, receiver, amount, currency, timestamp, nonce }
  F1     = HMAC-SHA256(K1, serialize(M))    [Web Crypto API in Node.js runtime]
  AESKey = HKDF(K2 || session_secret || T, nonce, "epayment-transaction-v1")
  (IV, ciphertext+tag) = AES-256-GCM-Encrypt(AESKey, IV, M||F1, aad=sender+t_version)
  encrypted_payload = Base64(IV || ciphertext || tag)

Phase 3: Transaction Submission (inside TLS tunnel)
────────────────────────────────────────────────────
Next.js BFF → Flask /api/v1/transaction/initiate:
  POST { encrypted_payload, t_version, device_id }
  Authorization: Bearer <JWT>
  X-TLS-Session-ID: <from Nginx header>

[TLS wraps everything — Flask receives already-TLS-decrypted bytes,
 but the encrypted_payload body is still AES-GCM encrypted]

Phase 4: Flask Verification
────────────────────────────
  a. JWT verification (PyJWT): signature, expiry, jti not blacklisted
  b. t_version replay check: must match stored t_version exactly
  c. Device active + account not suspended check
  d. Recompute K1, derive AES key
  e. AES-GCM decrypt: verify GCM auth tag (integrity check 1)
  f. Parse M and F1 from plaintext
  g. HMAC verify: F2 = HMAC(K1, M_serialized); compare_digest(F1, F2) (integrity check 2)
  h. Business logic: receiver exists, balance sufficient, daily limit not exceeded
  i. Atomic PostgreSQL transaction:
       UPDATE accounts (sender balance -, daily_used +)
       UPDATE accounts (receiver balance +)
       INSERT transaction (status=completed)
       UPDATE timestamp_keys (current_t = new_T, t_version++)
  j. db.session.commit()
  k. Return { t_next, t_version_next, new_balance, transaction_id }

Phase 5: Response (inside TLS tunnel)
──────────────────────────────────────
Flask → Next.js BFF: transaction result
Next.js BFF updates encrypted server session with t_next, t_version_next
Next.js BFF → Browser: { transaction_id, status, new_balance }
Browser updates UI
```

### 9.4 Two-Layer Encryption Structure

The payload as it travels over the wire:

```
[ TLS 1.3 Record (Nginx → Browser) ]
  ├── TLS Header
  ├── TLS-encrypted HTTP Response (session key from ECDHE)
  │     └── Body: { encrypted_payload: "...", t_version: 12 }
  │                          │
  │               [ AES-256-GCM (application layer) ]
  │                 ├── IV (12 bytes, random)
  │                 ├── Ciphertext: serialize(M) || F1
  │                 ├── GCM Auth Tag (16 bytes)
  │                 └── AAD: sender_username || t_version
  └── TLS MAC
```

Three independent barriers between an attacker and the transaction content:
1. TLS encryption (network level)
2. AES-256-GCM encryption (application level)
3. HMAC-SHA-256 authentication (message level)

### 9.5 Session Loss & Recovery (Web MVP)

If a user loses access to their browser session (clears cookies, different device):

1. User visits the login page from any browser and logs in with username + K2.
2. The server validates credentials. It then issues a new JWT and returns the current `t_current` and `t_version`.
3. The AES key derivation requires K2 + session_secret + T. K2 is provided at login. The session_secret is re-derived from `device_credentials.session_secret_hash` (the server stores the hash; the actual value is derived during login and placed in the new server session).
4. This is seamless for the user — no in-person bank visit required for a web session loss, unlike the native app scenario where device re-registration requires presence. This is a deliberate web MVP trade-off.

---

## 10. Security Threat Model & Mitigations

| Threat | Attack Vector | Mitigation in This Stack |
|---|---|---|
| Network eavesdropping | Packet capture on Wi-Fi | TLS 1.3 at Nginx; HSTS preloading |
| Server impersonation (MITM) | DNS spoofing, rogue CA | TLS cert from trusted CA; Certificate Transparency monitoring |
| XSS — token theft | Injected JS reads cookies | `httpOnly` + `Secure` + `SameSite=Strict` cookies; no tokens in localStorage |
| CSRF | Forged form submission | `SameSite=Strict` cookie; Next.js CSRF token on state-changing routes |
| Replay attack | Resend captured payload | t_version chain; T changes after every transaction |
| Message tampering | Modify encrypted_payload in transit | AES-GCM auth tag + HMAC-SHA-256 dual check |
| Brute force on K2 | Dictionary attack on login | bcrypt on login hash; rate limiting at Nginx (30 req/min/IP); account lockout after 5 failures |
| Brute force on JWT | Forge session token | HS256 with 256-bit secret; 15-minute expiry; jti blacklist in Redis |
| SQL injection | Malicious input in request | SQLAlchemy parameterized queries throughout; no raw SQL |
| Insider — bank officer | Officer reads K2 | K2 created by user in isolation during registration; officer never sees it |
| K1 server breach | DB dump | Only SHA-256(K1) stored; K1 recomputed from components at runtime |
| Browser fingerprint spoofing | Spoof fingerprint to match victim | Fingerprint check is one factor; K2 + session_secret still required |
| Session hijacking | Steal JWT from network | TLS prevents; httpOnly cookie prevents JS access; short expiry |
| Dependency supply chain | Malicious npm/pip package | `npm audit` + `pip-audit` in CI; SRI on CDN assets; lockfiles committed |
| Rate abuse | DDoS transaction endpoint | Nginx `limit_req` zone; Celery async processing; 429 responses |

---

## 11. Key Management Lifecycle

```
Registration (bank officer admin portal)
  │
  ├─ K1 = HMAC(activation_code, SHA256(NID) || SHA256(browser_fingerprint))
  │        → sent to client once, stored in encrypted server session
  │        → SHA256(K1) stored in device_credentials
  │
  ├─ K2 = user-chosen password
  │        → bcrypt hash stored for login verification
  │        → raw form stored in encrypted server session (Fernet) for AES key derivation
  │        → never stored in DB in recoverable form
  │
  ├─ session_secret = server-generated random 32 bytes
  │        → stored in encrypted server session for AES key derivation
  │        → SHA256(session_secret) stored in device_credentials
  │
  ├─ T_0 = derive_initial_t(user_id)
  │        → stored in timestamp_keys.current_t, t_version = 1
  │
  └─ TLS cert = Let's Encrypt / CA cert on server (client cert skipped in web MVP)

Per-Transaction
  ├─ AES_Key = HKDF(K2 || session_secret || T, nonce, info)
  │             → ephemeral; computed in Next.js BFF, never stored
  │
  ├─ T updated: new_T = HMAC(SERVER_HMAC_SECRET, T_old || t_version_new || SHA256(txn_id))
  │
  └─ JWT: 15-minute lifetime; refresh token 7 days; both stored httpOnly

Key Rotation & Expiry
  ├─ K2 change: user changes password → K2 in session replaced; new AES key chain starts
  │             → old T chain is preserved (T does not depend on K2 directly)
  │
  ├─ session_secret rotation: triggered on suspicious activity or user request
  │             → requires re-login; new session_secret derived
  │
  ├─ TLS server cert: auto-renewed by Certbot before expiry (Let's Encrypt 90-day cycle)
  │
  └─ K1 re-derivation: only on device re-registration (user clears all data + re-registers)
                       → requires new activation_code from bank officer
```

---

## 12. Transaction State Machine

```
                       ┌─────────────┐
       Request         │   PENDING   │
       received ──────►│             │
                       └──────┬──────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
      JWT invalid        t_version          device/account
      or expired          mismatch            suspended
           │                  │                  │
           ▼                  ▼                  ▼
      ┌─────────┐       ┌──────────┐       ┌──────────┐
      │ FAILED  │       │ REJECTED │       │ FAILED   │
      │  (auth) │       │ (replay) │       │ (access) │
      └─────────┘       └──────────┘       └──────────┘

                    [JWT + t_version + device valid]
                              │
                    AES-GCM decryption
                              │
                    ┌─────────┴──────────┐
                    │                    │
              GCM auth_tag           HMAC F1
               invalid               mismatch
                    │                    │
                    ▼                    ▼
              ┌──────────┐        ┌──────────┐
              │ REJECTED │        │ REJECTED │
              │(tampered)│        │(tampered)│
              └──────────┘        └──────────┘

                    [Crypto checks pass]
                              │
                    Business logic checks
                              │
              ┌───────────────┼───────────────┐
              │               │               │
       Receiver not     Insufficient     Daily limit
         found            funds           exceeded
              │               │               │
              ▼               ▼               ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │ FAILED  │    │ FAILED  │    │ FAILED  │
         └─────────┘    └─────────┘    └─────────┘

                    [All checks pass]
                              │
                    PostgreSQL atomic transaction
                    (with_for_update row locks)
                              │
                    db.session.commit()
                              │
                              ▼
                       ┌──────────────┐
                       │  COMPLETED   │
                       │  T updated   │
                       │  t_version++ │
                       └──────────────┘
```

---

## 13. MVP Scope & Deferred Features

### What Is In the MVP

- User registration via bank officer admin portal (Next.js admin page + Flask endpoint); **development** uses a seed script with pre-registered test users (see §13.1)
- User login with username + password, session management via httpOnly JWT cookies
- Send money by entering receiver username and amount
- Transaction history with pagination
- Balance overview dashboard
- Account suspension (self-service and bank officer)
- TLS 1.3 at Nginx
- AES-256-GCM + HMAC-SHA-256 transaction encryption
- Replay prevention via timestamp key chain
- Daily transaction limits with automatic reset
- Audit logging of all security events
- Rate limiting at Nginx
- Docker Compose local development environment
- **Seeded test data** with pre-generated cryptographic material for rapid development and demo (see §13.1)

### 13.1 Seeded Data for Development & Demo

For development, testing, and demo purposes, the system ships with a **database seed script** that populates pre-registered users with known credentials. This avoids requiring the full bank-officer registration flow every time the dev environment is reset.

#### What Gets Seeded

Each seeded user has all cryptographic material pre-computed and stored just like a real registered user — the only difference is the values are deterministic (derived from known seed values, not live input):

| Artifact | Source in Seeded Data | Stored As |
|---|---|---|
| `username` | Hardcoded per seed user (e.g. `alice`, `bob`) | `users.username` |
| `password_hash` (K2) | bcrypt of known password (e.g. `"password123"`) | Used for login verification |
| `K2` (raw) | Known per user | Encrypted in server session at login (same flow as production) |
| `browser_fingerprint` | Pre-computed SHA-256 hash of a deterministic fingerprint string | `device_credentials.browser_fingerprint` |
| `K1` | Derived deterministically from seeded `activation_code` + `nid_hash` + `browser_fingerprint` | Only `SHA-256(K1)` stored in `device_credentials.k1_hash` |
| `session_secret` | Pre-generated random 32 bytes (fixed per seed user) | `SHA-256(session_secret)` in `device_credentials.session_secret_hash` |
| `T_0` (initial timestamp key) | Derived from `derive_initial_t(user_id)` | `timestamp_keys.current_t`, `t_version = 1` |
| `balance` | Pre-set amount (e.g. 10000.00 BDT for sender, 5000.00 for receiver) | `accounts.balance` |

#### Seed Script

```bash
# backend/seeds/seed.py
# Run once after alembic upgrade head to populate dev database
poetry run python seeds/seed.py
```

The seed script (`backend/seeds/seed.py`) contains:

```python
# backend/seeds/seed.py — simplified structure
SEED_USERS = [
    {
        "username": "alice",
        "password": "alice123",        # bcrypt hashed before storage
        "full_name": "Alice Rahman",
        "nid_number": "1234567890",    # hashed before storage
        "browser_fingerprint": "seed_fp_alice_v1",  # deterministic
        "balance": "10000.00",
        "daily_limit": "5000.00",
    },
    {
        "username": "bob",
        "password": "bob456",
        "full_name": "Bob Hossain",
        "nid_number": "0987654321",
        "browser_fingerprint": "seed_fp_bob_v1",
        "balance": "5000.00",
        "daily_limit": "3000.00",
    },
]

for user_data in SEED_USERS:
    # Replicate the exact same registration logic from auth_service.register_user():
    #   1. Hash NID, hash browser_fingerprint
    #   2. Derive K1 = HMAC(activation_code, sha256(NID) || sha256(browser_fingerprint))
    #   3. Hash K1 → store in device_credentials.k1_hash
    #   4. Generate session_secret → store SHA-256 in device_credentials
    #   5. Generate initial T → store in timestamp_keys
    #   6. Create user, account, device_credential, timestamp_key rows
    #   7. bcrypt-hash password for auth verification
```

The seed script calls the **same `auth_service.register_user()` function** used by the registration endpoint — not a separate code path. This guarantees that seeded users are structurally identical to real registered users.

#### Login Flow With Seeded Data

```
1. User navigates to /login
2. Enters seeded username (e.g. "alice") and seeded password (e.g. "alice123")
3. Next.js BFF sends { username, SHA256(password) } → Flask /api/v1/auth/login
4. Flask verifies bcrypt(password_hash) against stored hash
5. On success: returns JWT + t_current + t_version
6. Next.js stores K2, session_secret, t_current, t_version in encrypted server session
7. User is now authenticated and can send payments — exactly the same as production flow
```

#### Demo Transaction Scenario

The seeded data is designed to demonstrate a complete payment cycle:

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as `alice` | Dashboard shows balance: 10,000.00 BDT |
| 2 | Send 500.00 BDT to `bob` | Transaction completes; Alice balance: 9,500.00 |
| 3 | Login as `bob` (separate browser/session) | Dashboard shows balance: 5,500.00 BDT |
| 4 | Both see the transaction in history | Status: completed, with timestamps |

#### Development-Only Scope

- The seed script runs **only** in development/demo environments. Production databases must go through the bank-officer registration flow (see §8.1).
- Seed data is **never committed to production** — the `SEED_USERS` list is excluded from Docker images via `.dockerignore`.
- The seed script is idempotent: running it multiple times skips already-seeded users (checks by `username`).

### What Is Intentionally Deferred (Post-MVP)

| Feature | MVP substitute | Production plan |
|---|---|---|
| Biometric fingerprint (Bp) | Session-bound secret | Native app with WebAuthn / device secure enclave |
| MAC address device binding | Browser fingerprint | Native app with hardware-bound device ID |
| mTLS client certificates | No client cert in browser | Native app with device cert in secure enclave |
| Certificate pinning | HSTS + CT monitoring | Native app with pinned cert hash |
| Offline transaction queue | Not supported | Native app with signed offline queue flushed on reconnect |
| Multi-device support | One session at a time | Native app with per-device key derivation |
| Push notifications | Email only | FCM/APNs in native app |
| QR code payments | Manual username entry | Native app camera scan |
| NFC tap-to-pay | Not applicable (web) | Native app with NFC chip access |

---

*Document version 2.1 — MVP Web (Next.js + Flask) with TLS 1.3 extension*
*Stack: Next.js 14 · TypeScript · Tailwind CSS · Python 3.12 · Flask · Supabase (managed PostgreSQL 16) · SQLAlchemy 2.0 · Alembic · Redis · Celery · Nginx · Docker*
*Database: Supabase is used as a managed Postgres provider only — direct connection (port 5432), no PgBouncer, no Supabase Auth/Edge Functions/RLS*
*Development: Seeded test users with pre-computed cryptographic material (browser fingerprints, K1/K2 keys, timestamp keys) for rapid iteration*
*All cryptographic operations use Web Crypto API (frontend) and Python `cryptography` library (backend) — no hand-rolled crypto*
