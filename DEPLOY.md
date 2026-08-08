# LightPay backend — production go-live (Render)

This is the step-by-step checklist to take the backend live on [Render](https://render.com)
using the blueprint in [`render.yaml`](./render.yaml). Everything the blueprint
provisions is defined there; this doc covers the manual steps Render can't do for you
(secrets, one-time DB setup, DNS).

## What gets deployed

| Component | Render type | Port | Public? |
|-----------|-------------|------|---------|
| `lightpay-gateway` | web (docker) | 3000 | ✅ yes |
| `lightpay-auth`    | pserv (docker) | 3001 | private |
| `lightpay-fiat`    | pserv (docker) | 3002 | private |
| `lightpay-postgres`| managed Postgres 16 | — | private |
| `lightpay-redis`   | keyvalue (Redis) | — | private |

The gateway is the only public entrypoint; it reverse-proxies to auth and fiat over
Render's private network. The `crypto`, `kyc`, and `notifications` services are **not**
deployed — they have no source yet, and the gateway skips their proxy routes when the
service URL is unset.

## Prerequisites

- A Render account with this repo connected.
- Live secret values ready to paste (see Step 2). These are **not** in git.

## Step 1 — create the blueprint

1. Render dashboard → **New → Blueprint**.
2. Select this repo/branch. Render reads `render.yaml` and shows the resources above.
3. Click **Apply**. Render provisions Postgres, Redis, and the three services.
   The first build will pull dependencies and compile each service in its Docker image.

## Step 2 — set the secret env vars (`sync: false`)

These are blank until you set them in the dashboard (each service → **Environment**):

- **All three services** — `JWT_SECRET`: generate one strong value and paste the
  **same** string into gateway, auth, and fiat. Tokens won't validate across services otherwise.
- **auth** — `TERMII_API_KEY` (SMS OTP), `SENDGRID_API_KEY` (email OTP).
  OTP delivery fails closed if these are unset, so set them before go-live.
- **fiat** — `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `VTPASS_API_KEY`,
  `VTPASS_PUBLIC_KEY`, `VTPASS_SECRET_KEY`. Live keys; fiat uses the live VTpass
  endpoint when `NODE_ENV=production`.

## Step 3 — one-time database setup

The entities live in dedicated `auth` and `fiat` Postgres schemas and use
`@PrimaryGeneratedColumn('uuid')`, which needs the `uuid-ossp` extension. TypeORM's
`synchronize` creates **tables** but **not** the schemas or the extension — create those
once, before the first boot. Open the DB's PSQL shell (Render dashboard → the
Postgres instance → **Connect → PSQL**) and run:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS fiat;
```

## Step 4 — first boot creates the tables

`DB_SYNCHRONIZE=true` is set on auth and fiat in the blueprint for the **first** deploy.
On boot, TypeORM builds all tables inside the schemas from Step 3. Confirm both services
reach a running state in the Render logs.

## Step 5 — lock the schema (important)

There are **no migrations** in this repo, so `synchronize` is the only schema tool —
and leaving it on in steady state lets TypeORM auto-alter tables on every deploy, which
can drop columns/data. Once the tables exist:

1. Set `DB_SYNCHRONIZE=false` on both `lightpay-auth` and `lightpay-fiat`.
2. Redeploy both.

From then on, schema changes require either adding TypeORM migrations or a manual,
reviewed `synchronize` window.

## Step 6 — point the app at the gateway

The mobile app calls `https://api.lightpay.ng/api/v1` (see `apps/mobile/eas.json`).
In Render, add `api.lightpay.ng` as a **custom domain** on `lightpay-gateway` and create
the CNAME record Render shows at your DNS provider. Until DNS resolves, use the
`onrender.com` URL Render assigns the gateway.

## Recommended follow-ups (not blockers)

- **Health endpoints.** Neither the gateway nor auth exposes an unauthenticated health
  route, so the blueprint has no `healthCheckPath` (Render falls back to a TCP port
  check). Add `GET /health` to the gateway and auth, then set `healthCheckPath` for
  faster, more accurate health detection.
- **Migrations.** Replace `synchronize` with TypeORM migrations for safe schema evolution.
- **Redis type name.** The blueprint uses `type: keyvalue` (Render's current name for
  Redis). If your account still shows the older `type: redis`, rename it in `render.yaml`.

## Mobile APK

The Android APK is built with EAS using the `production-apk` profile
(`EXPO_PUBLIC_API_URL=https://api.lightpay.ng/api/v1`). Build with:

```bash
cd apps/mobile && eas build --platform android --profile production-apk
```

The build runs on EAS servers; the install/download link appears when it finishes.
