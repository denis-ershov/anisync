# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml)

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --filter @anisync/web... --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ARG NEXT_PUBLIC_BASE_URL=http://localhost:9002
ARG NEXT_PUBLIC_RELEASES_MODULE_ENABLED=true
ARG NEXT_PUBLIC_TORRENTS_MODULE_ENABLED=true
ARG NEXT_PUBLIC_REGISTRATION_OPEN=true
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_RELEASES_MODULE_ENABLED=$NEXT_PUBLIC_RELEASES_MODULE_ENABLED
ENV NEXT_PUBLIC_TORRENTS_MODULE_ENABLED=$NEXT_PUBLIC_TORRENTS_MODULE_ENABLED
ENV NEXT_PUBLIC_REGISTRATION_OPEN=$NEXT_PUBLIC_REGISTRATION_OPEN
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web ./apps/web
# Keep app-local zod v3; root may hoist a newer zod for serwist.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders so config.ts can import during `next build`; real secrets at runtime.
ENV APP_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV JWT_SECRET=build-time-placeholder-min-16
ENV CRON_SECRET=build-time-placeholder-min-16
ENV INTERNAL_SERVICE_SECRET=build-time-placeholder-min-16
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Monorepo standalone layout: server.js lives under apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/drizzle ./apps/web/drizzle
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/scripts ./apps/web/scripts
COPY --from=builder /app/apps/web/src ./apps/web/src
COPY --from=builder /app/apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

USER nextjs
WORKDIR /app/apps/web
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
