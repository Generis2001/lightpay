# LightPay deployment and provider setup

Updated 10 November 2026. The free Render backend is deployed at https://lightpay-backend-yfva.onrender.com. Render confirms cumulative release commit `f75f587` is live as deployment `dep-dbp8esqvcj2c73cseh7g`, including the earlier email case-normalization fix `8f862c0` and the retirement of server custody. Its public `/api/v1/health` returned HTTP 200 with `{"status":"ready"}`, confirming both auth and fiat can query PostgreSQL. Brevo's private REST key and verified sender are configured on Render. Real email receipt, account creation, PIN setup, logout, fresh sign-in, authenticated profile and NGN-wallet access passed; see `output/live-auth-verification.json`. APK v8, version 1.1.0, includes device crypto wallets and the lightning-L launcher/splash and passed artifact verification. Financial-provider payments and installed-device behavior remain unverified.

## PostgreSQL URL

Auth and fiat need **the same PostgreSQL database**, with separate `auth` and `fiat` schemas. Fiat reads authoritative identity tiers and device sessions from auth tables. The gateway and mobile app do not connect to PostgreSQL.

Set `DATABASE_URL` in the private environment settings of **both** backend services:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/lightpay
```

This is a format example, not a working connection. Obtain the actual URL from your database host. Percent-encode reserved characters in the username/password when assembling a URL yourself. Keep it out of source control, chat, `EXPO_PUBLIC_*`, and the APK.

The [Render blueprint](render.yaml) reuses the existing `generis-postgresql-lightpay` database, PostgreSQL 18 in Oregon, through the `lightpay-database` environment group in Lightpay's Production environment. It does not provision another database. The group contains the existing **Internal Database URL**, `DATABASE_SSL=true`, and `DATABASE_SSL_REJECT_UNAUTHORIZED=false`; both private services import it. [Render documents](https://render.com/docs/postgresql-creating-connecting#ssl-modes-for-internal-connections) that internal TLS uses self-signed certificates, so this internal-only trust setting retains encryption while accepting the provider's certificate. Use the internal URL only for Render services in the same region.

Local ignored `.env.local` files in the root, auth, and fiat directories hold the **External Database URL** with TLS and certificate verification enabled. `.env.render.local` holds the internal URL and its internal-TLS settings. All four credential files have owner-only permissions. The external connection check from this machine timed out, but Render startup applied the migrations and its public aggregate health check now confirms live SQL connectivity from both services. With another database host, update the group or private settings to that host's URL and documented TLS settings. Use a direct PostgreSQL connection or session pooler for migrations and reconciliation; a transaction pooler is incompatible with the session advisory locks used here.

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
3. Set `NODE_ENV=production` and `DB_SYNCHRONIZE=false`. Keep Flutterwave and
   Prembly disabled until provider credentials and account behavior are verified.
   Legacy Fireblocks custody is retired and cannot be enabled by its old settings.
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
| Brevo | Email OTP on the free plan | `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, verified `FROM_EMAIL` |
| SendGrid | Alternative email OTP | `EMAIL_PROVIDER=sendgrid`, `SENDGRID_API_KEY`, verified `FROM_EMAIL` |

Payment and identity-provider credentials are still absent; the database-only local environment files do not activate those providers. Paystack setup is being completed separately. Paystack receiving accounts/card funding require Tier 1 and a verified email/full name. The only receiving bank-account integration is Nigerian NGN. USD wallets/cards/FX and incoming accounts across African countries are still unimplemented.

Card initialization persists its owner/reference before the provider call. If confirmation is uncertain, the app shows the reference and status lookup rather than resubmitting that intent. A lost checkout URL or process interruption may require support to inspect the reference; no automatic cancellation or timeout refund is claimed.

## Free email OTP with Brevo

The account's Free plan shows 300 transactional emails per day. This covers email
verification; Brevo SMS is not included. The verified sender currently available is
`generisemmanuel@gmail.com`, named Lightpay. Brevo flags its Gmail domain as a
freemail sender; a custom authenticated domain can improve deliverability later.

The Brevo REST API key is configured privately and the sender is verified. A
Brevo MCP key is not needed by the app. For future rotation, create a REST key
permitted to send transactional email, update the host's private settings, and
redeploy. Brevo also expires keys after 90 days of inactivity.

Add these values in the private environment settings of `lightpay-backend`:

```dotenv
EMAIL_PROVIDER=brevo
BREVO_API_KEY=YOUR_PRIVATE_BREVO_KEY
FROM_EMAIL=generisemmanuel@gmail.com
```

Keep the real key out of Git, chat, and mobile/public environment variables. After
Render deploys the private settings, use **Email** on the APK's registration/login screen.
Verify actual receipt, successful OTP verification, and rejection of reuse. The
backend accepts Brevo's send acknowledgement and returns 503 while removing the
issued challenge when delivery is rejected, times out, or lacks acknowledgement.
Real registration and login emails have been received and verified. The live
checks also covered initial PIN setup, logout, retained PIN on fresh login,
access/refresh token issuance, `/auth/me` and `/wallets`. Email case and surrounding
spaces are normalized before OTP issuance, verification, creation and lookup.
SMS/Termii delivery and authentication on an installed native device remain
unverified. Fixture tests separately confirm that OTP reuse and delivery failures
are rejected.

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

