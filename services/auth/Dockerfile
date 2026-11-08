# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root (npm workspaces + @lightpay/types source pkg).
# Build:  docker build -f services/auth/Dockerfile -t lightpay-auth .

# ── builder ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo

# Install deps against the full workspace graph (lockfile at root).
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY apps/mobile/package.json apps/mobile/
COPY services/auth/package.json services/auth/
COPY services/fiat/package.json services/fiat/
COPY services/gateway/package.json services/gateway/
RUN npm ci --workspace=@lightpay/auth-service --include-workspace-root

# Source needed to compile the auth service + its @lightpay/types dependency.
COPY packages/types packages/types
COPY services/auth services/auth
RUN npm run build --workspace=@lightpay/auth-service

# Prune dev dependencies for the runtime image.
RUN npm prune --omit=dev --workspace=@lightpay/auth-service --include-workspace-root

# ── runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/services/auth ./services/auth

WORKDIR /repo/services/auth
EXPOSE 3001
CMD ["node", "dist/main"]
