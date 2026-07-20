#!/bin/sh
set -e

if [ -z "${DATABASE_URL}" ]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

if [ -z "${JWT_SECRET}" ] || [ "${#JWT_SECRET}" -lt 16 ]; then
  echo "ERROR: JWT_SECRET is required (min 16 chars)" >&2
  exit 1
fi

# worker/scheduler требуют Redis (Coolify Database + predefined network)
if [ "${ANISYNC_PROCESS:-}" = "worker" ] || [ "${ANISYNC_PROCESS:-}" = "scheduler" ] || [ "$#" -gt 0 ]; then
  case "$*" in
    *worker*|*scheduler*)
      if [ -z "${REDIS_URL}" ]; then
        echo "ERROR: REDIS_URL is required (Coolify Redis internal URL)" >&2
        exit 1
      fi
      ;;
  esac
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations..."
  node --import tsx src/lib/db/migrate.ts
fi

exec "$@"
