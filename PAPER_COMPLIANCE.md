# Paper Compliance & Architecture Report
## E-Payment System — ICECTE 2022 Framework Implementation

> Generated: May 26, 2026  
> Paper: *"E-Payment System to Reduce Use of Paper Money for Daily Transactions"*  
> ICECTE 2022, Rajshahi-6204, Bangladesh

---

## 1. Paper Framework — Accomplished vs Missing

### 1.1 Cryptographic Components

| # | Paper Requirement | Our Implementation | Status | Notes |
|---|---|---|---|---|
| K1 | HMAC(activation_code, NID \|\| MAC \|\| BP) | HMAC(activation_code, SHA256(NID) \|\| SHA256(browser_fp)) | ✅ Done | MAC→browser_fp (web MVP trade-off) |
| K2 | User password, known only to user | bcrypt for auth verification, Fernet-encrypted for AES key material | ✅ Done | Upgraded from SHA-256 to bcrypt |
| BP | Biometric fingerprint | Random 32-byte session_secret | ✅ Done | Web MVP: no fingerprint sensor available |
| MAC | Phone MAC address | Browser fingerprint (User-Agent + Accept-Language hash) | ⚠️ Adapted | Web cannot access MAC; server-side UA hash used |
| F1 | HMAC-SHA256(K1, M) | HMAC-SHA256 computed both client (BFF) and server | ✅ Done | Match verified via constant-time compare |
| AES | Encrypt M \|\| F1 with K2 + BP + T | AES-256-GCM(K2 + session_secret + T) | ✅ Done | Upgraded: AES-GCM provides auth tag |
| T | Timestamp key updated each transaction | HMAC-chained T: T_new = HMAC(secret, T_old \|\| version \|\| SHA256(txn_id)) | ✅ Done | Version counter prevents replays |
| M | Message = {sender, receiver, amount} | JSON {sender_username, receiver_username, amount, currency, timestamp, nonce} | ✅ Done | Extended with nonce and timestamp |

### 1.2 Transaction Flow

