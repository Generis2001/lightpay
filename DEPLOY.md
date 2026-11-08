# LightPay deployment and provider setup

Prepared 8 November 2026. The source is prepared for deployment; no production deployment or connected-provider payment has been verified from this workspace. The installed APK does not change until a new build is installed.

## PostgreSQL URL

Auth and fiat need **the same PostgreSQL database**, with separate `auth` and `fiat` schemas. Fiat reads authoritative identity tiers and device sessions from auth tables. The gateway and mobile app do not connect to PostgreSQL.

Set `DATABASE_URL` in the private environment settings of **both** backend services:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/lightpay
```

This is a format example, not a working connection. Obtain the actual URL from your database host. Percent-encode reserved characters in the username/password when assembling a URL yourself. Keep it out of source control, chat, `EXPO_PUBLIC_*`, and the APK.

The [Render blueprint](render.yaml) reuses the existing `generis-postgresql-lightpay` database, PostgreSQL 18 in Oregon, through the `lightpay-database` environment group in Lightpay's Production environment. It does not provision another database. The group contains the existing **Internal Database URL**, `DATABASE_SSL=true`, and `DATABASE_SSL_REJECT_UNAUTHORIZED=false`; both private services import it. [Render documents](https://render.com/docs/postgresql-creating-connecting#ssl-modes-for-internal-connections) that internal TLS uses self-signed certificates, so this internal-only trust setting retains encryption while accepting the provider's certificate. Use the internal URL only for Render services in the same region.

Local ignored `.env.local` files in the root, auth, and fiat directories hold the **External Database URL** with TLS and certificate verification enabled. `.env.render.local` holds the internal URL and its internal-TLS settings. All four credential files have owner-only permissions. A read-only external connection check timed out here, so live SQL connectivity and migration readiness remain unverified. With another database host, update the group or private settings to that host's URL and documented TLS settings. Use a direct PostgreSQL connection or session pooler for migrations and reconciliation; a transaction pooler is incompatible with the session advisory locks used here.

`DATABASE_URL` takes precedence over `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`. TLS and certificate verification are enabled by default in production. Use the host's documented TLS configuration, including the internal-only Render setting above; keep certificate verification enabled for external URLs. Database-host SSL parameters in the URL also affect the PostgreSQL driver's connection behavior.

Startup creates the service schema and applies checked-in migrations before accepting requests. The database role needs schema/table/index creation and the `uuid-ossp` extension (or have an administrator preinstall the extension). `DB_SYNCHRONIZE` must remain false. Existing duplicate wallets or references make the uniqueness migration fail for review; migrations do not delete conflicting financial data. Back up an existing database and review migrations before deploying.

## Free backend deployment

The free deployment runs auth, fiat, and the gateway in one Docker web service,
`lightpay-backend`, in Oregon. Only the gateway listens on Render's public `PORT`.
Auth and fiat listen on `127.0.0.1:3001` and `127.0.0.1:3002` inside the container.
The startup supervisor waits for auth's SQL health check before starting fiat, then
waits for fiat before starting the gateway. A failed child stops the container so
Render can restart the complete backend.

The combined Dockerfile is `services/backend/Dockerfile`, with the repository root
as its build context. The startup script is `infra/start-backend.cjs`. Per-process
Node heap limits leave memory for native modules within the free service's budget.
The public `/api/v1/health` checks both upstream services, each of which runs
`SELECT 1` against the existing database.

1. Deploy the `deploy/lightpay-backend` branch as a **Free Docker Web Service** in
   Lightpay's **Production** environment, with the combined Dockerfile above.
2. Link the existing `lightpay-database` and `lightpay-authentication` environment
   groups. The first holds the internal database URL and its TLS settings; the
   second holds the generated shared `JWT_SECRET`. No credentials belong in Git.
3. Set `NODE_ENV=production` and `DB_SYNCHRONIZE=false`. Keep Flutterwave, Fireblocks,
   and Prembly disabled until provider credentials and account behavior are verified.
4. Verify migrations and all three processes in Render's logs. Confirm the public
   `/api/v1/health` responds with `{"status":"ready"}`.
5. Point the mobile app at the service's HTTPS URL followed by `/api/v1`, or configure
   the `api.lightpay.ng` custom domain and DNS before building the production APK.
6. Configure Paystack's webhook at the backend URL followed by
   `/api/v1/webhooks/paystack` when enabling that provider. The gateway preserves
   raw bytes and fiat verifies the Paystack HMAC before settlement.

Free web services pause after inactivity and can take time to wake up. Background
reconciliation and notification jobs do not run while the container is paused.
The free database expires on **8 December 2026** unless upgraded. This deployment
does not create any paid services or upgrade the database.

## Existing provider integrations

| Provider | Implemented use | Required configuration |
| --- | --- | --- |
| Paystack | Nigerian bank discovery/transfers, NGN dedicated accounts and card funding | `PAYSTACK_SECRET_KEY`; verified customer profile, dedicated-account and payout activation |
| VTpass | Airtime, data, electricity, cable | `VTPASS_API_KEY`, `VTPASS_PUBLIC_KEY`, `VTPASS_SECRET_KEY` |
| Termii | Phone OTP | `TERMII_API_KEY`, approved `TERMII_SENDER_ID` |
| SendGrid | Email OTP | `SENDGRID_API_KEY`, verified `FROM_EMAIL` |

Code presence does not establish that any account is configured. Provider credentials are still absent; the database-only local environment files do not activate payment or identity providers. Paystack receiving accounts/card funding require Tier 1 and a verified email/full name. The only receiving bank-account integration is Nigerian NGN. USD wallets/cards/FX and incoming accounts across African countries are still unimplemented.

Card initialization persists its owner/reference before the provider call. If confirmation is uncertain, the app shows the reference and status lookup rather than resubmitting that intent. A lost checkout URL or process interruption may require support to inspect the reference; no automatic cancellation or timeout refund is claimed.

## Prepare Flutterwave

Official references: [bank transfers](https://developer.flutterwave.com/docs/bank-transfers), [API reference](https://developer.flutterwave.com/reference). This implementation uses V3 REST endpoints `/banks/{country}`, bank branches, `/transfers/rates`, `/transfers/fee`, `/transfers`, and verification by ID/reference.

Configure fiat:

```dotenv
FLUTTERWAVE_ENABLED=false
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_ENABLED_COUNTRIES=
```

Prepared payout currencies/countries: NG/NGN, GH/GHS, KE/KES, UG/UGX, TZ/TZS, RW/RWF, ZA/ZAR and ZM/ZMW. These are candidates, not a coverage guarantee. Activate only country codes your Flutterwave account is approved to pay; the provider bank list is authoritative. Beneficiaries receive local currency from a NGN source wallet. Tier 2 and a verified phone/name are required.

Before enabling, test the actual account's bank/branch metadata, sender fields, source/destination amounts, fees, rate movement and payout status payloads. Current code deliberately rejects rates that do not confirm the requested NGN source amount. Settlement requires exact reference/currency/destination amount and a `debit_amount` matching the authorized NGN total. A missing or mismatched debit remains processing for review. V3 rate lookup is not a guaranteed locked FX quote; this adapter needs account-specific contract validation before live availability. Uncertain submissions require provider/operator reconciliation. No incoming African bank-account integration was added through Flutterwave.

## Prepare Fireblocks

Official references: [developer portal](https://developers.fireblocks.com/), [official TypeScript SDK](https://github.com/fireblocks/ts-sdk). The adapter uses `@fireblocks/ts-sdk` for vaults, addresses, validation, network-fee estimates, transfers and completed-deposit reconciliation.

Configure fiat with `FIREBLOCKS_API_KEY`, PEM `FIREBLOCKS_SECRET_KEY` and the correct workspace `FIREBLOCKS_BASE_PATH`. Keep `FIREBLOCKS_ENABLED=false` until the workspace, custody policy and network mapping are verified. The four `FIREBLOCKS_ASSET_*` defaults are BTC, ETH, SOL and BNB_BSC. Do not substitute a test-network asset ID while displaying a main-network deposit label; test networks must be tested in an isolated environment with explicit matching labels.

Tier 2 is required. Vaults are mapped per user, addresses per asset/network, and provider-confirmed deposits are credited once at up to 18-digit precision. Each quote authorizes a gross wallet debit including the network fee; the recipient receives the debit less actual fee. A mined failure retains consumed gas and refunds the unspent amount. External transaction IDs support provider reconciliation.

Before enabling, verify vault/address recovery after interruption, supported asset IDs and decimals, custody balances/policies, fee currency, provider rejection handling, and deposit/outgoing confirmations on all four networks. Polling is implemented; no Fireblocks webhook integration or real custody transaction was tested. Uncertain/rejected submissions without a retrievable provider transaction may require operator resolution.

## Prepare Prembly

Official references: [Prembly documentation](https://docs.prembly.com/), [Identitypass Node SDK](https://github.com/Identitypass/identitypass-nodejs). The account's supported URL/schema must be confirmed with Prembly; current documentation contains a placeholder server URL.

Configure auth with `PREMBLY_API_KEY`, any required `PREMBLY_APP_ID`, `PREMBLY_API_BASE_URL` (actual HTTPS base including trailing slash), `PREMBLY_API_FORMAT`, and a dedicated stable `PREMBLY_IDENTITY_HASH_KEY` of at least 32 characters. Keep `PREMBLY_ENABLED=false` until compatibility is tested. `PREMBLY_ENVIRONMENT=live` is required to grant production tiers.

- `current_v1`: documented path suffixes `bvn_w_face/`, `nin_w_face/`, `liveliness_check/`, relative to the account-confirmed base URL. Do not use the example.com server from the docs.
- `legacy_v2`: official legacy SDK base `https://api.myidentitypay.com/api/v2/biometrics/merchant/`; relative paths `data/verification/bvn_w_face`, `data/verification/nin`, `face/liveliness_check`. Confirm NIN face evidence is present for your account; absence fails verification.

