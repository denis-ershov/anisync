# scripts/

Кросс-сервисные утилиты monorepo.

## OnTrash → AniSync migration

```bash
# 1) Users (writes scripts/.ontrash-user-map.json)
ONTRASH_DATABASE_URL=... DATABASE_URL=... pnpm exec tsx scripts/migrate-ontrash-users.ts --dry-run
ONTRASH_DATABASE_URL=... DATABASE_URL=... pnpm exec tsx scripts/migrate-ontrash-users.ts --apply

# 2) Watchlist
ONTRASH_DATABASE_URL=... DATABASE_URL=... pnpm exec tsx scripts/migrate-ontrash-watchlist.ts --dry-run
ONTRASH_DATABASE_URL=... DATABASE_URL=... pnpm exec tsx scripts/migrate-ontrash-watchlist.ts --apply
```

Политики:
- email: `{username}@ontrash.migrated`
- bcrypt hash копируется as-is
- коллизии username/email — skip + map на существующего

## NightWatcher watchlist migration

Копирует `imdb_watchlist` из legacy NW БД в текущую (monorepo) NW БД.
Целевая таблица AniSync `torrent_watchlist` — после cutover фазы 4; до неё данные живут в NW PG.

```bash
NW_SOURCE_DATABASE_URL=... NW_TARGET_DATABASE_URL=... \
  pnpm exec tsx scripts/migrate-nightwatcher-watchlist.ts --dry-run

NW_SOURCE_DATABASE_URL=... NW_TARGET_DATABASE_URL=... \
  pnpm exec tsx scripts/migrate-nightwatcher-watchlist.ts --apply

# optional remapping of user_id
NW_USER_MAP=scripts/.nw-user-map.json \
  NW_SOURCE_DATABASE_URL=... NW_TARGET_DATABASE_URL=... \
  pnpm exec tsx scripts/migrate-nightwatcher-watchlist.ts --dry-run
```

## Verify counts

После dry-run/apply:

```bash
ONTRASH_DATABASE_URL=... DATABASE_URL=... \
  pnpm exec tsx scripts/migrate-verify-counts.ts

NW_SOURCE_DATABASE_URL=... NW_TARGET_DATABASE_URL=... \
  pnpm exec tsx scripts/migrate-verify-counts.ts
```

## Prod DB helpers

```bash
# inspect + live schema dump
pnpm exec tsx scripts/inspect-prod-dbs.ts

# apply drizzle migrations to DATABASE_URL from .env
pnpm exec tsx scripts/probe-anisync-db.ts --migrate

# bootstrap admin when users table empty
BOOTSTRAP_ADMIN_PASSWORD='...' pnpm exec tsx scripts/seed-bootstrap-admin.ts

# promote existing user to admin
pnpm exec tsx scripts/promote-admin.ts --username yourname
```

Schema parity (code-only): `docs/SCHEMA_PARITY.md`.

Admin UI: `/settings/admin/import` (требует `role=admin` + опционально `ONTRASH_DATABASE_URL`).

App workers: `apps/web/scripts/worker.ts`, `scheduler.ts`.
