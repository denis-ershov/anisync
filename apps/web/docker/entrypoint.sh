#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations..."
  node --import tsx src/lib/db/migrate.ts
fi

exec "$@"