The app captures a camera selfie and consent. Identity number, names, date of birth, explicit face match and liveness confidence must agree; HTTP success alone grants no tier. BVN grants Tier 1; NIN after BVN grants Tier 2. Raw identity numbers/selfies are not persisted; masked identifiers, keyed hashes and a proof summary are retained. Do not rotate the identity hash key without a migration plan. Test real consent/face/liveness decisions and review the verification/privacy policy before enabling.

## Notifications and account limits

Persisted in-app notifications and a PostgreSQL push outbox are implemented. Configure EAS/FCM Android push credentials; set `EXPO_ACCESS_TOKEN` if enhanced Expo push security is enabled. Test permission, token registration, logout and delivery on a device. Push tickets are stored, but receipt polling/delivery confirmation remains unimplemented. A push ticket does not prove delivery.

The backend enforces Nigeria-calendar-day outgoing NGN limits: Tier 0 ₦20,000/day and per payment; Tier 1 ₦1,000,000/day and per payment; Tier 2 ₦10,000,000/day and ₦1,000,000 per payment, including fees. These use the stricter limits in the repository security requirements and still need product/provider approval. The documented Tier 0 ₦100,000 balance cap is returned by the limits API but is not universally enforced on credits; a hold/review policy for external deposits and refunds remains needed before accepting unverified-user funding. Current provider funding/provisioning requires Tier 1.

