# LightPay

**Fast. Simple. Yours.**

LightPay is a mobile payments application built around everyday financial needs in Nigeria: holding Naira, sending money to bank accounts, receiving funds, and paying for airtime, data, electricity, and cable TV. The project brings these activities into one app, with account verification, transaction history, and notifications.

LightPay also creates and imports cryptocurrency wallets on the device for Bitcoin, Ethereum, Solana and BNB Smart Chain. African bank payouts and Dollar services remain part of the wider product scope. Banking and identity providers require credentials, account approval, and testing before their services become available.

**Documentation date:** 10 November 2026. **Mobile app version:** 1.1.0. This README describes the current source and checked-in deployment documentation.

[Download Android APK v8](https://expo.dev/artifacts/eas/MoBdvsHM4-DKKJjvzFepOwxGz-mCMrNV-SzXXZXRsBM.apk), version 1.1.0 with Android version code 8. It includes device crypto wallets and the lightning-L launcher/splash. Signature, bundled API URL, native artwork references and 16 KB library alignment passed artifact checks; installation on the reported Android 16 device remains untested. See [release evidence](output/README.md).

## Main features

| Area | What the project implements |
| --- | --- |
| Account access | Phone or email registration, six-digit OTP verification, login, device-bound sessions, and logout. |
| Security | Six-digit transaction PIN, PIN changes, optional device biometrics, and protected app navigation. |
| Naira wallet | Balance display, NGN wallet initialization, Paystack receiving-account provisioning, and card-funding flows. |
| Crypto wallets | Create a 24-word recovery phrase or import an English BIP39 wallet; encrypted device keys, mainnet balances, addresses/QR, local signing, transaction status and identical retries. |
| Branding | Green launcher icon with a white lightning-shaped L, a matching cold-start splash and in-app logo. |
| Bank transfers | Bank discovery, account-name resolution, transfer review, PIN authorization, and saved beneficiaries. |
| Everyday bills | Airtime, data plans, electricity, and cable purchases through VTpass. |
| Records | Searchable, paginated transaction history, transaction details, payment references, and receipt sharing. |
| Notifications | Persisted in-app messages, read/unread controls, and an Expo push outbox. |
| Account management | Personal information, phone/email verification, identity checks, security settings, limits, and help screens. |

## Using the app

1. Register with a phone number or email, verify the OTP, and create a transaction PIN.
2. Complete your profile and the verification needed for the services you want to use.
3. Open **Home** for your balance and quick actions, **Transact** for payments, **Wallets** for available wallets, and **Profile** for settings.
4. Review the recipient, amount, and fees before authorizing a payment. Follow its status in transaction history; a processing payment is awaiting provider confirmation.

Receiving-account and card-funding access require Tier 1, a verified email, and a completed name. The app includes account sharing and QR scanning; these use the available payment flows.

In **Wallets**, choose **Create or import wallet** for crypto. Back up the recovery phrase, confirm the requested words, and choose a wallet password of at least 12 characters. The phrase restores the wallet independently of the LightPay account. Receiving and sending crypto uses the named blockchain directly, with a reviewed network fee and wallet-password authorization.

<!-- pagebreak -->

## Technology and architecture

LightPay is an npm workspace monorepo coordinated with Turborepo. The mobile client sends HTTP requests to a NestJS gateway, which routes them to the authentication and fiat services.

| Layer | Technology and responsibility |
| --- | --- |
| Mobile | Expo SDK 54, React Native 0.81.5, React 19, and Expo Router 6. |
| UI and state | NativeWind, Reanimated, Zustand, TanStack Query, and Axios. |
| API gateway | NestJS 10; public `/api/v1` routing, security headers, and aggregate health checks. |
| Authentication | NestJS, JWT, Argon2, OTP challenges, device sessions, profiles, and KYC. |
| Financial services | NestJS, TypeORM, PostgreSQL, and decimal.js; wallets, transfers, bills, funding, and provider reconciliation. |
| Development infrastructure | PostgreSQL 16, Redis 7, MailHog, and optional pgAdmin through Docker Compose. |

```text
Mobile app --> Gateway :3000
                 |--> Auth :3001 --> PostgreSQL / auth schema
                 |--> Fiat :3002 --> PostgreSQL / fiat schema
                                      |--> Payment providers
```

Auth and fiat share one PostgreSQL database with separate schemas. Fiat checks authoritative user tiers and sessions in auth tables. KYC runs within auth; international payments and notifications run within fiat. The current deployment runs all three processes in one Docker web service. Crypto keys, signatures and encrypted vaults stay on the device; the mobile wallet connects to public blockchain APIs directly.

## Repository map

| Path | Contents |
| --- | --- |
| `apps/mobile/` | App screens, UI components, state stores, API client, and Expo/EAS configuration. |
| `services/gateway/` | Public API entry point and routing. |
| `services/auth/` | Authentication, sessions, OTP, users, devices, KYC, and migrations. |
| `services/fiat/` | Financial features, provider adapters, notifications, and migrations. |
| `services/backend/` | Combined backend Dockerfile. |
| `packages/types/` | Shared TypeScript definitions. |
| `infra/` | Database initialization and backend startup supervisor. |
| `tests/` | Wallet derivation/encryption/signing/retry checks, backend HTTP, payment, database, and supervisor regression tests. |
| `docs/` | Product requirements, architecture, database notes, roadmap, and audit. |

## Provider connections

Paystack handles Nigerian banking and funding; VTpass supplies bill-payment products; Termii supplies the phone OTP integration, and Brevo or SendGrid delivers email OTPs. Brevo's Free plan is configured on Render: real email delivery, account registration, PIN setup, logout and fresh sign-in have passed live checks. Phone/SMS delivery remains unverified. Prepared adapters connect Flutterwave for outgoing African bank transfers and Prembly for BVN/NIN identity checks. Expo supports device push notifications. Fireblocks custody has been retired; crypto wallets use public mainnet APIs without a custody account or server-held private keys.

<!-- pagebreak -->

## Local development

### 1. Install the prerequisites

Use **Node.js 20 or newer**, **npm 10** (the repository specifies 10.9.0), Git, and Docker with Docker Compose. EAS cloud builds use Node 22.16.0. Run the following commands from the repository root in a Bash or WSL terminal.

```bash
npm ci
docker compose up -d postgres redis mailhog
```

Compose starts development infrastructure. Backend services and the mobile app are started separately. MailHog does not replace the current Termii/Brevo/SendGrid OTP integrations.

### 2. Configure the environment

Create service environment files from the template if they do not already exist:

```bash
cp -n .env.example services/auth/.env
cp -n .env.example services/fiat/.env
cp -n .env.example services/gateway/.env
```

Set the **same `JWT_SECRET`** in all three services; use a random value of at least 32 characters. Auth and fiat must use the same database: keep the template's local `POSTGRES_*` settings for the supplied Compose database, or set `DATABASE_URL` to your own shared PostgreSQL instance. Local PostgreSQL uses `DATABASE_SSL=false`; hosted databases should use their documented TLS settings. Set `NODE_ENV=development` for local development.

Auth and fiat load `.env.local` before `.env`, so existing `.env.local` values may take precedence. Keep database URLs, JWT secrets, and provider keys in backend environment files or hosting secret settings.

In `apps/mobile/.env`, set the public API address:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

That address is for a browser on the development computer. A device needs a reachable backend address; the Android emulator normally uses `10.0.2.2` for the host computer. Installed release builds require HTTPS. Only public configuration belongs in `EXPO_PUBLIC_*` variables.

### 3. Start the services and app

Start auth first and wait for it to become ready. Start each subsequent command in a separate terminal:

```bash
npm run dev --workspace=@lightpay/auth-service
npm run dev --workspace=@lightpay/fiat-service
npm run gateway
npm run mobile
```

Use `npm run web` for the browser preview. Auth and fiat apply their checked-in migrations before accepting requests. The database user needs schema/table creation rights and the required extensions. Database schema synchronization is disabled.

Check `http://localhost:3000/api/v1/health`. Local API documentation is available at `http://localhost:3001/docs` and `http://localhost:3002/docs`. OTP registration and provider payments require the corresponding configured providers.

<!-- pagebreak -->

## API and transaction behavior

Backend API calls use the gateway base `/api/v1`. Protected requests carry a Bearer access token and the device identifier used by the session. Outgoing fiat payment routes validate a six-digit PIN on the server. Crypto transactions are signed locally after wallet-password authorization.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Check auth and fiat database readiness. |
| `POST /auth/register/phone` or `/auth/register/email` | Begin registration. |
| `POST /auth/otp/verify` | Verify an OTP. |
| `GET /auth/me` | Read the signed-in user's profile. |
| `GET /wallets` and `/wallets/limits` | Read wallets and current limits. |
| `POST /wallets/virtual-account` and `/wallets/funding` | Provision a receiving account or initialize card funding. |
| `GET /transfers/banks` and `/transfers/resolve` | Discover banks and resolve an account. |
| `POST /transfers/bank` | Submit a Nigerian bank transfer. |
| `POST /bills/airtime`, `/bills/data`, `/bills/electricity`, `/bills/cable` | Submit bill purchases. |
| `GET /transactions` and `/transactions/:id` | Read history and transaction details. |
| `/kyc`, `/international`, `/notifications` | Identity, prepared bank payouts, and notification APIs. |
| `/crypto` | Compatibility manifest; legacy provisioning, quotes and sends return HTTP 410. |

Fiat amounts and fees are validated by the backend. Transfers, bills, and card-funding requests use an **`Idempotency-Key`** to identify a payment intent and prevent duplicate processing when that request is retried. International sends use persisted server quotes. Crypto amounts retain full chain precision; the reviewed transaction is signed on the device and saved before broadcasting. A retry reuses the same signed bytes and hash, and an unresolved transfer blocks another send on that network.

Provider-confirmed credits, signed Paystack webhooks, status polling, and reconciliation support settlement. A successful submission does not itself confirm completion. Uncertain results remain processing for reconciliation; some provider failures require operator review.

## Verification tiers and outgoing NGN limits

| Tier | Verification | Per payment, including fees | Daily, including fees |
| --- | --- | --- | --- |
| 0 | Basic account | NGN 20,000 | NGN 20,000 |
| 1 | Verified BVN | NGN 1,000,000 | NGN 1,000,000 |
| 2 | BVN followed by verified NIN | NGN 1,000,000 | NGN 10,000,000 |

These are the current backend limits, measured by calendar day in **Africa/Lagos**; final product/provider approval remains pending. Identity checks require a completed name, verified phone, consent, selfie, and matching identity/face/liveness evidence. African bank payouts require Tier 2. Device-created/imported crypto wallets use their own recovery phrase and password.

## Checks and builds

```bash
npm run type-check
npm run build --workspace=@lightpay/auth-service
npm run build --workspace=@lightpay/fiat-service
npm run build --workspace=@lightpay/gateway
npm run test:integration
npm run build:apk
```

Database integration cases run only when `LIGHTPAY_TEST_DATABASE_URL` points to an isolated PostgreSQL test host that permits creation/deletion of a generated test database; otherwise those cases skip. `build:apk` invokes EAS using the `production-apk` profile and requires Expo/EAS access. Device features need verification in an installed build.

<!-- pagebreak -->

## Deployment and configuration

The combined backend uses `services/backend/Dockerfile` and `infra/start-backend.cjs`. Its supervisor starts auth, then fiat, then the gateway after upstream health checks pass. Only the gateway is public. The Render configuration is described in `render.yaml` and [DEPLOY.md](DEPLOY.md).

The checked-in production EAS profiles currently point to:

`https://lightpay-backend-yfva.onrender.com/api/v1`

Configure the shared database and JWT secret on the backend host, keep schema synchronization disabled, and configure providers independently. Paystack's webhook path is `/api/v1/webhooks/paystack`. The gateway preserves raw webhook bytes for signature verification.

| Connection | Main backend settings |
| --- | --- |
| Database and sessions | `DATABASE_URL`, TLS settings, `JWT_SECRET`, JWT/refresh expiry. |
| Nigerian banking | `PAYSTACK_SECRET_KEY`; receiving-account and payout approval. |
| Bills | `VTPASS_API_KEY`, `VTPASS_PUBLIC_KEY`, `VTPASS_SECRET_KEY`. |
| OTP delivery | Email: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, verified `FROM_EMAIL` (or SendGrid). Phone: `TERMII_API_KEY`. |
| African payouts | `FLUTTERWAVE_ENABLED`, secret key, explicitly approved country codes. |
| Identity verification | `PREMBLY_ENABLED`, API key, actual HTTPS base URL, API format, identity hash key. |
| Push | Device/EAS/FCM credentials; `EXPO_ACCESS_TOKEN` when required. |

See `.env.example` for the complete template, including optional public blockchain endpoints. Flutterwave and Prembly are disabled by default until account-specific behavior is validated. The retired custody module does not start Fireblocks or its reconciliation jobs, including when old Fireblocks settings remain present.

## Current status and next work

Naira wallet, banking, bills, session security, transaction tracking, notifications and device crypto wallets are implemented in source. Live Brevo email registration and sign-in passed on 10 November 2026, including authenticated profile and NGN-wallet access. Connected-provider payments and identity decisions remain unverified. An API health check confirms database readiness; payment availability needs separate provider checks.

The main remaining work is banking/identity-provider activation and testing, installed-device validation, funded on-chain transfer checks, and operational monitoring and recovery. APK v8 includes the lightning-L launcher/splash, targets Android API 36 and passes signed-artifact and native-library alignment checks. Runtime compatibility still needs confirmation on the reported Android 16 device.

Prepared Flutterwave corridors cover candidate outgoing payouts to Nigeria, Ghana, Kenya, Uganda, Tanzania, Rwanda, South Africa, and Zambia, subject to account approval. Incoming receiving accounts currently cover Nigerian NGN through Paystack. Crypto wallets support the first standard Ethereum/BNB and Solana accounts and Bitcoin BIP84 account 0. Bitcoin restoration scans receiving/change branches with a gap of 20 and a limit of 200 addresses per branch; other account types and token assets are not supported.

**USD wallets, USD accounts/cards, FX conversion, and crypto-to-cash conversion are not implemented.** Expo push receipt polling is also unfinished. Tier 0's documented NGN 100,000 balance cap is exposed by the limits API but is not universally enforced on credits. Free Render service inactivity pauses background jobs; the current free database expires on 8 December 2026 unless upgraded.

## Further reading

- [DEPLOY.md](DEPLOY.md): deployment, provider prerequisites, and current validation limits.
- [Application audit](docs/application-audit.md): implemented changes, regression coverage, and remaining work.
- [Product requirements](docs/PRD.md) and [roadmap](docs/roadmap.md): product vision and planned scope.
- [Database schema](docs/database/schema.md) and [architecture notes](docs/architecture/backend.md): supporting technical documentation; earlier architecture notes include planned components.

The repository packages are private. No license file is included in the current repository.