## Device crypto wallets

Users create a 24-word English BIP39 wallet or import a valid recovery phrase in
the app. Recovery passphrases are supported for imports. There is one wallet per
LightPay account on each device; the recovery phrase restores it independently of
the account. Native vaults use AES-256-GCM with PBKDF2-SHA256 (600,000 iterations)
and a wallet password of at least 12 characters. Encrypted vaults and receiving
metadata use device-only SecureStore. Web previews keep encrypted vaults in local
storage. Recovery phrases and signing keys are never sent to the backend or RPCs.
Encrypted records are limited to SecureStore's 2 KB value limit. An oversized
recovery passphrase is rejected before the wallet is saved; it must be restored
in another compatible wallet that supports its length.

| Network | Supported account |
| --- | --- |
| Bitcoin mainnet | BIP84 SegWit account 0, `m/84'/0'/0'/0/0` initially; receiving/change discovery with gap 20 and limit 200 per branch |
| Ethereum mainnet | First account, `m/44'/60'/0'/0/0` |
| BNB Smart Chain | Same first EVM account, chain ID 56 |
| Solana mainnet | SLIP-0010 Ed25519, `m/44'/501'/0'/0'` |

Optional `EXPO_PUBLIC_BITCOIN_API_URL`, `EXPO_PUBLIC_ETHEREUM_RPC_URL`,
`EXPO_PUBLIC_SOLANA_RPC_URL` and `EXPO_PUBLIC_BNB_RPC_URL` configure public HTTPS
connections. The defaults use Blockstream and PublicNode. Mainnet genesis/chain
checks run before balance reads, signing, broadcast and confirmation. No paid
custody service or secret RPC key is required by these defaults; their public
availability and quotas still apply.

Review shows the actual recipient amount and network fee, then requests the
wallet password for local signing. The exact signed transaction is persisted
before broadcasting. An uncertain submission blocks a new send on that network;
retry validates its saved details and reuses the same signed bytes/hash. The app
clears recovery/password fields on blur or background, and returning to the app
cannot revive an operation begun before it locked. Native sensitive screens
request screenshot prevention.

Back up the phrase and any recovery passphrase before uninstalling, changing
devices, or removing a wallet. LightPay cannot recover a lost phrase or reset a
wallet password. Password changes re-encrypt the same wallet; explicitly
confirmed device removal does not move blockchain funds. Imported account paths
other than those above, tokens, swap/bridge and crypto-to-cash are not supported.
History currently records transfers made on this device, rather than full
imported chain history. Indefinitely unconfirmed Bitcoin/EVM submissions can
require inspection or recovery in another compatible wallet.

The backend's legacy custody routes return HTTP 410. Its compatibility manifest
marks custody disabled, and the module starts no Fireblocks provider, service or
poller, regardless of old `FIREBLOCKS_*` settings. Historical source/schema are
retained for compatibility; server ledger entries are not device-wallet balances.
Funded on-chain sends and installed-device secure storage/recovery remain to be
verified separately from fixture signing tests and Android export checks.

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

`production-apk` embeds `EXPO_PUBLIC_API_URL=https://lightpay-backend-yfva.onrender.com/api/v1` and increments the Android version code. APK v8 is version 1.1.0 with Android version code 8, built from commit `f75f587` by EAS build `1e31055c-a70f-4d1a-b994-772b61cc3704`. It includes the lightning-L launcher/splash assets, wallet creation/import and the native encoding setup. It uses Expo SDK 54 / React Native 0.81 and targets Android 16 (API 36), retaining compressed native-library extraction. Its ZIP, v2 signature, signed content digests, API URL, launcher/adaptive/splash references and 64-bit 16 KB ELF alignment passed verification. The signing certificate matches v7. See `output/lightpay-v8-verification.json` and `output/lightpay-v8.sha256`. API requests allow 90 seconds for the free backend to wake up. Version code 6 had 4 KB ARM64 ELF alignment and failed to install on the reported Redmi Note 14 Pro / Android 16; the precise device-specific cause was not confirmed.

Use the current APK linked in [artifact notes](output/README.md), then check cold
launch/logo, email sign-in, PIN, back navigation, wallet backup/import/password,
camera/KYC/QR, biometrics, sharing, push and connectivity. Installation on the
reported device remains untested. Browser UI checks, fixture signing and Hermes
export do not replace installed-device or funded/provider-account validation.

Live release checks also confirmed session refresh, authenticated profile and NGN-wallet access (HTTP 200), a disabled custody manifest, and legacy custody provisioning/quotes returning HTTP 410. `output/backend-deployment-verification.json` records these results without credentials; no financial transaction was executed.
