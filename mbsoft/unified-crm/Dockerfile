# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-bookworm-slim
ARG NPM_REGISTRY=https://registry.npmmirror.com/

FROM ${NODE_IMAGE} AS base
ARG NPM_REGISTRY
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    npm_config_registry=${NPM_REGISTRY} \
    PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.23.0

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
ENV DATABASE_URL=postgresql://build:build@db:5432/build
RUN pnpm --filter @ucrm/db exec prisma generate --schema prisma/schema.postgres.prisma \
    && pnpm build

FROM ${NODE_IMAGE} AS runner
ARG NPM_REGISTRY
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid 1001 nextjs \
    && mkdir -p /home/nextjs \
    && chown nextjs:nodejs /home/nextjs \
    && npm install prisma@7.6.0 dotenv@17.3.1 --no-save --registry=${NPM_REGISTRY}
ENV NODE_ENV=production \
    HOME=/home/nextjs \
    PORT=81 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/packages/db/prisma ./packages/db/prisma
COPY --from=build --chown=nextjs:nodejs /app/packages/db/prisma.config.ts ./packages/db/prisma.config.ts
COPY --chown=nextjs:nodejs docker-wait.js ./docker-wait.js
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER nextjs
EXPOSE 81
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
