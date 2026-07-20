# Inventory переменных окружения

> **Версия:** 1.1  
> **Дата:** 2026-07-20  
> **Статус:** greenfield; prod-секреты не включать  
> **См. также:** [GREENFIELD.md](GREENFIELD.md)

---

## AniSync (целевая платформа)

| Переменная | Обязательна | Назначение |
|------------|:-----------:|------------|
| `APP_BASE_URL` | да | Server-side base URL (OAuth callbacks) |
| `NEXT_PUBLIC_BASE_URL` | да | Client-visible base URL |
| `DATABASE_URL` | да | PostgreSQL 18 (`…@postgres:5432/…` в Coolify compose) |
| `JWT_SECRET` | да | Session signing (min 16 chars) |
| `CRON_SECRET` | prod | Internal routes + legacy health |
| `REDIS_URL` | prod | Redis 7 (`redis://redis:6379` в Coolify compose) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | compose | Сервис `postgres` в `docker-compose.yml` |
| `BULLMQ_PREFIX` | нет | Префикс ключей BullMQ (default: `anisync`) |
| `LOG_LEVEL` | нет | pino: info/debug/... |
| `DEBUG` | нет | Глобальный debug |
| `DEBUG_MODULES` | нет | Список модулей через запятую |
| `DEBUG_SQL` | нет | SQL debug |
| `DEBUG_EXTERNAL_API` | нет | Логи внешних API |
| `RELEASES_MODULE_ENABLED` | нет | Feature flag (greenfield default: true) |
| `TORRENTS_MODULE_ENABLED` | нет | Feature flag (greenfield default: true) |
| `NEXT_PUBLIC_RELEASES_MODULE_ENABLED` | нет | UI nav Releases |
| `NEXT_PUBLIC_TORRENTS_MODULE_ENABLED` | нет | UI nav Torrents |
| `NEXT_PUBLIC_REGISTRATION_OPEN` | нет | Client hint; server `REGISTRATION_OPEN` — источник истины |
| `TMDB_API_KEY` | для Releases | TMDB v4 Bearer JWT или v3 api_key |
| `PROWLARR_URL` / `PROWLARR_API_KEY` | для Torrents | Prowlarr search в TS worker |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | для Torrents | Telegram notify |
| `INTERNAL_SERVICE_SECRET` | optional | совместимые internal routes; не для sidecar |
| `REGISTRATION_OPEN` | нет | default true; API 403 если false |
| `MAINTENANCE_MODE` | нет | default false |
| `LEGACY_ONTRASH_IMPORT_ENABLED` | нет | Admin import UI/API (default off) |
| `ONTRASH_DATABASE_URL` | legacy | Только с legacy import |
| `RUN_MIGRATIONS` | Docker | entrypoint migrate (default true) |
| `ANISYNC_PROCESS` | нет | web / worker / scheduler |
| `SHIKIMORI_*` | OAuth | Client id/secret, base URL |
| `MYANIMELIST_*` | OAuth | Client id/secret |
| `ANILIST_*` | OAuth | Client id/secret |
| `SENTRY_DSN` | нет | Error tracking |

---

## OnTrash / NextScene (источник Releases)

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | PostgreSQL |
| `SESSION_SECRET` | express-session |
| `TMDB_API_KEY` | TMDB API |
| `TMDB_TIMEOUT_MS` | Timeout |
| `TMDB_RETRIES` | Retry count |
| `PORT` | Express (3000) |
| `FRONTEND_DIST_DIR` | Static files |
| `VITE_API_BASE_URL` | Build-time frontend |

---

## NightWatcher (архивная справка, не deployment env)

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | PostgreSQL |
| `ADMIN_PASSWORD` | Admin login |
| `SESSION_SECRET` | **Обязателен** — session signing |
| `PROWLARR_URL` | Prowlarr API |
| `PROWLARR_API_KEY` | Prowlarr |
| `TMDB_API_KEY` | Metadata |
| `TELEGRAM_BOT_TOKEN` | Notifications |
| `TELEGRAM_CHAT_ID` | Legacy fallback chat (если нет per-user) |
| `INTERNAL_SERVICE_SECRET` | Service token для `/api/internal/*` |
| `ANISYNC_INTERNAL_URL` | Base URL AniSync BFF для dual-write in-app notify (напр. `http://web:3000`) |
| `PORT` | FastAPI (5000/8000) |

---

## Маппинг при слиянии

| Источник | Целевое в AniSync |
|----------|-------------------|
| OnTrash `SESSION_SECRET` | Не переносить — единый `user_sessions` |
| OnTrash `TMDB_*` | `TMDB_*` в AniSync (фаза 2) |
| NW `TORRENT_SERVICE_*` | Не переносить — Python sidecar удалён |
| NW `TELEGRAM_*` | Global bot token + per-user chat в DB |

---

*При добавлении env — обновить корневой `.env.example`, `apps/web/.env.example` и этот файл.*
