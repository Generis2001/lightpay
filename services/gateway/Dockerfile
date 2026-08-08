# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root (npm workspaces).
# Build:  docker build -f services/gateway/Dockerfile -t lightpay-gateway .

# ── builder ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY services/gateway/package.json services/gateway/
RUN npm ci

COPY packages/types packages/types
COPY services/gateway services/gateway
RUN npm run build --workspace=@lightpay/gateway

RUN npm prune --omit=dev

# ── runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/services/gateway/dist ./services/gateway/dist
COPY --from=builder /repo/services/gateway/package.json ./services/gateway/

WORKDIR /repo/services/gateway
EXPOSE 3000
CMD ["node", "dist/main"]
