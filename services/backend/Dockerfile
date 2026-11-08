# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY apps/mobile/package.json apps/mobile/
COPY services/auth/package.json services/auth/
COPY services/fiat/package.json services/fiat/
COPY services/gateway/package.json services/gateway/
RUN npm ci --workspace=@lightpay/auth-service --workspace=@lightpay/fiat-service --workspace=@lightpay/gateway --include-workspace-root
COPY packages/types packages/types
COPY services services
RUN npm run build --workspace=@lightpay/auth-service --workspace=@lightpay/fiat-service --workspace=@lightpay/gateway
RUN npm prune --omit=dev --workspace=@lightpay/auth-service --workspace=@lightpay/fiat-service --workspace=@lightpay/gateway --include-workspace-root

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/services ./services
COPY infra/start-backend.cjs infra/start-backend.cjs
EXPOSE 10000
CMD ["node", "--max-old-space-size=32", "infra/start-backend.cjs"]
