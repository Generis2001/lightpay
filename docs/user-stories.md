# LightPay — User Stories

## Epic 1: Onboarding & Authentication

### US-001: Phone Registration
**As a** new user  
**I want to** sign up with my phone number  
**So that** I can access LightPay without an email address

**Acceptance Criteria:**
- I enter my Nigerian phone number (+234 format)
- I receive an OTP within 30 seconds
- Entering the correct OTP creates my account
- I am prompted to set a 6-digit PIN
- I am prompted to enable biometric authentication

---

### US-002: KYC Verification
**As a** registered user  
**I want to** verify my identity with BVN  
**So that** I can unlock higher transaction limits

**Acceptance Criteria:**
- I enter my 11-digit BVN
- System verifies BVN against my phone number in real time (< 10s)
- Successful verification upgrades me to Tier 1 KYC
- I see my new limits in the app

---

### US-003: Biometric Login
**As a** returning user  
**I want to** log in with my fingerprint or Face ID  
**So that** I don't have to type my PIN every time

**Acceptance Criteria:**
- Face ID / fingerprint prompt appears on app open
- Successful biometric auth bypasses PIN entry for viewing balance
- High-value transactions still require PIN even after biometric auth

---

## Epic 2: Naira Wallet — Core

### US-010: View Wallet Balance
**As a** user  
**I want to** see my Naira balance on the home screen  
**So that** I always know how much I have

**Acceptance Criteria:**
- Balance is shown prominently on the home screen
- Balance updates in real time after any transaction
- I can toggle balance visibility (hide with eye icon)
- Offline: last known balance shown with "last synced" timestamp

---

### US-011: Fund Wallet
**As a** user  
**I want to** add money to my LightPay wallet  
**So that** I can transact on the platform

**Acceptance Criteria:**
- I can see my unique account number and bank name
- I can copy my account number with one tap
- I can share my account details
- Funds reflect within 30 seconds of a bank transfer
- I receive a push notification when funds arrive

---

### US-012: Send Money to Bank
**As a** user  
**I want to** transfer money to any Nigerian bank account  
**So that** I can pay people who don't have LightPay

**Acceptance Criteria:**
- I enter beneficiary bank account number
- Bank name auto-resolves within 3 seconds
- Beneficiary name is confirmed before I proceed
- I enter amount and optional narration
- I authenticate with PIN / biometrics
- Transaction completes within 30 seconds
- I receive a receipt I can share or save

---

### US-013: Send Money to LightPay User
**As a** user  
**I want to** send money to another LightPay user by phone number or tag  
**So that** transfers within the app are instant and free

**Acceptance Criteria:**
- I search by phone number or @username
- Avatar and name are shown for confirmation
- Transfer is instant (< 1 second internal settlement)
- No fee for internal transfers
- Both sender and receiver get push notifications

---

### US-014: Buy Airtime
**As a** user  
**I want to** buy airtime for myself or others  
**So that** I can recharge my phone directly from my wallet

**Acceptance Criteria:**
- I select network (MTN, GLO, Airtel, 9mobile)
- Phone number is auto-filled with my number; I can change it
- Quick amounts: ₦50, ₦100, ₦200, ₦500, ₦1000 or custom
- Transaction completes within 10 seconds
- I receive confirmation in the app and via SMS

---

### US-015: Buy Data
**As a** user  
**I want to** buy mobile data bundles  
**So that** I can stay connected

**Acceptance Criteria:**
- I select network
- Available data plans are shown with prices and validity
- I select a plan and confirm
- Transaction completes within 10 seconds

---

### US-016: Pay Utility Bills
**As a** user  
**I want to** pay my electricity, cable TV, and toll bills  
**So that** I don't need multiple apps

**Acceptance Criteria:**
- Bill categories: Electricity (PHCN/AEDC/EKEDC), Cable TV (DSTV/GOtv), Water, Toll (LCC)
- I enter my meter/smartcard number
- For electricity: I enter amount; I receive token via SMS/in-app
- For cable: subscription type is shown; I select and pay
- I see a receipt with the token/reference

---

### US-017: QR Payment
**As a** user  
**I want to** scan a merchant's QR code to pay  
**So that** in-person payments are fast and contactless

**Acceptance Criteria:**
- I tap "Scan QR" in the home screen
- Camera opens with QR scanner
- Scanning a valid LightPay QR pre-fills merchant name and optional amount
- I confirm and authenticate
- Merchant receives notification of payment

---

### US-018: View Transaction History
**As a** user  
**I want to** see all my past transactions  
**So that** I can track my spending

**Acceptance Criteria:**
- Transactions listed chronologically (newest first)
- Each entry shows: type icon, description, amount (colored), date/time
- Filter by: All / Credit / Debit / Bills / Transfers
- Search by description or amount
- Tapping a transaction shows full receipt

---

### US-019: Manage Beneficiaries
**As a** user  
**I want to** save frequent recipients  
**So that** repeat transfers are faster

**Acceptance Criteria:**
- After any transfer, I'm prompted to save beneficiary
- Beneficiary list shows avatar (initials), name, bank, account number
- I can delete or edit beneficiaries
- Tapping a beneficiary pre-fills the send money form

---

## Epic 3: Dollar Wallet

### US-030: Hold USD
### US-031: Receive USD
### US-032: Send USD
### US-033: Convert USD ↔ NGN
### US-034: Virtual Dollar Card

*(Full stories in v1.1 specification)*

---

## Epic 4: Crypto Wallet

### US-040: Buy Crypto
### US-041: Sell Crypto
### US-042: Crypto ↔ Cash Instant Convert
### US-043: Portfolio Dashboard

*(Full stories in v1.2 specification)*

---

## Epic 5: Notifications & Settings

### US-050: Push Notifications
**As a** user  
**I want to** receive real-time push notifications for transactions  
**So that** I'm always aware of activity on my account

### US-051: Profile Management
**As a** user  
**I want to** update my profile picture and name  
**So that** my account represents me

### US-052: Security Settings
**As a** user  
**I want to** change my PIN and manage biometric settings  
**So that** I control my account security

### US-053: Support
**As a** user  
**I want to** access in-app chat support  
**So that** I can resolve issues without calling

---

## Story Point Summary

| Epic | Stories | Points |
|---|---|---|
| Auth | 3 | 21 |
| Naira Wallet | 10 | 89 |
| Dollar Wallet | 5 | 55 |
| Crypto Wallet | 4 | 55 |
| Notifications/Settings | 4 | 21 |
| **Total** | **26** | **241** |
