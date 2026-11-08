# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root (npm workspaces + @lightpay/types source pkg).
# Build:  docker build -f services/fiat/Dockerfile -t lightpay-fiat .

# ── builder ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY apps/mobile/package.json apps/mobile/
COPY services/auth/package.json services/auth/
COPY services/fiat/package.json services/fiat/
COPY services/gateway/package.json services/gateway/
RUN npm ci --workspace=@lightpay/fiat-service --include-workspace-root

COPY packages/types packages/types
COPY services/fiat services/fiat
RUN npm run build --workspace=@lightpay/fiat-service

RUN npm prune --omit=dev --workspace=@lightpay/fiat-service --include-workspace-root

# ── runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/services/fiat ./services/fiat

WORKDIR /repo/services/fiat
EXPOSE 3002
CMD ["node", "dist/main"]
