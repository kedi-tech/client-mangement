# syntax=docker/dockerfile:1

# Multi-stage build producing a small, non-root runtime image.
#
#   deps     – node_modules for building (includes devDependencies)
#   builder  – `next build` with output:"standalone"
#   migrator – the Prisma CLI on its own, so the runtime image can apply
#              migrations at boot without shipping every devDependency
#   runner   – the image that actually ships
#
# Build:  docker build -t kediclient .
# Run:    see docker-compose.yml

ARG NODE_VERSION=22-alpine
# Keep in step with the `prisma` devDependency in package.json.
ARG PRISMA_VERSION=6.19.3

# --------------------------------------------------------------------- deps --
FROM node:${NODE_VERSION} AS deps
# Prisma's query engine is linked against OpenSSL, which is not in the base image.
RUN apk add --no-cache openssl
WORKDIR /app

# The schema is copied first because `postinstall` runs `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ------------------------------------------------------------------ builder --
FROM node:${NODE_VERSION} AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `next build` never opens a connection, but Prisma refuses to load a schema
# whose datasource URL has the wrong protocol. This value is not baked into the
# image — the real one arrives through the environment at run time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ----------------------------------------------------------------- migrator --
# The Prisma CLI, installed on its own so the runtime image can run
# `migrate deploy` without carrying the whole build toolchain.
FROM node:${NODE_VERSION} AS migrator
ARG PRISMA_VERSION
RUN apk add --no-cache openssl
WORKDIR /migrator
RUN npm install --no-save --no-package-lock prisma@${PRISMA_VERSION}

# ------------------------------------------------------------------- runner --
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Written to a mounted volume; see docker-compose.yml.
ENV UPLOAD_DIR=/data/uploads

# Run as an unprivileged user. `node` (uid 1000) already exists in the base image.
RUN mkdir -p /data/uploads && chown -R node:node /data

# The standalone bundle carries its own minimal node_modules and server.js.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# The standalone bundle does not include public/, so static brand assets have to
# be copied explicitly or they 404 in production.
COPY --from=builder --chown=node:node /app/public ./public

# Migrations plus the CLI that applies them.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=migrator --chown=node:node /migrator/node_modules /opt/prisma/node_modules

COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3000
VOLUME ["/data/uploads"]

# Compose overrides this with its own healthcheck; this one covers `docker run`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
