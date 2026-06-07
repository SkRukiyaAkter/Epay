# Security Audit Report — E-Payment System
> Generated: June 2026  
> Based on: *"E-Payment System to Reduce Use of Paper Money for Daily Transactions"* (ICECTE 2022)  
> Extended with TLS 1.3 for production-grade security

---

## Paper Framework vs Implementation Comparison

| Paper Concept | Original (Paper) | Web MVP Adaptation | Status |
|---|---|---|---|
| K1 derivation | HMAC(activation_code, NID \|\| MAC \|\| BP) | HMAC(activation_code, NID \|\| browser_fingerprint) | ✅ Done |
| K2 (password) | User-chosen, used for AES key | bcrypt hashed, Fernet-encrypted | ✅ Done |
| Biometric (BP) | Fingerprint sensor | session_secret (random 32B) | ✅ Done (MVP trade-off) |
| MAC address | Phone hardware ID | Browser fingerprint (server-generated) | ✅ Done (MVP trade-off) |
| AES encryption | AES + K2 + BP + T | AES-256-GCM + K2 + session_secret + T | ✅ Done |
| HMAC authenticity | HMAC-SHA256(K1, M) | HMAC-SHA256(K1, M) | ✅ Done |
| Timestamp T chain | Updated after each tx | HMAC-chained T, versioned | ✅ Done |
| TLS 1.3 | Not in paper (added later) | Implemented at Nginx | ✅ Done |

---

## CRITICAL Findings (5) — All Resolved

### C1 — SHA-256 used as password hash (no salt, no iterations) ✅ RESOLVED
- **Fix Applied:** Replaced with bcrypt (12 rounds, salted) in `auth_service.py`
- **File:** `backend/app/services/auth_service.py`

### C2 — Client-side hash becomes authentication credential (pass-the-hash) ✅ RESOLVED
- **Fix Applied:** Removed client-side hashing; raw password sent over TLS, bcrypt on server
- **Files:** `frontend/app/api/auth/login/route.ts`, `backend/app/services/auth_service.py`

### C3 — No TLS/SSL configured on Nginx ✅ RESOLVED
- **Fix Applied:** Added `listen 443 ssl;` block with self-signed cert, HSTS, CSP headers
- **File:** `nginx/nginx.conf`

### C4 — Browser fingerprint entirely client-supplied and spoofable ✅ RESOLVED
- **Fix Applied:** Fingerprint generated server-side from `User-Agent` + `Accept-Language` headers
- **File:** `backend/app/routes/auth.py`

### C5 — Weak/hardcoded session secret ✅ RESOLVED
- **Fix Applied:** Replaced with 32-byte cryptographically random hex via `os.urandom`
- **File:** `frontend/.env.local`

---

## HIGH Findings (6) — All Resolved

| # | Issue | Fix | Status |
|---|---|---|---|
| H1 | Non-constant-time password string comparison | bcrypt.checkpw() is constant-time by design | ✅ |
| H2 | Rate limiter uses in-memory dict, not shared across workers | Redis-backed with sorted sets; in-memory fallback | ✅ |
| H3 | Race condition on TimestampKey — possible double-spend | TimestampKey row locked with FOR UPDATE | ✅ |
| H4 | Dead code `verify_payload` with hardcoded nonce | Deleted unused function | ✅ |
| H5 | Weak fallback defaults in config | Crashes on missing env vars with clear error | ✅ |
| H6 | No CSRF token on state-changing endpoints | CSRF cookie + X-CSRF-Token header validation | ✅ |

---

## MEDIUM Findings (13)

- M1: Session `secure` flag conditional (no TLS means always false)
- M2: In-memory JWT blacklist not shared across Gunicorn workers
- M3: Password stored as recoverable k2 (Fernet-encrypted)
- M4: k2_raw and session_secret_raw returned in login response
- M5: `derive_k1` parameter naming misleading
- M6: No server-side amount validation in BFF endpoint
- M7: No per-transaction maximum cap
- M8: No idempotency key for transactions
- M9: No rate limit on registration endpoint
- M10: No account-level brute force lockout
- M11: Missing CSP header in nginx
- M12: TLS client cert infrastructure unimplemented (stub)
- M13: Rate limiter stale entries never cleaned

---

## LOW Findings (15)

- L1: 7-day session timeout too long for payment app
- L2: No `aud`/`iss` claims in JWT
- L3: Port mismatch: dev 5001 vs container 5000
- L4: `request.get_json(force=True)` on login
- L5: No CORS in Flask
- L6: Self-suspend lacks re-authentication
- L7: No username character restriction
- L8: Backend container runs as root
- L9: `X-TLS-Session-ID` dead code without TLS
- L10: Missing `Permissions-Policy`, COOP, COEP, CORP headers
- L11: No rate limit on health endpoint
- L12: Middleware checks cookie existence only
- L13: Health endpoint exposes DB/Redis status publicly
- L14: Double-hashing in K1 derivation (wasteful)
- L15: Nonce/salt terminology confusion

---

## Network Security: Planned vs Actual

| Planned Measure (Section 9, Overview) | Status |
|---|---|
| TLS 1.3 at Nginx (`listen 443 ssl`) | ✅ DONE |
| `ssl_protocols TLSv1.3` | ✅ DONE |
| `ssl_certificate` + self-signed (dev) | ✅ DONE |
| HSTS (`max-age=63072000`) | ✅ DONE |
| `ssl_session_tickets off` (PFS) | ✅ DONE |
| Content-Security-Policy header | ✅ DONE |
| `X-Frame-Options DENY` | ✅ PRESENT |
| `X-Content-Type-Options nosniff` | ✅ PRESENT |
| `X-XSS-Protection` | ✅ DONE |
| `Referrer-Policy` | ✅ PRESENT |
| `Permissions-Policy` | ✅ DONE |
| Rate limiting zones (`limit_req`) | ✅ PRESENT |
| Proxy headers (X-Real-IP, X-Forwarded-For) | ✅ PRESENT |
| Backend not publicly exposed | ✅ PRESENT |
| Two-layer encryption (TLS + AES-GCM) | ✅ DONE |

---

## Correçtly Implemented Defenses

1. Iron-session encrypted cookies (httpOnly, SameSite=Strict)
2. Short-lived JWTs (15 min) with JTI revocation
3. JWT algorithm pinned to HS256
4. Token blacklisting via Redis with in-memory fallback
5. Officer API key for registration (256-bit)
6. All sensitive endpoints have `@require_jwt`
7. Post-auth user status revalidation
8. t_version replay prevention with T chain rotation
9. Row-level locking on account balances
10. AES-256-GCM with random IVs + AAD binding
11. HMAC-SHA256 integrity on transaction payloads
12. All queries via SQLAlchemy ORM (no raw SQL)
13. Security headers: XFO, XCTO, XSSP, Referrer-Policy
14. Layered rate limiting (Nginx + app)
15. Service isolation (backend/Redis internal only)
16. Audit logging for all security events
17. UUID-based identifiers throughout
18. Decimal type for monetary amounts
19. `.env` in `.gitignore`
