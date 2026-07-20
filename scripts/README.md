# scripts/

Ops-утилиты уровня монорепо (не входят в пакет `@anisync/web`). Запускаются через `pnpm exec tsx scripts/<file>.ts` из корня репозитория, используют `DATABASE_URL` из окружения/`.env`.

Раннеры приложения (`worker.ts`, `scheduler.ts`, `seed-bootstrap-admin.ts` как npm-скрипт) живут в `apps/web/scripts/` и запускаются через `pnpm worker` / `pnpm scheduler` / `pnpm admin:bootstrap` — см. корневой [README.md](../README.md#доступные-команды).

## Prod DB helpers

```bash
# инспекция + снимок live-схемы
pnpm exec tsx scripts/inspect-prod-dbs.ts

# применить Drizzle-миграции к DATABASE_URL из .env
pnpm exec tsx scripts/probe-anisync-db.ts --migrate

# health-check внешних интеграций (TMDB / Prowlarr / Telegram)
pnpm exec tsx scripts/probe-integrations.ts
```

## Администрирование пользователей

```bash
# создать первого админа, если таблица users пуста
BOOTSTRAP_ADMIN_PASSWORD='...' pnpm exec tsx scripts/seed-bootstrap-admin.ts

# выдать role=admin существующему пользователю
pnpm exec tsx scripts/promote-admin.ts --username yourname
```

## Схема БД

Снимки SQL-схемы: [docs/schemas/README.md](../docs/schemas/README.md).
