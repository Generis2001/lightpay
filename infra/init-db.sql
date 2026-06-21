-- LightPay database initialization
-- Creates separate schemas per service (logical isolation)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy text search

-- Service schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS fiat;
CREATE SCHEMA IF NOT EXISTS kyc;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS crypto;
CREATE SCHEMA IF NOT EXISTS audit;

COMMENT ON SCHEMA auth IS 'Authentication service tables';
COMMENT ON SCHEMA fiat IS 'Fiat wallet (Naira, USD) service tables';
COMMENT ON SCHEMA kyc IS 'KYC/AML compliance tables';
COMMENT ON SCHEMA notifications IS 'Notification service tables';
COMMENT ON SCHEMA crypto IS 'Crypto wallet service tables';
COMMENT ON SCHEMA audit IS 'Audit and compliance logs';