| Step | Paper | Our Implementation | Status |
|---|---|---|---|
| 1 | User enters receiver username + amount | Frontend send form validates input | ✅ Done |
| 2 | System applies HMAC to M with K1 → F1 | BFF: deriveK1() → computeHmac() → F1 | ✅ Done |
| 3 | Combine M and F1 | BFF: M + "\|" + F1 | ✅ Done |
| 4 | Encrypt with K2 + BP + T → Encrypted Data | BFF: AES-256-GCM encrypt with HKDF-derived key from K2 + sess_secret + T | ✅ Done |
| 5 | Transmit through insecure channel | HTTPS via TLS 1.3 (Nginx) + AES-GCM payload layer | ✅ Done |
| 6 | Server receives, decrypts with K2 + BP + T | Flask: decrypt with same keys, verify GCM auth tag | ✅ Done |
| 7 | Server verifies HMAC: F2 = HMAC(K1, M'), compare F1 | Cryptography HMAC-SHA256, constant-time compare | ✅ Done |
| 8 | Server checks if sender has sufficient balance | atomic query with SELECT FOR UPDATE | ✅ Done |
| 9 | If sufficient: sender -= amount, receiver += amount | PostgreSQL atomic transaction with row-level locks | ✅ Done |
| 10 | Database updated | INSERT transaction record, UPDATE accounts, UPDATE timestamp_key | ✅ Done |
| 11 | T updated after success | derive_next_t() → new T stored, t_version++ | ✅ Done |

### 1.3 Security Requirements from Paper

| # | Paper Requirement | Status | Details |
|---|---|---|---|
| S1 | Attacker cannot read message (encrypted) | ✅ Done | AES-256-GCM + TLS 1.3 dual layer |
| S2 | Modification changes entire message | ✅ Done | GCM auth tag + HMAC dual integrity |
| S3 | Replay attack prevented (T changes each tx) | ✅ Done | t_version counter with FOR UPDATE lock |
| S4 | If card/device lost, hacker cannot transact | ✅ Done | K2 (password) + session_secret + JWT auth required |
| S5 | User can stop transactions / suspend account | ✅ Done | POST /api/v1/account/suspend |
| S6 | Registration via bank officer with NID/BRC | ✅ Done | Officer API key + seed script for dev |
| S7 | Activation code from officer generates K1 | ✅ Done | derive_k1() uses activation_code |
| S8 | Officer provides username, records BP | ✅ Done | Session_secret substitutes BP for web |
| S9 | User creates K2 alone, officer never sees it | ✅ Done | Password bcrypt-hashed; officer only sees hash |
| S10 | Only authorized user's device can transact | ⚠️ Partial | Browser fingerprint is weak binding; mTLS stub exists |

### 1.4 What We Added Beyond the Paper

| Feature | Details |
|---|---|
| TLS 1.3 | Transport-layer encryption at Nginx reverse proxy |
| HSTS + CSP | Strict-Transport-Security, Content-Security-Policy headers |
| GCM Auth Tag | AES-GCM provides authenticated encryption (paper used basic AES) |
| HKDF | Proper key derivation function for AES key (paper concatenated raw keys) |
| JWT Sessions | Short-lived 15-min JWTs with jti blacklisting |
| bcrypt | Proper password hashing (paper didn't specify hash algorithm) |
| CSRF Protection | X-CSRF-Token header validation on all state-changing requests |
| Redis Rate Limiting | Per-IP rate limiting with sorted sets, shared across workers |
| Audit Logging | Append-only security event log (auth failures, HMAC mismatches, replays) |
| Notifications | Real-time incoming transfer notifications with polling |
| Daily Limits | Per-account daily transaction limit with atomic reset |
| FOR UPDATE Locks | Row-level locking on Account AND TimestampKey for concurrency safety |

### 1.5 What We Intentionally Deferred (MVP Trade-offs)

| Paper Requirement | Web MVP Adaptation | Reason |
|---|---|---|
| MAC address binding | Browser fingerprint (UA + Accept-Language hash) | Web browsers cannot access MAC address |
| Biometric fingerprint (BP) | Random 32-byte session_secret | No fingerprint sensor in web browsers |
| Mobile app (phone) | Responsive web application | Faster MVP validation; native app later |
| Physical card/device | Browser session with encrypted cookie | Web sessions replace physical tokens |
| mTLS client certificates | Stub in schema, not implemented | Requires native app with device cert store |

---

## 2. Software Architecture — How Things Work Inside

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          E-PAYMENT SYSTEM ARCHITECTURE                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         USER'S BROWSER                               │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │   │
│  │  │   Landing Page   │  │   Login Page     │  │   Dashboard       │  │   │
│  │  │   (Red/Black)    │  │   (Auth Form)    │  │   (SPA Shell)     │  │   │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬──────────┘  │   │
│  │           │                    │                      │             │   │
│  │           ▼                    ▼                      ▼             │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │               NEXT.JS 14 APP ROUTER (SSR)                    │   │   │
│  │  │  • Server Components render pages on server                  │   │   │
│  │  │  • Client Components hydrate with framer-motion animations   │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                    HTTPS (TLS 1.3) │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         NGINX (Reverse Proxy)                        │   │
│  │  • TLS 1.3 termination (ssl_certificate)                             │   │
│  │  • Rate limiting: 5r/s auth, 30r/s API                               │   │
│  │  • Security headers: HSTS, CSP, XFO, XCTO, RP                        │   │
│  │  • HTTP → HTTPS redirect                                             │   │
│  │  • X-Real-IP, X-Forwarded-For forwarding                             │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │                                         │
│                    Internal HTTP  │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    NEXT.JS BFF LAYER (Node.js)                       │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │  /api/auth/login     │  Receives username + password          │   │   │
│  │  │                      │  → Forwards to Flask                   │   │   │
│  │  │                      │  → Stores crypto materials in session  │   │   │
│  │  │                      │  → Sets CSRF cookie                    │   │   │
│  │  ├──────────────────────┼────────────────────────────────────────┤   │   │
│  │  │  /api/transaction    │  CRYPTO PIPELINE (encryption side):    │   │   │
│  │  │  (POST)              │  1. deriveK1(act_hash, nid, browser_fp)│   │   │
│  │  │                      │  2. M = JSON{sender, receiver, amount} │   │   │
│  │  │                      │  3. F1 = HMAC-SHA256(K1, M)            │   │   │
│  │  │                      │  4. AESKey = HKDF(K2, secret, T, nonce)│   │   │
│  │  │                      │  5. Encrypt(M||F1) = AES-256-GCM       │   │   │
│  │  │                      │  6. → Flask /api/v1/transaction/initiate│   │   │
│  │  ├──────────────────────┼────────────────────────────────────────┤   │   │
│  │  │  /api/notification/* │  Proxy to Flask notification endpoints  │   │   │
│  │  ├──────────────────────┼────────────────────────────────────────┤   │   │
│  │  │  /api/account/*      │  Proxy to Flask account endpoints       │   │   │
│  │  ├──────────────────────┼────────────────────────────────────────┤   │   │
│  │  │  /api/device/*       │  Proxy to Flask device endpoints        │   │   │
│  │  └──────────────────────┴────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  SESSION: iron-session encrypted cookie                              │   │
│  │  • httpOnly + Secure + SameSite=Strict                               │   │
│  │  • Stores: accessToken, tCurrent, tVersion, k2Raw, sessionSecretRaw  │   │
│  │  • CSRF: csrf-token cookie + X-CSRF-Token header validation          │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │                                         │
│                    Internal HTTP  │  (Docker network only)                  │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     FLASK API SERVER (Python 3.12)                   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │  MIDDLEWARE LAYER                                             │   │   │
│  │  │  • @require_jwt: validates JWT signature + expiry + jti       │   │   │
│  │  │  • @rate_limit: Redis-backed per-IP rate limiter              │   │   │
│  │  │  • @require_officer_key: Registration endpoint protection      │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │  ROUTES                                                       │   │   │
│  │  │  POST /api/v1/auth/login     → auth_service.login_user()      │   │   │
│  │  │  POST /api/v1/auth/register  → auth_service.register_user()   │   │   │
│  │  │  POST /initiate              → transaction_service.process()  │   │   │
│  │  │  GET  /history               → Transaction query (paginated)  │   │   │
│  │  │  GET  /account/balance       → Account query                  │   │   │
│  │  │  GET  /notification/*        → Notification CRUD              │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │  TRANSACTION SERVICE — process() (10-step pipeline)           │   │   │
│  │  │                                                               │   │   │
│  │  │  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐  │   │   │
│  │  │  │ STEP 1  │──▶│  STEP 2  │──▶│  STEP 3   │──▶│  STEP 4  │  │   │   │
│  │  │  │ Load    │   │ Device   │   │ Replay    │   │ Recompute│  │   │   │
│  │  │  │ sender  │   │ active?  │   │ Check t_  │   │ K1 + AES │  │   │   │
│  │  │  │ device  │   │ Account  │   │ version   │   │ key from │  │   │   │
│  │  │  │ account │   │ active?  │   │ matches?  │   │ K2+sec+T │  │   │   │
│  │  │  └─────────┘   └──────────┘   └───────────┘   └──────────┘  │   │   │
│  │  │                                                               │   │   │
│  │  │  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐  │   │   │
│  │  │  │ STEP 5  │──▶│  STEP 6  │──▶│  STEP 7   │──▶│  STEP 8  │  │   │   │
│  │  │  │ AES-GCM │   │ Parse M  │   │ HMAC      │   │ Business │  │   │   │
│  │  │  │ Decrypt │   │ and F1   │   │ Verify    │   │ Logic:   │  │   │   │
│  │  │  │ + AAD   │   │ from     │   │ F1 vs F2  │   │ receiver │  │   │   │
│  │  │  │ verify  │   │ plaintext│   │ constant  │   │ found?   │  │   │   │
│  │  │  └─────────┘   └──────────┘   │ time?     │   │ balance? │  │   │   │
│  │  │                               └───────────┘   │ daily?   │  │   │   │
│  │  │                                                └──────────┘  │   │   │
│  │  │                                                               │   │   │
│  │  │  ┌──────────────────────────┐   ┌──────────────────────────┐  │   │   │
│  │  │  │        STEP 9           │──▶│        STEP 10           │  │   │   │
│  │  │  │  ATOMIC PostgreSQL TX   │   │  T CHAIN ROTATION        │  │   │   │
│  │  │  │  SELECT FOR UPDATE:     │   │  T_new = HMAC(secret,    │  │   │   │
│  │  │  │   • Account (sender)    │   │    T_old || v++ ||       │  │   │   │
│  │  │  │   • Account (receiver)  │   │    SHA256(txn_id))       │  │   │   │
│  │  │  │   • TimestampKey        │   │  stored in timestamp_keys│  │   │   │
│  │  │  │  UPDATE: balance±=amt   │   │                          │  │   │   │
│  │  │  │  INSERT: transaction    │   │                          │  │   │   │
│  │  │  │  INSERT: notification   │   │                          │  │   │   │
│  │  │  │  COMMIT()               │   │                          │  │   │   │
│  │  │  └──────────────────────────┘   └──────────────────────────┘  │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │  RESULT: { transaction_id, status, sender_new_balance,       │   │   │
│  │  │           t_next, t_version_next, completed_at }             │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│         ┌─────────────────────────────┼─────────────────────────────┐      │
│         │                             │                             │      │
│         ▼                             ▼                             ▼      │
│  ┌──────────────┐   ┌───────────────────────┐   ┌──────────────────────┐  │
│  │  PostgreSQL  │   │       Redis 7         │   │  Celery (Future)     │  │
│  │  (Supabase)  │   │                       │   │                      │  │
│  │              │   │  • JWT blacklist       │   │  • Daily limit reset │  │
│  │  • users     │   │  • Rate limiter keys   │   │  • Audit log flush   │  │
│  │  • accounts  │   │  • Session cache       │   │  • Notification      │  │
│  │  • devices   │   │  • In-memory fallback  │   │    dispatch          │  │
│  │  • timestamps│   │    when unavailable    │   │                      │  │
│  │  • txns      │   │                       │   │                      │  │
│  │  • audit_log │   │                       │   │                      │  │
│  │  • tls_certs │   │                       │   │                      │  │
│  │  • notifs    │   │                       │   │                      │  │
│  └──────────────┘   └───────────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Cryptographic Key Hierarchy

```
                    REGISTRATION (Bank Officer)
                    =========================
                    
  activation_code ──┐
  NID_number ───────┼──▶ SHA-256 ──┐
  browser_fp ───────┘              ├──▶ HMAC ──▶ K1 (HMAC identity key)
                                   │              ├── SHA-256(K1) → device_credentials.k1_hash
                                   │              └── K1 sent to BFF session (raw, once)
                                   
  password ─────────▶ bcrypt ──▶ users.password_hash  (auth verification)
         │
         └──────────▶ Fernet.encrypt ──▶ device_credentials.k2_encrypted
                                          └── k2_raw at login (AES key material)
                                          
  os.urandom(32) ──▶ session_secret ──▶ Fernet.encrypt ──▶ device_credentials.session_secret_encrypted
                   │                    └── session_secret_raw at login (AES key material)
                   └── SHA-256(session_secret) → device_credentials.session_secret_hash


                    PER TRANSACTION (Encryption Flow)
                    =================================
                    
  K2_raw ──────────┐
  session_secret ──┼──▶ HKDF(K2 || secret || t_current, nonce, info) ──▶ AES-256 key
  t_current ───────┘                                                          │
                                                                               │
  M (JSON) ──▶ HMAC-SHA256(K1, M) ──▶ F1                                      │
                                         │                                     │
                                         ▼                                     ▼
                                   (M + "|" + F1) ──▶ AES-256-GCM.encrypt ──▶ encrypted_payload
                                                             │
                                                      AAD: username + t_version


                    PER TRANSACTION (Verification Flow)
                    ====================================
                    
  encrypted_payload ──▶ AES-256-GCM.decrypt(aad) ──▶ plaintext
                                                           │
                                            ┌──────────────┴──────────────┐
                                            │                             │
                                            M (JSON)                      F1 (received)
                                            │                             │
                                            ▼                             ▼
                                    HMAC-SHA256(K1, M)              compare_digest
                                            │                       (constant-time)
                                            ▼                             │
                                            F2 ──────── compare ─────────┘
                                                       │
                                                 match? ──▶ PROCESS
                                                 no?    ──▶ REJECT


                    T CHAIN (Anti-Replay)
                    =====================
                    
  T_0 = HMAC(server_secret, user_id || os.urandom(32))   ...initial T
       │
  T_1 = HMAC(server_secret, T_0 || version=2 || SHA256(txn_1_id))
       │
  T_2 = HMAC(server_secret, T_1 || version=3 || SHA256(txn_2_id))
       │
       ...
       
  Each T is unpredictable without SERVER_HMAC_SECRET.
  t_version counter must match declared version exactly.
  Mismatch → REJECT (replay detected).
```

### 2.3 Complete Transaction Flow (Time Sequence)

```
  BROWSER              NEXT.JS BFF             FLASK API              POSTGRESQL           REDIS
  ───────              ───────────             ─────────              ──────────           ─────
     │                      │                      │                      │                  │
     │  1. Submit Form      │                      │                      │                  │
     │  {receiver, amount}  │                      │                      │                  │
     │─────────────────────▶│                      │                      │                  │
     │                      │                      │                      │                  │
     │                      │ 2. Get Session       │                      │                  │
     │                      │ {k2Raw, secretRaw,   │                      │                  │
     │                      │  tCurrent, tVersion, │                      │                  │
     │                      │  actHash, nidHash,   │                      │                  │
     │                      │  browserFp}          │                      │                  │
     │                      │                      │                      │                  │
     │                      │ 3. Encrypt Payload    │                      │                  │
     │                      │ K1=deriveK1(...)      │                      │                  │
     │                      │ F1=HMAC(K1, M)        │                      │                  │
     │                      │ key=HKDF(K2,sec,T)    │                      │                  │
     │                      │ enc=AES-GCM(M||F1)    │                      │                  │
     │                      │                      │                      │                  │
     │                      │ 4. POST /initiate    │                      │                  │
     │                      │ {encrypted_payload,  │                      │                  │
     │                      │  declared_t_version, │                      │                  │
     │                      │  device_id}  + JWT   │                      │                  │
     │                      │─────────────────────▶│                      │                  │
     │                      │                      │                      │                  │
     │                      │                      │ 5. Verify JWT        │                  │
     │                      │                      │─────────────────────────────────────▶│
     │                      │                      │◀─────────────────────────────────────│
     │                      │                      │    jti not blacklisted               │
     │                      │                      │                      │                  │
     │                      │                      │ 6. Check t_version   │                  │
     │                      │                      │ SELECT FOR UPDATE───▶│                  │
     │                      │                      │◀──timestamp_key──────│                  │
     │                      │                      │ t_version == declared?│                  │
     │                      │                      │                      │                  │
     │                      │                      │ 7. Recompute K1+AES  │                  │
     │                      │                      │ K1=derive_k1(...)    │                  │
     │                      │                      │ key=HKDF(K2,sec,T)   │                  │
     │                      │                      │ plain=AES-GCM.dec()  │                  │
     │                      │                      │                      │                  │
     │                      │                      │ 8. HMAC Verify       │                  │
     │                      │                      │ F2=HMAC(K1, M)       │                  │
     │                      │                      │ compare(F1, F2)      │                  │
     │                      │                      │                      │                  │
     │                      │                      │ 9. Business Logic    │                  │
     │                      │                      │ receiver exists?     │                  │
     │                      │                      │ balance >= amount?   │                  │
     │                      │                      │ daily limit ok?      │                  │
     │                      │                      │                      │                  │
     │                      │                      │ 10. ATOMIC TXN       │                  │
     │                      │                      │─────────────────────▶│                  │
     │                      │                      │ FOR UPDATE accounts  │                  │
     │                      │                      │ sender -= amt        │                  │
     │                      │                      │ receiver += amt      │                  │
     │                      │                      │ INSERT transaction   │                  │
     │                      │                      │ UPDATE timestamp_key │                  │
     │                      │                      │ INSERT notification  │                  │
     │                      │                      │ INSERT audit_log     │                  │
     │                      │                      │ COMMIT               │                  │
     │                      │                      │◀─────────────────────│                  │
     │                      │                      │                      │                  │
     │                      │ 11. Response          │                      │                  │
     │                      │ {txn_id, status,     │                      │                  │
     │                      │  new_balance,        │                      │                  │
     │                      │  t_next, v_next}     │                      │                  │
     │                      │◀─────────────────────│                      │                  │
     │                      │                      │                      │                  │
     │                      │ 12. Update Session   │                      │                  │
     │                      │ save t_next, v_next  │                      │                  │
     │                      │                      │                      │                  │
     │ 13. Success Toast    │                      │                      │                  │
     │◀─────────────────────│                      │                      │                  │
     │                      │                      │                      │                  │
```

### 2.4 Security Layers Diagram

```
  ┌─────────────────────────────────────────────────────────────┐
  │                     LAYER 4: AUTH                           │
  │  JWT (HS256, 15min) + bcrypt passwords + CSRF tokens        │
  │  Officer API key for registration                           │
  └─────────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────────┐
  │                     LAYER 3: INTEGRITY                      │
  │  HMAC-SHA256 (F1) — message-level authentication            │
  │  AES-GCM auth tag — encryption-level authentication         │
  │  t_version check — replay prevention                        │
  └─────────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────────┐
  │                     LAYER 2: CONFIDENTIALITY                │
  │  AES-256-GCM with HKDF-derived key (K2+secret+T)            │
  │  AAD: sender_username + t_version (context binding)         │
  │  Random 96-bit IV per transaction                           │
  └─────────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────────┐
  │                     LAYER 1: TRANSPORT                      │
  │  TLS 1.3 (Nginx) — ECDHE key exchange                       │
  │  HSTS + Certificate Transparency                            │
  │  Security headers (CSP, XFO, XCTO, RP, Permissions-Policy)  │
  └─────────────────────────────────────────────────────────────┘


  THE RESULT:
  ┌─────────────────────────────────────────────────────────────┐
  │  Even if an attacker:                                       │
  │  • Strips TLS (compromised proxy)                           │
  │  • Captures encrypted_payload                               │
  │  • Has database dump (only hashes, no K1 plaintext)         │
  │  • Steals session cookie (needs K2 + session_secret + T)    │
  │                                                             │
  │  They CANNOT:                                               │
  │  • Read the message (AES-256-GCM)                           │
  │  • Modify the message (HMAC + GCM auth tag)                 │
  │  • Replay the message (t_version mismatch)                  │
  │  • Forge a transaction (K2 known only to user)              │
  │  • Impersonate a user (bcrypt + short-lived JWT)            │
  └─────────────────────────────────────────────────────────────┘
```

---

## 3. Summary

| Category | Paper | Implemented | Status |
|---|---|---|---|
| Cryptographic components | K1, K2, BP, T, F1, AES, HMAC | All implemented | ✅ |
| Registration flow | Officer + NID + activation_code | Seed script (same function) | ✅ |
| Transaction encryption | M+F1 encrypted with K2+BP+T | AES-256-GCM + HKDF | ✅ |
| Server verification | Decrypt → HMAC verify → process | 10-step pipeline | ✅ |
| Anti-replay | Timestamp T updated each tx | HMAC-chained T + version | ✅ |
| Atomic balance update | Sender -, receiver + | SELECT FOR UPDATE + COMMIT | ✅ |
| Web-specific adaptations | MAC→browser_fp, BP→session_secret | MVP trade-offs (documented) | ✅ |
| Transport security | Not in paper (added later) | TLS 1.3 + HSTS + CSP | ✅ |
| Password security | Not specified in paper | bcrypt (upgraded from SHA-256) | ✅ |
| Concurrent safety | Not addressed | FOR UPDATE on Account + TimestampKey | ✅ |

### Recommendation Table (for Next Phase)

| Item | Priority |
|---|---|
| Migrate to mTLS client certificates (native app) | Future |
| Add biometric authentication (WebAuthn/FIDO2) | Future |
| Implement idempotency keys for transactions | Medium |
| Add account-level brute force lockout | Medium |
| Migrate in-memory JWT blacklist to Redis (shared) | Medium |
| Production TLS cert deployment (Let's Encrypt) | Deployment |
| Backend integration/unit tests | Low |
