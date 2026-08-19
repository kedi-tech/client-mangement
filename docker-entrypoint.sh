#!/bin/sh
# Applies any pending database migrations, then starts the server.
#
# `migrate deploy` only ever plays forward the migrations committed in
# prisma/migrations — it never generates, resets or drops anything, so it is safe
# to run on every boot and on every replica. It is also idempotent, so retrying
# it is how we wait for Postgres: on a cold `docker compose up` the database may
# still be starting, and a crash-loop would be a worse way to find out.
set -eu

PRISMA="node /opt/prisma/node_modules/prisma/build/index.js"
SCHEMA="./prisma/schema.prisma"
max_attempts="${MIGRATE_MAX_ATTEMPTS:-30}"
attempt=1

echo "==> Applying database migrations"
while : ; do
  if $PRISMA migrate deploy --schema "$SCHEMA"; then
    break
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "!!! Migrations failed after ${attempt} attempts — giving up." >&2
    exit 1
  fi

  echo "    attempt ${attempt}/${max_attempts} failed (database may still be starting); retrying in 2s"
  attempt=$((attempt + 1))
  sleep 2
done

echo "==> Starting the application"
exec "$@"
