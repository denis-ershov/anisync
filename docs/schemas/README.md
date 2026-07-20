# Schema snapshots (`docs/schemas/`)

| Файл | Источник |
|------|----------|
| `anisync.sql` | Конкатенация `apps/web/drizzle/0000`…`0005` |
| `anisync-live.sql` | Live introspect prod `anisync` (2026-07-20, после `drizzle migrate`) |
| `nightwatcher.sql` | `services/nightwatcher/migrations/init.sql` |
| `nightwatcher-live.sql` | — (host NW с этой машины timeout; повторить при доступе) |
| `ontrash.sql` | NextScene bootstrap + Drizzle |

Live dump: `pnpm exec tsx scripts/inspect-prod-dbs.ts`  
Миграции AniSync: `pnpm exec tsx scripts/probe-anisync-db.ts --migrate`  
Сверка данных: `pnpm exec tsx scripts/migrate-verify-counts.ts`
