# Деплой AniSync в Coolify

> **Версия:** 2.0  
> **Дата:** 2026-07-20  
> **Связанные документы:** [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md)

---

## 1. Обзор ресурсов

В Coolify создаются **отдельные** сервисы:

| Ресурс | Тип | Имя (рекомендуемое) |
|--------|-----|---------------------|
| PostgreSQL 18 | Database | `anisync-postgres` |
| Redis 7 | Database | `anisync-redis` |
| Web | Application (Dockerfile `apps/web`) | `anisync-web` |
| Worker | Application (тот же образ) | `anisync-worker` |
| Scheduler | Application (тот же образ) | `anisync-scheduler` |

Приложение **не** включает Postgres/Redis в свой контейнер.

---

## 2. PostgreSQL 18 (`anisync-postgres`)

1. Coolify → **New Resource** → **Database** → PostgreSQL
2. Версия: **18** (или образ `postgres:18-alpine`)
3. Database name: `anisync`
4. Включить **automated backups** (daily)
5. Скопировать internal connection string → `DATABASE_URL` для app-сервисов

---

## 3. Redis (`anisync-redis`)

1. Coolify → **New Resource** → **Database** → Redis
2. Версия: **7**
3. Скопировать internal URL → `REDIS_URL` (например `redis://default:password@anisync-redis:6379`)

---

## 4. Application: `anisync-web`

### Build

- **Base directory:** `apps/web`
- **Build pack:** Dockerfile
- **Dockerfile path:** `apps/web/Dockerfile` (или `Dockerfile` относительно base directory)
- **Port:** `3000`
- **Health check:** `GET /api/health` (liveness)
- **Readiness:** `GET /api/health/ready` (DB + Redis)

### Environment (обязательные)

```env
APP_BASE_URL=https://anisync.ru
NEXT_PUBLIC_BASE_URL=https://anisync.ru
DATABASE_URL=<from anisync-postgres>
REDIS_URL=<from anisync-redis>
JWT_SECRET=<random 32+ chars>
CRON_SECRET=<random 32+ chars>
BULLMQ_PREFIX=anisync
LOG_LEVEL=info
RUN_MIGRATIONS=true
RELEASES_MODULE_ENABLED=true
TORRENTS_MODULE_ENABLED=true
REGISTRATION_OPEN=true
TMDB_API_KEY=<tmdb bearer token or v3 key>
```

### Build arguments (обязательные)

```env
NEXT_PUBLIC_BASE_URL=https://anisync.ru
NEXT_PUBLIC_RELEASES_MODULE_ENABLED=true
NEXT_PUBLIC_TORRENTS_MODULE_ENABLED=true
NEXT_PUBLIC_REGISTRATION_OPEN=true
```

`NEXT_PUBLIC_*` встраиваются Next.js во время build. Runtime flags без соответствующих
build arguments дадут рассинхронизацию server/UI.

### OAuth / providers

Скопировать из текущего prod `.env`: `SHIKIMORI_*`, `MYANIMELIST_*`, `ANILIST_*`.

---

## 5. Application: `anisync-worker`

- **Тот же репозиторий и Dockerfile**
- **Start command:** `node --import tsx scripts/worker.ts`
- **Replicas:** 1 (увеличить при росте очереди sync)
- **RUN_MIGRATIONS:** `false`
- **APP_BASE_URL:** internal URL web-сервиса (для fallback HTTP, если нужен)
- Те же `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CRON_SECRET`
- `TORRENTS_MODULE_ENABLED=true`, `TMDB_API_KEY`, `PROWLARR_URL`,
  `PROWLARR_API_KEY`, `TELEGRAM_BOT_TOKEN`, опциональный `TELEGRAM_CHAT_ID`

---

## 6. Application: `anisync-scheduler`

- **Start command:** `node --import tsx scripts/scheduler.ts`
- **Replicas:** 1 (singleton)
- **RUN_MIGRATIONS:** `false`
- Те же `REDIS_URL`, secrets

---

## 7. Порядок первого деплоя

1. Создать `anisync-postgres` и `anisync-redis`
2. Деплой `anisync-web` (миграции выполнятся в entrypoint)
3. Проверить `https://<domain>/api/health/ready` → `status: ready`
4. Деплой `anisync-worker`
5. Деплой `anisync-scheduler`
6. В web-контейнере запустить portable bootstrap admin: `pnpm admin:bootstrap`
7. Проверить `/api/torrents/health` → `storage: "local"`
8. Проверить sync и torrent scan: scheduler создаёт jobs, worker обрабатывает BullMQ

---

## 8. Локальная разработка

```bash
cp apps/web/.env.example apps/web/.env
# из корня monorepo:
pnpm install
docker compose up --build
# или только web:
pnpm dev
```

Сервисы:
- Web: http://localhost:9002
- Postgres: localhost:5432
- Redis: localhost:6379

Без Docker: `pnpm dev` + локальный Postgres/Redis, `pnpm worker` в отдельном терминале.

---

## 9. Откат

- Web: redeploy предыдущего образа в Coolify
- Worker/scheduler: redeploy предыдущего AniSync image; Python sidecar не является rollback path
- БД: restore из Coolify backup

---

*При изменении топологии обновить [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) и [CHANGELOG.md](CHANGELOG.md).*
