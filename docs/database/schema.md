# LightPay — Database Schema

**Engine:** PostgreSQL 16  
**ORM:** TypeORM (services) / Prisma (gateway)  
**Naming:** snake_case for tables and columns

---

## Core Tables

### users
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(15) NOT NULL UNIQUE,
  phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  email           VARCHAR(255) UNIQUE,
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  username        VARCHAR(50) UNIQUE,
  avatar_url      TEXT,
  date_of_birth   DATE,
  gender          VARCHAR(10),
  address         TEXT,
  state           VARCHAR(100),
  country         CHAR(2) NOT NULL DEFAULT 'NG',
  kyc_tier        SMALLINT NOT NULL DEFAULT 0,  -- 0=unverified, 1=BVN, 2=NIN+ID
  kyc_status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  bvn             VARCHAR(11) UNIQUE,
  nin             VARCHAR(11) UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason  TEXT,
  referral_code   VARCHAR(10) UNIQUE,
  referred_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at   TIMESTAMPTZ
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username);
```

### user_auth
```sql
CREATE TABLE user_auth (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_hash        VARCHAR(255),
  biometric_key   TEXT,  -- encrypted public key for biometric
  failed_attempts SMALLINT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### user_devices
```sql
CREATE TABLE user_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       VARCHAR(255) NOT NULL,
  device_name     VARCHAR(255),
  platform        VARCHAR(20),  -- ios | android
  push_token      TEXT,
  fingerprint     VARCHAR(255) NOT NULL,
  is_trusted      BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_devices_user ON user_devices(user_id);
CREATE INDEX idx_devices_fingerprint ON user_devices(fingerprint);
```

### otp_codes
```sql
CREATE TABLE otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       VARCHAR(15) NOT NULL,
  code        VARCHAR(6) NOT NULL,
  purpose     VARCHAR(30) NOT NULL,  -- registration | login | transaction | reset_pin
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  attempts    SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_phone_purpose ON otp_codes(phone, purpose);
```

### sessions
```sql
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       UUID REFERENCES user_devices(id),
  access_token    VARCHAR(500) NOT NULL,
  refresh_token   VARCHAR(500) NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_refresh ON sessions(refresh_token);
```

---

## Wallet Tables

### wallets
```sql
CREATE TABLE wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type            VARCHAR(20) NOT NULL,  -- naira | dollar | crypto
  currency        VARCHAR(10) NOT NULL,  -- NGN | USD | BTC | ETH | SOL | BNB
  balance         NUMERIC(20, 8) NOT NULL DEFAULT 0,
  ledger_balance  NUMERIC(20, 8) NOT NULL DEFAULT 0,  -- includes pending
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, currency)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);
```

### virtual_accounts
```sql
CREATE TABLE virtual_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  wallet_id       UUID NOT NULL REFERENCES wallets(id),
  account_number  VARCHAR(10) NOT NULL UNIQUE,
  bank_name       VARCHAR(100) NOT NULL,
  bank_code       VARCHAR(10) NOT NULL,
  account_name    VARCHAR(255) NOT NULL,
  provider        VARCHAR(50) NOT NULL,  -- paystack | flutterwave | monnify
  provider_ref    VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_virtual_accounts_user ON virtual_accounts(user_id);
CREATE INDEX idx_virtual_accounts_number ON virtual_accounts(account_number);
```

### transactions
```sql
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       VARCHAR(100) NOT NULL UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id),
  wallet_id       UUID NOT NULL REFERENCES wallets(id),
  type            VARCHAR(30) NOT NULL,
  -- credit | debit | transfer_in | transfer_out | airtime | data | bill | conversion
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | processing | completed | failed | reversed
  amount          NUMERIC(20, 8) NOT NULL,
  fee             NUMERIC(20, 8) NOT NULL DEFAULT 0,
  balance_before  NUMERIC(20, 8) NOT NULL,
  balance_after   NUMERIC(20, 8) NOT NULL,
  currency        VARCHAR(10) NOT NULL,
  description     TEXT,
  narration       TEXT,
  metadata        JSONB DEFAULT '{}',
  -- provider response, account details, etc.
  provider        VARCHAR(50),
  provider_ref    VARCHAR(255),
  provider_status VARCHAR(50),
  channel         VARCHAR(30),  -- app | qr | api | ussd
  ip_address      INET,
  device_id       UUID REFERENCES user_devices(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_reference ON transactions(reference);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
```

### transaction_pairs
```sql
-- Links two transactions for internal P2P transfers
CREATE TABLE transaction_pairs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_tx_id     UUID NOT NULL REFERENCES transactions(id),
  credit_tx_id    UUID NOT NULL REFERENCES transactions(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### beneficiaries
```sql
CREATE TABLE beneficiaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL,  -- bank | lightpay | airtime | bill
  name            VARCHAR(255) NOT NULL,
  bank_code       VARCHAR(10),
  bank_name       VARCHAR(100),
  account_number  VARCHAR(20),
  phone           VARCHAR(15),
  lightpay_user_id UUID REFERENCES users(id),
  bill_category   VARCHAR(50),
  bill_provider   VARCHAR(50),
  bill_reference  VARCHAR(100),  -- meter number, smartcard number
  last_amount     NUMERIC(20, 2),
  times_used      INT NOT NULL DEFAULT 0,
  is_favourite    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_beneficiaries_user ON beneficiaries(user_id);
```

---

## Bill Payment Tables

### bill_payments
```sql
CREATE TABLE bill_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id),
  category        VARCHAR(30) NOT NULL,
  -- electricity | cable | data | airtime | water | toll
  provider        VARCHAR(50) NOT NULL,
  -- EKEDC | IKEDC | AEDC | PHEDC | DSTV | GOTV | MTN | GLO | AIRTEL | 9MOBILE
  customer_ref    VARCHAR(100) NOT NULL,  -- meter/smartcard/phone
  customer_name   VARCHAR(255),
  units           NUMERIC(10, 4),  -- for electricity (kWh)
  token           VARCHAR(100),    -- electricity token
  subscription_type VARCHAR(50),  -- for cable
  provider_ref    VARCHAR(255),
  provider_response JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Audit & Compliance

### audit_logs
```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  device_id   UUID REFERENCES user_devices(id),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

### kyc_documents
```sql
CREATE TABLE kyc_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,
  -- bvn | nin | passport | drivers_license | voters_card
  document_number VARCHAR(50),
  front_url       TEXT,
  back_url        TEXT,
  selfie_url      TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | reviewing | approved | rejected
  rejection_reason TEXT,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### fraud_signals
```sql
CREATE TABLE fraud_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  transaction_id  UUID REFERENCES transactions(id),
  signal_type     VARCHAR(50) NOT NULL,
  risk_score      NUMERIC(5, 2) NOT NULL,
  details         JSONB,
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Notifications

### notifications
```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
```

---

## QR Payments

### qr_codes
```sql
CREATE TABLE qr_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL DEFAULT 'dynamic',
  -- static | dynamic
  amount      NUMERIC(20, 2),  -- null for static (open amount)
  description TEXT,
  qr_data     TEXT NOT NULL,  -- encoded QR payload
  expires_at  TIMESTAMPTZ,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Referral & Rewards

### referral_events
```sql
CREATE TABLE referral_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES users(id),
  referee_id      UUID NOT NULL REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  reward_amount   NUMERIC(10, 2),
  rewarded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
