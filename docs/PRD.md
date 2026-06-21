# LightPay — Product Requirements Document

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Product  
**Last Updated:** 2026-06-21

---

## 1. Executive Summary

LightPay is a next-generation African fintech super-app that unifies fiat banking (Naira and Dollar) with seamless cryptocurrency access inside a single, beautifully designed mobile experience. LightPay targets the 200M+ Nigerian adults and diaspora who are underserved by fragmented financial tools — one app that does it all, without complexity.

**North Star Metric:** Monthly Active Users (MAU) who transact across at least two wallet types in a 30-day period.

---

## 2. Problem Statement

| Pain Point | Existing Solution | LightPay Solution |
|---|---|---|
| Sending money locally | Multiple apps (OPay, Kuda, etc.) | Naira Wallet — instant bank transfers |
| Holding and spending USD | GTBank DOM account, Chipper Cash | Dollar Wallet + Virtual USD Card |
| Buying/selling crypto | Binance, Luno, Yellow Card | Crypto Wallet — 3-tap experience |
| Converting crypto to cash | Complex exchange flows | One-tap Convert → Naira |
| Managing bills/airtime | Separate USSD or apps | Integrated into Naira Wallet |

---

## 3. Target Users

### Primary Persona — "The Digital Native Nigerian"
- Age: 18–35
- Income: ₦100k–₦500k/month
- Behaviour: Uses 3–5 fintech apps, curious about crypto, shops online in USD
- Goal: One app that handles all financial needs

### Secondary Persona — "The Diaspora Professional"
- Location: UK, USA, Canada
- Income: USD salary
- Behaviour: Sends remittances home, converts USD to NGN regularly
- Goal: Low-fee, fast transfers home with crypto optionality

### Tertiary Persona — "The Crypto Enthusiast"
- Age: 22–40
- Behaviour: Holds BTC/ETH, wants to spend crypto on daily needs
- Goal: Convert crypto to cash instantly without leaving one app

---

## 4. Product Scope — v1.0 (Naira Wallet Launch)

### 4.1 Naira Wallet (MVP — Launch Focus)

| Feature | Priority | Notes |
|---|---|---|
| Wallet balance display | P0 | Real-time balance |
| Bank transfers (NIP) | P0 | Via NIBSS integration |
| Receive money (virtual account) | P0 | Unique NUBAN per user |
| Send money (internal) | P0 | P2P within LightPay |
| Airtime purchase | P0 | All networks: MTN, GLO, Airtel, 9mobile |
| Data purchase | P0 | All networks, all plans |
| Transaction history | P0 | Paginated, filterable |
| QR payments | P1 | Scan to pay / receive |
| Utility bill payments | P1 | PHCN, DSTV, GoTV, LCC |
| Beneficiaries management | P1 | Save, edit, delete payees |
| Wallet top-up (card) | P1 | Via Paystack/Flutterwave |

### 4.2 Dollar Wallet (v1.1)

| Feature | Priority |
|---|---|
| USD balance | P0 |
| Receive USD | P0 |
| Send USD | P0 |
| NGN ↔ USD conversion | P0 |
| Virtual USD card | P1 |

### 4.3 Crypto Wallet (v1.2)

| Feature | Priority |
|---|---|
| BTC, ETH, SOL, BNB support | P0 |
| Buy / Sell crypto | P0 |
| Deposit / Withdraw crypto | P0 |
| Crypto → Cash (instant) | P0 |
| Cash → Crypto (instant) | P0 |
| Portfolio dashboard | P1 |

---

## 5. Functional Requirements

### 5.1 Authentication & Security

- **FR-AUTH-01:** Users must register with a valid Nigerian phone number
- **FR-AUTH-02:** OTP verification via SMS (4-digit, 5-minute expiry)
- **FR-AUTH-03:** BVN/NIN verification required for transactions above ₦50,000/day
- **FR-AUTH-04:** 6-digit transaction PIN required for all outgoing transactions
- **FR-AUTH-05:** Biometric authentication (Face ID / Fingerprint) optional but encouraged
- **FR-AUTH-06:** Device fingerprinting on every login attempt
- **FR-AUTH-07:** Sessions expire after 30 minutes of inactivity
- **FR-AUTH-08:** Maximum 5 failed PIN attempts → 24-hour lockout

### 5.2 Naira Wallet

- **FR-NAIRA-01:** Each user receives a unique NUBAN virtual account on registration
- **FR-NAIRA-02:** Bank transfers must complete within 30 seconds (NIP)
- **FR-NAIRA-03:** Transfer limits: ₦1M per transaction, ₦5M per day (Tier 1 KYC)
- **FR-NAIRA-04:** Airtime purchase confirms within 10 seconds
- **FR-NAIRA-05:** All transactions must have a receipt downloadable as PDF/image
- **FR-NAIRA-06:** Failed transactions must be auto-reversed within 60 seconds
- **FR-NAIRA-07:** Transaction history shows last 100 transactions, paginated

### 5.3 Notifications

- **FR-NOTIF-01:** Push notification for every credit and debit
- **FR-NOTIF-02:** SMS notification for transactions above ₦10,000
- **FR-NOTIF-03:** In-app notification center with read/unread state

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Availability** | 99.9% uptime (8.7 hours downtime/year max) |
| **Latency** | API responses < 200ms p95 |
| **Throughput** | 10,000 concurrent users at launch, 500k by Year 1 |
| **Security** | PCI-DSS Level 2 compliance roadmap; end-to-end encryption |
| **Compliance** | CBN regulations, NDPR (data privacy), FATF AML standards |
| **Performance** | App cold start < 2 seconds; 60fps animations |
| **Accessibility** | WCAG 2.1 AA — screen reader support, high contrast |
| **Offline** | Balance cached offline; queue transactions when connectivity resumes |

---

## 7. Success Metrics

| Metric | 30-Day | 6-Month | 12-Month |
|---|---|---|---|
| Registered users | 10,000 | 100,000 | 500,000 |
| MAU | 7,000 | 70,000 | 350,000 |
| Daily transactions | 5,000 | 80,000 | 400,000 |
| Transaction volume | ₦500M | ₦10B | ₦50B |
| Avg transactions/user/month | 8 | 12 | 15 |
| NPS | — | 45+ | 55+ |
| Churn rate | — | < 8% | < 5% |

---

## 8. Constraints & Assumptions

- **CBN License:** Assumes Mobile Money Operator (MMO) or Payment Service Bank (PSB) license
- **Banking Partner:** Assumes partnership with a sponsor bank for NUBAN issuance
- **KYC Provider:** BVN lookup via NIBSS or licensed provider
- **Crypto:** Regulated under CBN/SEC sandbox framework; P2P model initially
- **Launch Market:** Nigeria only (v1.0); diaspora corridors in v1.1
