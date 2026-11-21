# syntax=docker/dockerfile:1
# ─── EMS backend (NestJS + Prisma) — production image ───────────────────────
# Debian slim (glibc) rather than Alpine so bcrypt and the Prisma query engine use
# their prebuilt binaries without a compiler toolchain.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema.
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# tini forwards SIGTERM so Nest's shutdown hooks run on `docker compose stop`.
ENTRYPOINT ["/usr/bin/tini", "--"]
# Apply any pending Prisma migrations (a no-op when the schema is current), then start.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/src/main.js"]
