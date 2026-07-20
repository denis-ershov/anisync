# Schema snapshots (`docs/schemas/`)

| Файл | Источник |
|------|----------|
| `anisync.sql` | Конкатенация Drizzle-миграций `apps/web/drizzle/0000`…текущая |
| `anisync-live.sql` | Live introspect прод-БД `anisync` (снимок после `drizzle migrate`) |

Обновить снимки:

```bash
# live dump прод-схемы
pnpm exec tsx scripts/inspect-prod-dbs.ts

# применить миграции AniSync
pnpm exec tsx scripts/probe-anisync-db.ts --migrate
```

Ops-скрипты: [scripts/README.md](../../scripts/README.md).
