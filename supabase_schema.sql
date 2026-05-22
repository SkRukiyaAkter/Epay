-- ============================================================
-- E-Payment System — PostgreSQL Schema
-- Target: Supabase (managed PostgreSQL 16, direct connection)
-- Generated from: schema.dbml
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE account_status AS ENUM ('active', 'suspended', 'locked', 'pending');

CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'rejected');

-- ============================================================
-- 1. USERS
-- Core identity and account status.
-- Raw NID/BRC numbers are never stored — only SHA-256 hash.
-- ============================================================

CREATE TABLE users (
    user_id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    username         VARCHAR(64)     UNIQUE NOT NULL,
    full_name        VARCHAR(255)    NOT NULL,
    nid_hash         VARCHAR(128)    UNIQUE NOT NULL,
    email            VARCHAR(255),
    account_status   account_status  NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. ACCOUNTS
-- Financial balances and daily limits.
-- Separated from users so DB roles can restrict financial data
-- access independently from identity data.
-- Relationship: 1:1 with users (enforced by UNIQUE on user_id).
-- ============================================================

CREATE TABLE accounts (
    account_id       UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID            UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    balance          NUMERIC(15, 2)  NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    daily_limit      NUMERIC(15, 2)  NOT NULL DEFAULT 5000.00,
    daily_used       NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
    daily_reset_at   DATE            NOT NULL DEFAULT CURRENT_DATE,
    currency         VARCHAR(3)      NOT NULL DEFAULT 'BDT',
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. DEVICE CREDENTIALS
-- Cryptographic credentials tied to a specific registered
-- device/browser session. In the web MVP, "device" refers to
-- the browser + machine combination identified at registration.
-- Relationship: 1:1 with users.
-- ============================================================

CREATE TABLE device_credentials (
    device_id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID            UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    browser_fingerprint    VARCHAR(128)    NOT NULL,
    k1_hash                VARCHAR(128)    NOT NULL,
    session_secret_hash    VARCHAR(128)    NOT NULL,
    activation_code_hash   VARCHAR(128)    NOT NULL,
    tls_client_cert_pem    TEXT,
    tls_cert_serial        VARCHAR(128),
    tls_cert_expires_at    TIMESTAMPTZ,
    app_version            VARCHAR(32),
    is_active              BOOLEAN         NOT NULL DEFAULT true,
    registered_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    last_used_at           TIMESTAMPTZ
);

-- ============================================================
-- 4. TIMESTAMP KEYS
-- Anti-replay state. After every successful transaction,
-- current_t and t_version are updated atomically with the
-- balance changes. A replayed message carries a stale
-- t_version and is rejected before any other processing.
-- Relationship: 1:1 with users.
-- ============================================================

CREATE TABLE timestamp_keys (
    ts_key_id        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID            UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    current_t        VARCHAR(256)    NOT NULL,
    t_version        BIGINT          NOT NULL DEFAULT 1,
    last_updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. TRANSACTIONS
-- Immutable financial ledger. Records are never updated or
-- deleted — they are the ground truth of all value movements.
-- The status field is the only column that changes after
-- initial insert, and only within the atomic DB transaction
-- that also modifies balances.
-- ============================================================

CREATE TABLE transactions (
    transaction_id   UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id        UUID                NOT NULL REFERENCES users(user_id),
    receiver_id      UUID                NOT NULL REFERENCES users(user_id),
    amount           NUMERIC(15, 2)      NOT NULL CHECK (amount > 0),
    currency         VARCHAR(3)          NOT NULL DEFAULT 'BDT',
    status           transaction_status  NOT NULL DEFAULT 'pending',
    failure_reason   TEXT,
    hmac_verified    BOOLEAN             NOT NULL DEFAULT false,
    t_version_used   BIGINT              NOT NULL,
    initiated_at     TIMESTAMPTZ         NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ,
    tls_session_id   VARCHAR(128),
    ip_address       INET,
    device_id        UUID                REFERENCES device_credentials(device_id)
);

-- ============================================================
-- 6. AUDIT LOG
-- Append-only log of every security-relevant event.
-- Written to on every auth failure, HMAC mismatch, replay
-- detection, account status change, and suspicious pattern.
-- ============================================================

CREATE TABLE audit_log (
    log_id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID            REFERENCES users(user_id),
    device_id      UUID            REFERENCES device_credentials(device_id),
    event_type     VARCHAR(64)     NOT NULL,
    event_detail   JSONB,
    ip_address     INET,
    tls_session_id VARCHAR(128),
    occurred_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at DESC);

-- ============================================================
-- 7. TLS CERTIFICATES
-- Tracks issued mTLS client certificates.
-- Not used in the web MVP (no client cert in a browser context)
-- but schema is included so the production upgrade path
-- requires no migration rework.
-- ============================================================

CREATE TABLE tls_certificates (
    cert_id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id         UUID            NOT NULL REFERENCES device_credentials(device_id) ON DELETE CASCADE,
    serial_number     VARCHAR(128)    UNIQUE NOT NULL,
    issued_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ     NOT NULL,
    revoked           BOOLEAN         NOT NULL DEFAULT false,
    revoked_at        TIMESTAMPTZ,
    revocation_reason VARCHAR(128)
);
