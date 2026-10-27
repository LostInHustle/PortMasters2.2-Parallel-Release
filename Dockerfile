# PortMasters 2.2 Parallel Release, container image.
#
# The image carries the production Next.js build and the whole source tree
# that server.ts runs from, because the game process is a custom Node
# server with Socket.IO attached rather than a Next.js standalone server.
# Litestream rides in the same image and wraps the process so the SQLite
# file is restored before the game opens it and replicated while it runs.
#
# Wrangler builds this image for linux/amd64. `npm run cf:image` passes the
# same platform for a local build on a machine of another architecture.

FROM node:22-bookworm-slim AS base

# Prisma's SQLite engine links against OpenSSL, and Litestream needs the CA
# bundle to reach R2 over HTTPS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# The Litestream binary is taken from the project's own published image,
# pinned to the version this configuration was written against.
FROM litestream/litestream:0.5.17 AS litestream

# The twelve Ocean Gambit switches are read twice: Next inlines them into
# the client bundle at build time, and server code reads them from the
# environment at runtime. Declaring them once here and inheriting this
# stage into both the builder and the runtime is what keeps those two
# halves from disagreeing. image_vars in wrangler.jsonc overrides an
# argument when a switch has to ship off.
FROM base AS flags

ARG NEXT_PUBLIC_SURVIVAL=1
ARG NEXT_PUBLIC_CREW_LOSS=1
ARG NEXT_PUBLIC_GARMENTS=1
ARG NEXT_PUBLIC_SPLIT_HOLD=1
ARG NEXT_PUBLIC_PATH_ORDERS=1
ARG NEXT_PUBLIC_ESCORT_CONTRACTS=1
ARG NEXT_PUBLIC_REFITS=1
ARG NEXT_PUBLIC_MODULE_TRADES=1
ARG NEXT_PUBLIC_BAZAAR=1
ARG NEXT_PUBLIC_PATH_DRAFT=1
ARG NEXT_PUBLIC_MILESTONE_BOONS=1
ARG NEXT_PUBLIC_CHARTERS=1

ENV NEXT_PUBLIC_SURVIVAL=${NEXT_PUBLIC_SURVIVAL} \
    NEXT_PUBLIC_CREW_LOSS=${NEXT_PUBLIC_CREW_LOSS} \
    NEXT_PUBLIC_GARMENTS=${NEXT_PUBLIC_GARMENTS} \
    NEXT_PUBLIC_SPLIT_HOLD=${NEXT_PUBLIC_SPLIT_HOLD} \
    NEXT_PUBLIC_PATH_ORDERS=${NEXT_PUBLIC_PATH_ORDERS} \
    NEXT_PUBLIC_ESCORT_CONTRACTS=${NEXT_PUBLIC_ESCORT_CONTRACTS} \
    NEXT_PUBLIC_REFITS=${NEXT_PUBLIC_REFITS} \
    NEXT_PUBLIC_MODULE_TRADES=${NEXT_PUBLIC_MODULE_TRADES} \
    NEXT_PUBLIC_BAZAAR=${NEXT_PUBLIC_BAZAAR} \
    NEXT_PUBLIC_PATH_DRAFT=${NEXT_PUBLIC_PATH_DRAFT} \
    NEXT_PUBLIC_MILESTONE_BOONS=${NEXT_PUBLIC_MILESTONE_BOONS} \
    NEXT_PUBLIC_CHARTERS=${NEXT_PUBLIC_CHARTERS}

# Dependencies first, so a source edit does not reinstall the tree. The
# schema is copied before the install because the Prisma client package
# looks for it while it sets itself up.
FROM flags AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --include=dev

# The production build. `npm run build` runs the tag, card, status, dead
# surface, prose, palette and private gates before it compiles a page, so
# an image cannot be built from a tree those gates reject. The database URL
# is a throwaway path: nothing in the build writes a database.
FROM deps AS builder

WORKDIR /app

ENV DATABASE_URL="file:/tmp/build.db" \
    NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN npm run build

# The runtime tree is copied from the builder rather than installed again,
# so the Prisma client, the Next.js build and the tsx that starts the
# process are exactly the ones the build used. Development dependencies
# stay in the image on purpose: tsx, the Prisma CLI and the Next.js
# production server all run from this source tree.
FROM flags AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATABASE_URL="file:/app/db/custom.db" \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/server.ts ./server.ts
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --chown=node:node cloudflare/entrypoint.sh /app/cloudflare/entrypoint.sh
COPY --chown=node:node cloudflare/run-server.sh /app/cloudflare/run-server.sh
COPY --chown=node:node cloudflare/litestream.yml /etc/litestream.yml
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream

RUN chmod 755 /app/cloudflare/entrypoint.sh /app/cloudflare/run-server.sh \
 && mkdir -p /app/db \
 && chown -R node:node /app /etc/litestream.yml

USER node

EXPOSE 8080

ENTRYPOINT ["/app/cloudflare/entrypoint.sh"]
