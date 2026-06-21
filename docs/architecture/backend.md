# LightPay — Backend Architecture

## Overview

LightPay uses a **modular microservices architecture** deployed on a Kubernetes cluster. Services communicate via both synchronous REST/gRPC and asynchronous event streaming (Redis Streams / BullMQ).

```
┌─────────────────────────────────────────────────────────┐
│                     Mobile App (Expo)                    │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────┐
│              API Gateway (NestJS + Kong)                  │
│  • Rate limiting   • Auth middleware   • Routing          │
│  • Request validation  • Response caching                 │
└──┬──────────┬──────────┬───────────┬─────────────────────┘
   │          │          │           │
   ▼          ▼          ▼           ▼
┌──────┐ ┌──────┐ ┌──────────┐ ┌─────────┐
│ Auth │ │ Fiat │ │  Crypto  │ │  KYC   │
│ Svc  │ │ Svc  │ │   Svc    │ │  Svc   │
└──┬───┘ └──┬───┘ └────┬─────┘ └────┬────┘
   │        │          │             │
   └────────┴──────────┴─────────────┘
                       │
         ┌─────────────▼───────────┐
         │     Event Bus (Redis)   │
         │   + BullMQ Job Queues   │
         └─────────────┬───────────┘
                       │
         ┌─────────────▼───────────┐
         │  Notification Service   │
         │  (Push, SMS, Email)     │
         └─────────────────────────┘
```

## Services

### 1. API Gateway (`services/gateway`)
- **Framework:** NestJS + @nestjs/throttler
- **Responsibilities:**
  - JWT validation on every request
  - Route proxying to downstream services
  - Request/response logging
  - Rate limiting (per user, per IP)
  - Circuit breaking (opossum)
  - API versioning (/api/v1/)
  - Swagger aggregation
- **Port:** 3000

### 2. Auth Service (`services/auth`)
- **Responsibilities:**
  - User registration / login
  - OTP generation and validation
  - JWT access token + refresh token lifecycle
  - PIN management (hashed with argon2)
  - Biometric key registration
  - Device fingerprinting
  - Session management (Redis)
  - Brute force protection
- **Port:** 3001

### 3. Fiat Service (`services/fiat`)
- **Responsibilities:**
  - Wallet CRUD (Naira, USD)
  - Virtual account provisioning (Paystack/Monnify)
  - Bank transfer (NIP via aggregator)
  - Airtime/Data purchase (VTPass/BillsAfrica)
  - Utility bill payments
  - P2P internal transfers
  - QR payment processing
  - Transaction ledger (double-entry)
  - Webhook handling from providers
  - Beneficiary management
- **Port:** 3002
- **External:** Paystack, Flutterwave, Monnify, VTPass

### 4. Crypto Service (`services/crypto`)
- **Responsibilities:**
  - Crypto wallet generation (non-custodial keys or custodial via Fireblocks)
  - Buy/Sell via liquidity provider
  - Deposit/Withdrawal on-chain
  - Real-time price feeds (CoinGecko, Binance WebSocket)
  - Portfolio tracking
  - Conversion (Crypto ↔ Naira)
- **Port:** 3003

### 5. KYC Service (`services/kyc`)
- **Responsibilities:**
  - BVN verification (NIBSS / Smile Identity)
  - NIN verification
  - Liveness check (Smile Identity / Onfido)
  - Document verification
  - KYC tier management
  - AML screening (Dow Jones / Refinitiv)
- **Port:** 3004

### 6. Notification Service (`services/notifications`)
- **Responsibilities:**
  - Push notifications (Expo / FCM / APNs)
  - SMS (Termii / AfricasTalking)
  - Email (SendGrid)
  - In-app notifications (stored in DB)
  - Notification preferences
- **Port:** 3005

## Data Layer

### PostgreSQL (Primary Store)
- One database per service (schema isolation)
- Read replicas for heavy query services
- Connection pooling via PgBouncer

### Redis
- Session store (Auth service)
- Cache (wallet balances, bank list)
- BullMQ queues (async jobs)
- Rate limit counters
- OTP store (TTL 5 minutes)

## Security Architecture

```
User Request
    │
    ▼
Rate Limiter (Redis)
    │
    ▼
JWT Validation (Gateway)
    │
    ▼
Device Trust Check
    │
    ▼
Permission Check (RBAC)
    │
    ▼
Input Sanitization (class-validator)
    │
    ▼
Business Logic
    │
    ▼
Audit Log Write
```

### Key Security Controls
- All passwords/PINs: argon2id hashing
- All tokens: RS256 signed JWTs (asymmetric keys)
- PII fields: AES-256-GCM encrypted at rest
- All transport: TLS 1.3
- Secrets: HashiCorp Vault / AWS Secrets Manager
- Key rotation: automated 90-day rotation
- CORS: restricted to app bundle origins

## Double-Entry Ledger

Every financial transaction creates TWO ledger entries:
```
DEBIT  user_wallet      ₦5,000  (balance decreases)
CREDIT settlement_pool  ₦5,000  (awaiting NIP completion)
```
On success:
```
DEBIT  settlement_pool  ₦5,000
CREDIT beneficiary_bank ₦5,000
```

This ensures money is never created or destroyed, only moved.

## Event Flow: Bank Transfer

```
1. POST /api/v1/transfers
2. Gateway validates JWT, routes to Fiat Service
3. Fiat: validates amount, checks balance, checks daily limit
4. Fiat: creates transaction (status=pending), debits ledger
5. Fiat: enqueues NIP transfer job (BullMQ)
6. NIP Worker: calls bank aggregator API
7. On success: marks transaction completed, emits TransactionCompleted event
8. On failure: marks transaction failed, reverses ledger, emits TransactionFailed
9. Notification Worker: sends push notification
10. Audit Worker: writes audit log
```

## Deployment

- **Container:** Docker
- **Orchestration:** Kubernetes (EKS)
- **CI/CD:** GitHub Actions → ECR → EKS
- **Config:** Helm charts per service
- **Monitoring:** Prometheus + Grafana
- **Logging:** Elastic Stack (ELK)
- **Tracing:** Jaeger / OpenTelemetry
- **Alerts:** PagerDuty

## Scaling Strategy

| Service | Horizontal Scale Trigger | Max Replicas |
|---|---|---|
| Gateway | CPU > 70% or RPS > 5000 | 20 |
| Auth | Req/s > 500 | 10 |
| Fiat | CPU > 70% or queue depth > 1000 | 20 |
| Crypto | Price feed latency > 1s | 5 |
| Notifications | Queue depth > 500 | 10 |

## Monetization (Technical Enablers)

| Revenue Stream | Service | Implementation |
|---|---|---|
| Transfer fees (0.5%, max ₦50) | Fiat | Fee calculation in ledger |
| FX spread (USD ↔ NGN) | Fiat | Rate markup on conversion |
| Crypto spread (1–1.5%) | Crypto | Price markup on buy/sell |
| Virtual card issuance fee | Fiat | One-time ₦1,000 |
| Airtime/data cashback (0.5%) | Fiat | Rewards system |
| Premium tier (₦500/month) | Auth | Feature flags |
