# LightPay — Security Architecture

## Threat Model

| Threat | Mitigation |
|---|---|
| Account takeover | MFA (OTP + PIN + Biometric), device trust |
| SIM swap | BVN binding, trusted device check |
| Man-in-the-middle | TLS 1.3, certificate pinning |
| Brute force PIN | 5-attempt lockout, 24hr cooldown |
| Transaction fraud | ML fraud scoring, velocity checks |
| Data breach | AES-256 encryption at rest, field-level encryption for PII |
| Insider threat | RBAC, audit logs, need-to-know data access |
| API abuse | Rate limiting, bot detection, API keys per client |

## Authentication Layers

```
Layer 1: Identity — Phone + OTP (or Email + OTP)
Layer 2: Device  — Device fingerprint + trust check
Layer 3: Session — JWT access token (15 min) + refresh token (30 days)
Layer 4: Action  — 6-digit PIN or Biometric for each transaction
Layer 5: Risk    — ML fraud score gates high-value transactions
```

## Token Strategy

```
Access Token:
  - Type: JWT, RS256 signed
  - Payload: userId, deviceId, sessionId, tier, permissions
  - TTL: 15 minutes
  - Storage: Memory (React Native state) — never AsyncStorage

Refresh Token:
  - Type: Opaque UUID (stored in DB)
  - TTL: 30 days (rolling)
  - Storage: Expo SecureStore (iOS Keychain / Android Keystore)
  - Rotation: Every use (single-use refresh tokens)
```

## PIN Security

- **Algorithm:** argon2id
  - Memory: 65536 KB
  - Iterations: 3
  - Parallelism: 4
- **Salt:** 16-byte random per user
- **Never stored in plaintext** — not even in logs
- **PIN change:** requires current PIN + OTP

## Data Encryption

### At Rest
- Database: AES-256-GCM for PII columns (BVN, NIN, account numbers)
- Files: S3 SSE-AES256 for KYC documents
- Backups: Encrypted with separate KMS key

### In Transit
- TLS 1.3 required; TLS 1.2 allowed with approved ciphers only
- Certificate pinning in mobile app (SHA-256 pin of leaf + intermediate)
- HSTS headers: max-age=31536000; includeSubDomains

## Fraud Detection

### Rule Engine (Real-time)
```
Velocity checks:
  - > 5 transfers in 10 minutes → flag
  - Transfer > 3x user's average → flag + SMS alert

Geo rules:
  - Transaction from new country → require OTP
  - Multiple countries in 1 hour → block + notify

Amount rules:
  - First transaction > ₦100,000 → require OTP
  - Aggregate daily > limit → block

Pattern rules:
  - Round amounts (₦100,000, ₦500,000) to new beneficiaries → flag
```

### ML Fraud Score
- Score 0–100 per transaction
- 0–30: Allow
- 31–60: Allow + flag for review
- 61–80: Require OTP challenge
- 81+: Block + notify + human review

## KYC / AML Compliance

### Tier Structure
```
Tier 0 (Unverified):
  - Send limit: ₦20,000/day
  - Receive: unlimited
  - Balance cap: ₦100,000

Tier 1 (BVN Verified):
  - Send limit: ₦1,000,000/day
  - Wallet balance: unlimited
  - Requires: Phone + BVN

Tier 2 (Full KYC):
  - Send limit: ₦10,000,000/day
  - USD wallet access
  - Crypto wallet access
  - Requires: Tier 1 + ID doc + Liveness check
```

### AML Screening
- PEP check on registration (Dow Jones / Refinitiv)
- Sanctions screening on every transaction
- Suspicious Activity Reports (SARs) filed with NFIU for flagged users
- Transaction monitoring: 90-day lookback

## Device Security

### Device Fingerprinting
Collected on every auth event:
- Device model + OS version
- Screen resolution
- Install ID (Expo)
- IP address + ASN
- Timezone

### Trust Levels
```
Unknown device → requires OTP to trust
Trusted device → biometric/PIN only
Compromised device → blocked, user notified
```

## API Security

- Rate limits per endpoint per user (Redis counters)
- Request signing for critical endpoints (HMAC-SHA256)
- Input validation: class-validator + class-transformer on all DTOs
- SQL injection: parameterized queries (TypeORM/Prisma)
- XSS: sanitize all user-supplied strings before storage
- CORS: allowlist of app bundle IDs only

## Audit Trail

Every sensitive action generates an immutable audit log:
- User ID, timestamp, IP, device
- Action name (e.g., TRANSFER_INITIATED)
- Before/after state snapshot (for account changes)
- Request ID for correlation

Audit logs:
- Retained for 7 years (CBN requirement)
- Append-only (no update/delete)
- Replicated to cold storage monthly

## Incident Response

| Severity | Response Time | Escalation |
|---|---|---|
| P0 (Account compromise) | < 15 min | CEO + CTO + Security Lead |
| P1 (Mass fraud) | < 30 min | Security Lead + Engineering |
| P2 (Data exposure) | < 2 hrs | Security Lead |
| P3 (Single user issue) | < 4 hrs | Support + Engineering |

Playbooks defined for:
- SIM swap attack
- Credential stuffing
- Large-value unauthorized transfer
- Data breach
- Service compromise
