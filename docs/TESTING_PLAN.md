# E-Payment System — Security Testing Plan

> **Objective:** Validate all security layers (cryptographic, network, application) against real attack vectors.
> **Scope:** MVP Web Application (Next.js BFF + Flask API + Nginx + PostgreSQL + Redis)
> **Framework:** ICECTE 2022 dual-layer (TLS 1.3 + AES-256-GCM + HMAC-SHA256)

---

## Test Philosophy

The system has **four independent security layers**. A test is passed if:

| Layer | What It Protects | Attack Example |
|-------|-----------------|----------------|
| 1. Transport (TLS 1.3) | Network eavesdropping, MITM, certificate spoofing | Packet capture, TLS stripping |
| 2. Confidentiality (AES-256-GCM) | Payload secrecy even if TLS stripped | Encrypted payload decryption |
| 3. Integrity (HMAC-SHA256 + GCM auth tag) | Message tampering, replay | Bit flipping, replay |
| 4. Authentication (JWT + bcrypt + CSRF) | Session hijacking, forgery | Token theft, brute force |

**A single layer failure is acceptable** if another layer blocks the attack.  
**Two or more layer failures = security gap.**

---

## Testing Phases

### Phase 1 — Application-Layer Tests (No Sandbox)
*Target: localhost:5000 (Flask API) and localhost:3000 (Next.js BFF)*
*Environment: Direct HTTP to Flask API (bypassing Nginx), simulating internal network access*

| # | Test | Attack Vector | Expected Defense |
|---|------|---------------|------------------|
| 1.1 | **Health Check** | — | Backend responds 200 |
| 1.2 | **Valid Login** | — | Returns JWT + session data |
| 1.3 | **Invalid Login** | Wrong password | 401 invalid_credentials |
| 1.4 | **Replay Attack** | Send same encrypted payload twice | 2nd request fails: `replay_detected` |
| 1.5 | **Payload Tampering** | Flip bits in base64 encrypted_payload | `decryption_failed` or `hmac_mismatch` |
| 1.6 | **Missing JWT** | No Authorization header | 401 missing_token |
| 1.7 | **Expired JWT** | Use expired token | 401 token_expired |
| 1.8 | **Malformed JWT** | Garbage token | 401 invalid_token |
| 1.9 | **JWT Algorithm Confusion** | Set alg to `none` | 401 invalid_token |
| 1.10 | **Rate Limiting (Login)** | 15 rapid login attempts | 429 after ~10 attempts |
| 1.11 | **SQL Injection (Login)** | SQL in username/password fields | 401 invalid_credentials (no SQL error) |
| 1.12 | **SQL Injection (Transaction)** | SQL in receiver_username | 400 receiver_not_found |
| 1.13 | **Insufficient Funds** | Send more than balance | `insufficient_funds` |
| 1.14 | **Daily Limit Exceeded** | Send more than daily limit | `daily_limit_exceeded` |
| 1.15 | **Double-Spend Race** | Two concurrent txs exceeding balance | One succeeds, one fails |
| 1.16 | **Account Suspension** | Suspend → try to transact | `account_suspended` |
| 1.17 | **CSRF Bypass** | State-changing request without CSRF | Depends on BFF implementation |
| 1.18 | **Missing Required Fields** | Omit encrypted_payload / nonce | 400 missing_fields |
| 1.19 | **Negative Amount** | Send negative value | Check: `amount > 0` constraint |
| 1.20 | **Self-Transaction** | Send money to self | Business logic: should fail or succeed? |

### Phase 2 — Transport & Network-Layer Tests (Sandbox Required)
*Target: Docker Compose full stack behind Nginx*
*Environment: Docker sandbox, mitmproxy, Wireshark*

| # | Test | Attack Vector | Expected Defense |
|---|------|---------------|------------------|
| 2.1 | **TLS Stripping** | Force HTTP instead of HTTPS | Nginx 301 redirects to HTTPS; HSTS preload |
| 2.2 | **Packet Capture** | Wireshark sniffing | All traffic encrypted under TLS 1.3 |
| 2.3 | **Certificate Spoofing** | Fake CA certificate via mitmproxy | Browser warning; AES layer still protects payload |
| 2.4 | **Port Scanning** | nmap service discovery | Only ports 80/443 exposed |
| 2.5 | **DNS Spoofing** | Fake DNS to attacker IP | TLS cert warning; AES payload still encrypted |
| 2.6 | **HSTS Validation** | Check HSTS header presence | `Strict-Transport-Security: max-age=63072000` |
| 2.7 | **Security Headers** | Check response headers | CSP, XFO, XCTO, RP, Permissions-Policy present |
| 2.8 | **TLS Version Check** | Attempt TLS 1.2 handshake | Nginx rejects, TLS 1.3 only |
| 2.9 | **Weak Cipher Check** | Attempt weak ciphers | Nginx rejects (TLS 1.3 manages cipher selection) |

### Phase 3 — Advanced Attack Simulation (Sandbox + Custom Scripts)
*Target: Full stack behind Nginx with test database*

