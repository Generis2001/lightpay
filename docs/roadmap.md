# LightPay — Launch Roadmap & Sprint Breakdown

## Release Plan

```
Phase 1: Naira Wallet (MVP)     — Weeks 1–8
Phase 2: Dollar Wallet          — Weeks 9–14
Phase 3: Crypto Wallet          — Weeks 15–22
Phase 4: Growth & Scale         — Weeks 23+
```

---

## Phase 1: Naira Wallet MVP (8 Weeks)

### Sprint 1 (Week 1–2): Foundation
**Goal:** Development environment ready, core infrastructure running

| Story | Points | Owner |
|---|---|---|
| Monorepo setup (Turborepo + packages) | 3 | DevOps |
| Expo app scaffold + navigation structure | 5 | Mobile |
| NestJS gateway + auth service scaffold | 5 | Backend |
| PostgreSQL + Redis setup (Docker) | 3 | Backend |
| CI/CD pipeline (GitHub Actions) | 5 | DevOps |
| Design system (colors, typography, components) | 8 | Mobile/Design |
| **Sprint Total** | **29** | |

**Definition of Done:** App builds on iOS + Android; gateway responds to health check; design tokens are in code

---

### Sprint 2 (Week 3–4): Authentication
**Goal:** Users can register, verify, and log in securely

| Story | Points | Owner |
|---|---|---|
| US-001: Phone registration + OTP | 8 | Full-stack |
| Email registration + OTP (email) | 5 | Full-stack |
| US-002: BVN KYC verification | 8 | Backend |
| US-003: Biometric setup (Face ID / Fingerprint) | 5 | Mobile |
| PIN creation flow | 5 | Full-stack |
| Device fingerprinting | 5 | Backend |
| JWT + refresh token lifecycle | 5 | Backend |
| Onboarding screens (3 intro slides) | 3 | Mobile |
| **Sprint Total** | **44** | |

---

### Sprint 3 (Week 5–6): Naira Wallet Core
**Goal:** Users can fund wallet, view balance, send money

| Story | Points | Owner |
|---|---|---|
| US-010: Wallet balance screen | 5 | Mobile |
| US-011: Fund wallet (virtual account display) | 5 | Full-stack |
| Virtual account provisioning (Monnify) | 8 | Backend |
| US-012: Bank transfer (NIP) | 13 | Full-stack |
| US-013: Send to LightPay user | 8 | Full-stack |
| Bank name resolution API | 5 | Backend |
| Transaction ledger (double-entry) | 8 | Backend |
| Webhook handler (inbound transfers) | 8 | Backend |
| **Sprint Total** | **60** | |

---

### Sprint 4 (Week 7–8): Bills, QR, History & Polish
**Goal:** Full Naira wallet feature parity; app ready for beta

| Story | Points | Owner |
|---|---|---|
| US-014: Airtime purchase | 5 | Full-stack |
| US-015: Data purchase | 5 | Full-stack |
| US-016: Utility bill payments | 8 | Full-stack |
| US-017: QR payment (scan + receive) | 8 | Full-stack |
| US-018: Transaction history (list + detail) | 5 | Mobile |
| US-019: Beneficiaries management | 5 | Full-stack |
| Push notifications (Expo) | 5 | Full-stack |
| Receipt generation (share/save) | 3 | Mobile |
| Transaction PIN screen + validation | 5 | Mobile |
| E2E tests (auth + transfer flow) | 8 | QA |
| App Store / Play Store submission | 5 | DevOps |
| **Sprint Total** | **62** | |

**Phase 1 Total: ~195 story points over 8 weeks**

---

## Phase 2: Dollar Wallet (6 Weeks)

### Sprint 5–6: USD Account Infrastructure
- USD wallet creation
- USD virtual account (Paystack USD)
- NGN ↔ USD FX conversion
- Compliance: CBN FX regulations

### Sprint 7: USD Transfers
- Send USD internationally (Wise / Flutterwave)
- Receive USD from abroad
- USD transaction history

### Sprint 8–10: Virtual USD Card
- Card issuance (Stripe Issuing or Sudo Africa)
- Card management (freeze/unfreeze, limits)
- Card transaction history
- Online payment testing

---

## Phase 3: Crypto Wallet (8 Weeks)

### Sprint 11–12: Crypto Infrastructure
- Wallet generation (Fireblocks or self-custody)
- Price feeds (CoinGecko WebSocket)
- Portfolio tracking

### Sprint 13–14: Buy/Sell
- Buy crypto flow (NGN → BTC/ETH/SOL/BNB)
- Sell crypto flow (BTC/ETH/SOL/BNB → NGN)
- Liquidity provider integration (Yellow Card / Binance P2P API)

### Sprint 15–16: On-chain
- Deposit flow (generate receive address + QR)
- Withdraw flow (send to external wallet)
- Network fee estimation

### Sprint 17–18: Convert & Polish
- Crypto ↔ Cash instant convert (the key differentiator)
- Portfolio dashboard with charts
- Price alerts

---

## Phase 4: Growth (Ongoing)

| Feature | Quarter |
|---|---|
| Savings (Stash) — earn interest | Q3 |
| Group savings (Ajo/Esusu) | Q3 |
| LightPay Business (merchant account) | Q4 |
| Loans / BNPL | Q5 |
| Investment products (stocks, T-bills) | Q5 |
| International expansion (Ghana, Kenya) | Q6 |

---

## Monetization Strategy

| Stream | Model | Revenue Estimate (Year 1) |
|---|---|---|
| Transfer fees | 0.5% capped at ₦50 | ₦150M |
| FX spread | 0.5% NGN↔USD | ₦80M |
| Crypto spread | 1–1.5% buy/sell | ₦120M |
| Virtual card issuance | ₦1,000 one-time | ₦10M |
| Virtual card transactions | 0.5% interchange | ₦30M |
| Airtime/data cashback | Net margin 0.5–1% | ₦20M |
| Premium tier | ₦500/month | ₦25M |
| **Total Year 1** | | **~₦435M** |

---

## Team Structure (Recommended)

| Role | Count |
|---|---|
| Mobile Engineers (React Native) | 3 |
| Backend Engineers (NestJS) | 4 |
| DevOps / SRE | 1 |
| Product Manager | 1 |
| UI/UX Designer | 1 |
| QA Engineer | 1 |
| Security Engineer | 1 |
| Compliance Officer | 1 |
| **Total** | **13** |