## Validate and install the APK

From the repository root:

```bash
npm run type-check
npm run build --workspace=@lightpay/auth-service
npm run build --workspace=@lightpay/fiat-service
npm run build --workspace=@lightpay/gateway
npm run test:integration
```

Database regression tests run only when `LIGHTPAY_TEST_DATABASE_URL` points at an isolated PostgreSQL test host with permission to create/drop a uniquely named `lightpay_test_*` database. They do not use a production database. Tests without that variable skip database cases.

Build the Android installable APK with EAS:

```bash
cd apps/mobile
eas build --platform android --profile production-apk --non-interactive
```

`production-apk` embeds `EXPO_PUBLIC_API_URL=https://api.lightpay.ng/api/v1` and increments the Android version code. Install the resulting APK on the device, then check cold launch, sign-in/session recovery, PIN, back navigation, camera/KYC/QR, biometrics, sharing, push and connectivity. Browser UI mocks and Hermes export checks do not replace installed-device or provider-account validation. Blank LightPay launcher/splash artwork still needs approved branding.

The completed version-code-6 APK is available [here](https://expo.dev/artifacts/eas/Ug-_87MOk0aEsVI61VnnjcxWMMji17LtTj02N27Us9Q.apk). It contains the mobile changes and production API URL; installing it does not deploy the backend or activate providers.