| # | Test | Attack Vector | Expected Defense |
|---|------|---------------|------------------|
| 3.1 | **Race Condition (Concurrent Double-Spend)** | 10 concurrent requests | FOR UPDATE lock: exactly 1 succeeds |
| 3.2 | **Timing Side-Channel (Password)** | Measure bcrypt response times | Constant-time compare, no variation |
| 3.3 | **JWT jti Blacklist** | Logout → reuse token | 401 token_revoked |
| 3.4 | **User Blacklist (Suspension)** | Suspend → reuse JWT | 403 account_suspended |
| 3.5 | **Redis Key Expiry** | Check rate limiter keys expire | Keys auto-expire after TTL |
| 3.6 | **AES-GCM Nonce Reuse** | Force same IV/nonce across txs | Random IV (12 bytes) per tx, nonce changes |
| 3.7 | **T Chain Predictability** | Probe T chain for patterns | HMAC-SHA256 with secret key, unpredictable |

---

## Attack Methodology

### Replay Attack
```
1. Login as alice
2. Initiate a valid transaction (capture encrypted_payload)
3. Resend the exact same encrypted_payload, t_version, device_id
4. Expected: 2nd request returns "replay_detected"
5. T version has incremented — stale version is rejected
```

### Payload Tampering
```
1. Login as alice
2. Capture a valid encrypted_payload (base64 string)
3. Modify 1-2 characters in the base64 string
4. Resend with same t_version
5. Expected: AES-GCM decryption fails (auth tag mismatch) → "decryption_failed"
```

### JWT Forgery
```
1. Try request without Authorization header → "missing_token"
2. Try with "Bearer invalid-token" → "invalid_token"
3. Try with expired token → "token_expired"
4. Try with alg:"none" JWT → "invalid_token"
```

### Rate Limiting
```
1. Send 15 POST /api/v1/auth/login requests rapidly with wrong password
2. Count the number of 429 responses
3. Expected: ~5 responses succeed (rate limit window), rest return 429
```

### SQL Injection
```
1. Login payload: {"username": "alice' OR '1'='1", "password": "' OR '1'='1"}
2. Expected: 401 invalid_credentials (parametrized query blocks injection)
3. Transaction payload: {"receiver_username": "bob'; DROP TABLE users;--", ...}
4. Expected: 400 receiver_not_found
```

### Double-Spend Race
```
1. Login as alice (balance: 10000)
2. Fire two concurrent transactions of 6000 BDT to bob
3. Only one should succeed (balance 10000 - 6000 = 4000)
4. Second should fail with "insufficient_funds"
```

### Account Suspension
```
1. Login as alice, get JWT
2. Call /api/v1/account/suspend
3. Try to initiate transaction with same JWT
4. Expected: 403 account_suspended
```

---

## Tools Required

| Tool | Phase | Purpose |
|------|-------|---------|
| **curl** (or PowerShell) | 1, 2 | HTTP request crafting |
| **Burp Suite Community** | 2 | Intercept/modify/replay, proxy traffic |
| **mitmproxy** | 2 | TLS stripping, certificate spoofing |
| **Wireshark** | 2 | Packet capture and analysis |
| **nmap** | 2 | Port scanning |
| **Python (asyncio/aiohttp)** | 1, 3 | Race condition testing |
| **openssl** | 2 | TLS version/cipher testing |
| **Docker + Docker Compose** | 2 | Sandbox environment |

---

## Environment Setup

### Phase 1 (No Sandbox)
- Backend: `http://localhost:5000` (Flask dev server)
- Frontend: `http://localhost:3000` (Next.js dev server)
- Database: Supabase PostgreSQL (direct connection)
- Redis: Not required (in-memory fallback active)

### Phase 2 (Docker Sandbox)
```bash
# Build and run full stack behind Nginx
docker-compose up --build -d

# Nginx: https://localhost (TLS 1.3, self-signed cert)
# Backend: internal Docker network (not publicly exposed)
# Frontend: internal Docker network (not publicly exposed)
```

---

## Success Criteria

| Category | Must Pass | Should Pass |
|----------|-----------|-------------|
| **Replay Protection** | T chain blocks duplicate payloads | Audit log records the attempt |
| **Integrity** | Any bit flip breaks decryption or HMAC | GCM auth tag + HMAC dual check |
| **Authentication** | Invalid/missing/expired JWT rejected | jti blacklist works |
| **Rate Limiting** | 429 returned after threshold | Redis-backed, shared across workers |
| **SQL Injection** | All queries parameterized | No raw SQL anywhere |
| **Concurrency** | FOR UPDATE prevents double-spend | Atomic transaction with rollback |
| **TLS** | TLS 1.3 only, HSTS, security headers present | Certificate validation works |
| **Transport Security** | AEAD encryption | AES-256-GCM with HKDF |

---

## Risk Ratings

| Severity | Description | Action |
|----------|-------------|--------|
| **CRITICAL** | bypasses authentication, enables double-spend, leaks secrets | Must fix before production |
| **HIGH** | weakens crypto, enables replay, enables rate abuse | Must fix before production |
| **MEDIUM** | info leak, missing hardening headers, weak config defaults | Fix within 1 sprint |
| **LOW** | logging gaps, missing rate limit on non-critical endpoints | Fix when convenient |

---

*Document version 1.0 — June 2026*
*Based on OWASP Testing Guide v4 + ICECTE 2022 framework threat model*
