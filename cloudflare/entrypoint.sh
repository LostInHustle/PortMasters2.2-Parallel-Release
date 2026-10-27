#!/bin/sh
# PortMasters 2.2 Parallel Release: container entry point.
#
# Litestream owns the process. It restores the database when this boot has
# no local file, runs the game as its child, and replicates the SQLite file
# while the game runs. On SIGTERM it forwards the signal to the child, waits
# for it to close, and performs a final sync before it exits.
#
# `set -u` is deliberate: a missing DATABASE_URL stops the boot instead of
# starting a game that writes somewhere nobody expects.

set -eu

: "${DATABASE_URL:?DATABASE_URL is not set}"

case "$DATABASE_URL" in
  file:*) ;;
  *)
    echo "entrypoint: DATABASE_URL must start with file:" >&2
    exit 1
    ;;
esac

DATABASE_PATH="${DATABASE_URL#file:}"
export DATABASE_PATH
mkdir -p "$(dirname "$DATABASE_PATH")"

# A zero byte file is what an interrupted first start leaves behind, and
# Litestream reads an existing file as a database, so it would never
# restore over it. Remove it and its sidecars so the next start restores.
if [ ! -s "$DATABASE_PATH" ]; then
  rm -f "$DATABASE_PATH" "$DATABASE_PATH-wal" "$DATABASE_PATH-shm"
fi

LITESTREAM_ENABLED="${LITESTREAM_ENABLED:-1}"

# Local image testing only. Production runs with replication on.
if [ "$LITESTREAM_ENABLED" = "0" ]; then
  exec /app/cloudflare/run-server.sh
fi

# Treat an empty value as missing: a var set to the empty string is the
# same half configured deployment as one that was never set.
for name in LITESTREAM_BUCKET LITESTREAM_ENDPOINT LITESTREAM_ACCESS_KEY_ID LITESTREAM_SECRET_ACCESS_KEY; do
  if [ -z "$(printenv "$name" || true)" ]; then
    echo "entrypoint: $name is missing" >&2
    exit 1
  fi
done

exec litestream replicate \
  -config /etc/litestream.yml \
  -restore-if-db-not-exists \
  -exec /app/cloudflare/run-server.sh
