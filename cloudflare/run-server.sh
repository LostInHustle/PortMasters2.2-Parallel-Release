#!/bin/sh
# The child process Litestream runs, and the same script the local no
# Litestream path runs. The migration happens after any restore and before
# the game opens the database, so the schema is current on both a fresh
# file and a restored one.
#
# Migrations, never `prisma db push`: Litestream keeps its own tables in
# this same SQLite file, and db push would read them as drift.

set -eu

/app/node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma
exec /app/node_modules/.bin/tsx /app/server.ts
