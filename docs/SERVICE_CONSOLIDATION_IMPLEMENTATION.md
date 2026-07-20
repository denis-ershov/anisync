# Трекер реализации: объединение сервисов в платформу AniSync

> **Версия:** 1.1
> **Дата:** 2026-06-15 (обновлено 2026-07-20)
> **Источник плана:** [SERVICE_CONSOLIDATION_PLAN.md](SERVICE_CONSOLIDATION_PLAN.md)
> **Режим:** [GREENFIELD.md](GREENFIELD.md) — запуск с нуля, **перенос данных не нужен**
> **Назначение:** учёт фактически выполненного по фазам 0–5 на основе сверки плана с реальным кодом трёх репозиториев (`anisync`, `NextScene`, `nightwatcher`).

---

## Легенда статусов

- `[x]` выполнено и уже отражено в коде.
- `[~]` частично выполнено; нужен follow-up или проверка на реальной БД.
- `[ ]` не сделано.
- `[blocked]` заблокировано внешним окружением (Coolify UI / DNS / ключи).
- `[n/a]` не применимо в greenfield (миграция/parallel/legacy cutover).

---

## Содержание

1. [Сводка верификации](#1-сводка-верификации)
2. [Расхождения плана с кодом](#2-расхождения-плана-с-кодом)
3. [Фаза 0 — Подготовка](#3-фаза-0--подготовка)
4. [Фаза 1 — Foundation](#4-фаза-1--foundation)
5. [Фаза 2 — Releases MVP](#5-фаза-2--releases-mvp)
6. [Фаза 3 — Torrents integration](#6-фаза-3--torrents-integration)
7. [Фаза 4 — Data migration & cutover](#7-фаза-4--data-migration--cutover)
8. [Фаза 5 — Decommission](#8-фаза-5--decommission)
9. [Критерии готовности по фазам](#9-критерии-готовности-по-фазам)
10. [Связанные документы](#10-связанные-документы)
11. [Открытые продуктовые решения](#11-открытые-продуктовые-решения)
12. [Сводный прогресс](#12-сводный-прогресс)

---

## 1. Сводка верификации

Проверка проведена сверкой утверждений плана с фактическим кодом. План **в целом корректен**; ключевые архитектурные выводы подтверждаются.

### AniSync (`anisync`) — подтверждено

| Утверждение плана | Факт |
|---|---|
| Next.js 15 / React 19 / TS / Tailwind / Drizzle / PostgreSQL | Подтверждено (`package.json`) |
| Auth: `user_sessions` + cookie `auth-token` | Подтверждено (`src/lib/db/schema.ts`, `src/app/api/auth/login/route.ts`) |
| Provider registry Shikimori / MAL / AniList | Подтверждено (`src/lib/integrations/providers.ts`) |
| Ключевые таблицы (users, user_settings, user_integrations, anime_catalog, anime_service_ids, user_library_entries, sync_jobs, notifications) | Подтверждено (14 таблиц в `src/lib/db/schema.ts`) |
| Internal cron routes + `CRON_SECRET` | Подтверждено (`src/app/api/internal/*`, `src/lib/services/sync-service.ts`) |
| next-intl ru/en | Подтверждено (`i18n/request.ts`, `messages/*.json`) |
| Легаси `user_anime_list` | Подтверждено (в схеме, не используется в сервисах) |
| Неиспользуемые `firebase`, `jsonwebtoken` | **Удалены** из `apps/web/package.json` (2026-07-20) |
| README устарел (JWT/SQLite) | **Исправлено** — monorepo README актуален |

### OnTrash / NextScene (`NextScene`) — подтверждено

| Утверждение плана | Факт |
|---|---|
| pnpm monorepo, React 19 + Vite 7, Express 5, Drizzle, OpenAPI→Orval | Подтверждено (`pnpm-workspace.yaml`, `lib/api-spec/orval.config.ts`) |
| Auth: express-session, cookie `ontrash.sid`, `app_sessions`, роли admin/user | Подтверждено (`backend/src/app.ts`, `backend/src/lib/session-store.ts`, `lib/db/src/schema/users.ts`) |
| TMDB только на backend | Подтверждено (`backend/src/lib/tmdb.ts`) |
| Сложная логика digital US→RU→earliest, фильтры жанров, серверная пагинация после пост-фильтров | Подтверждено (`pickDigitalReleaseDate`, `getUpcoming`, `paginateCatalogItems` в `backend/src/lib/tmdb.ts`) |
| `/api/content/*`, `/api/watchlist/*`, `/api/healthz/slo` | Подтверждено (`backend/src/routes/*`) |
| PWA | Подтверждено (`frontend/vite.config.ts`, `vite-plugin-pwa`) |
| Нет CI | Подтверждено (`.github/workflows` пуст) |
| bootstrap DDL дублирует Drizzle | Подтверждено (`backend/src/lib/bootstrap.ts`) |

### NightWatcher (`nightwatcher`) — подтверждено

| Утверждение плана | Факт |
|---|---|
| Python 3.11, FastAPI, SQLAlchemy async (raw SQL), Jinja2 | Подтверждено (`Dockerfile`, `requirements.txt`, `app/api.py`, `app/db.py`) |
| Auth: `ADMIN_PASSWORD`, cookie `nightwatcher_session` | Подтверждено (`app/config.py`, `app/api.py`) |
| Таблицы `imdb_watchlist`, `torrent_releases`, `notifications_history` | Подтверждено (`migrations/init.sql`) |
| Prowlarr / TMDB / TVMaze / Telegram (aiogram) | Подтверждено (`app/prowlarr_client.py`, `app/metadata.py`, `app/notifier.py`) |
| API + Watcher (30 мин), multiprocessing / supervisor | Подтверждено (`run.py`, `supervisor.conf`) |
| Magnet pipeline, content_hash, сезонный мониторинг, фильтры качества/озвучки, дедуп btih | Подтверждено (`app/watcher.py`) |
| `check_interval` в БД не влияет на watcher | **Исправлено** (2026-07-20): фильтр due по `last_checked` + interval |
| Нет CI | Подтверждено |

---

## 2. Расхождения плана с кодом

Эти неточности исправлены в исходном [SERVICE_CONSOLIDATION_PLAN.md](SERVICE_CONSOLIDATION_PLAN.md) (см. CHANGELOG).

| # | Раздел плана | Было | Факт |
|---|---|---|---|
| R1 | §5.2 | «зрелый watcher (~1280 строк)» | `app/watcher.py` — **1745 строк** |
| R2 | §2.3 | watcher однопользовательский (неявно) | **Было** single-tenant; **сейчас** multi-user (`user_id`, миграция `006`) |
| R3 | §11.3 / env | env NW не описаны | NightWatcher требует обязательный **`SESSION_SECRET`** в дополнение к `ADMIN_PASSWORD` |
| R4 | §2.2 | `lib/integrations/*` «объявлен, но пуст» | Директории **нет вообще**; есть только glob в `pnpm-workspace.yaml` |
| R5 | §2.2 / §8 | (не отмечено) | OnTrash `app_sessions` **вне Drizzle-схемы** — только raw SQL bootstrap/session-store |
| R6 | §11.1 | «Vercel Cron → /api/internal/*» как текущее | Текущая реализация — **programmatic fetch** из `SyncService`; `vercel.json` с расписанием отсутствует |
| R7 | §3.1 / §5.4 | `notifications` AniSync — «заготовка» | Hub + API + in-app UI; `module`/`channel`/`payload` добавлены |

---

## 3. Фаза 0 — Подготовка

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 0.1 | Inventory env vars всех трёх сервисов → `docs/ENV_INVENTORY.md` | `[x]` | Черновик v1.0 |
| 0.2 | Снимок схем БД (`pg_dump --schema-only`) → `docs/schemas/*.sql` | `[x]` | Repo + **live** `anisync-live.sql` (16 tables); NW live — timeout с dev-сети |
| 0.3 | Матрица API endpoints → `docs/API_MAPPING.md` | `[x]` | Создан 2026-07-20 |
| 0.4 | Убрать секреты из git (`VERCEL_SETUP.md` и т.п.) | `[x]` | Санитизированы `VERCEL_SETUP.md`, `VPS_POSTGRES_SETUP.md`; **нужна ротация пароля БД вне git** |
| 0.5 | Включить CI для NightWatcher (минимум lint/test) | `[x]` | monorepo CI: ruff + pytest + compileall |
| 0.6 | Feature flag инфраструктура в AniSync → `src/lib/feature-flags.ts` | `[x]` | `src/lib/feature-flags.ts` + env flags |
| 0.7 | Создать `docs/CHANGELOG.md` | `[x]` | Восстановлен |

### Фаза 0.5 — Coolify и контейнеризация (новая, до Foundation)

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 0.5.1 | `Dockerfile` multi-stage (deps → build → standalone) | `[x]` | `output: 'standalone'` в next.config |
| 0.5.2 | `docker-compose.yml` dev: web + worker + scheduler + postgres:18 + redis | `[x]` | **Только local dev**; prod — отдельные Coolify PG/Redis |
| 0.5.3 | Coolify deploy docs: app + **отдельно** `anisync-postgres`, `anisync-redis` | `[x]` | `docs/COOLIFY_DEPLOY.md` |
| 0.5.4 | Startup: migrate → start web/worker | `[x]` | `docker/entrypoint.sh` + `RUN_MIGRATIONS` |
| 0.5.5 | Coolify: отдельный PG 18 resource `anisync-postgres` | `[blocked]` | Документировано в COOLIFY_DEPLOY; UI Coolify |
| 0.5.6 | Публичный liveness `/api/health` без secret | `[x]` | + `/api/health/ready` (DB+Redis) |

### Фаза 0.6 — Очереди и Redis (новая, критично до масштабирования)

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 0.6.1 | Coolify: отдельный Redis resource + env `REDIS_URL` в app/worker | `[x]` | Config + connection options; Coolify UI — вручную |
| 0.6.2 | BullMQ scaffold: `src/lib/queue/`, worker entrypoint | `[x]` | `scripts/worker.ts`, `scripts/scheduler.ts` |
| 0.6.3 | Очереди: `anime.sync.primary`, `anime.sync.entry` | `[x]` | BullMQ + HTTP fallback без Redis |
| 0.6.4 | Scheduler process (repeatable jobs) | `[x]` | `scripts/scheduler.ts` + cleanup/TMDB/releases jobs |
| 0.6.5 | `FOR UPDATE SKIP LOCKED` или BullMQ concurrency | `[x]` | BullMQ concurrency=2/4 + SKIP LOCKED в `processNextPendingJob` / `processNextPendingEntrySync` |

### Фаза 0.7 — Observability и retention (новая)

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 0.7.1 | pino logging (web + worker) | `[x]` | `src/lib/observability/logger.ts` |
| 0.7.2 | `DEBUG` / `DEBUG_MODULES` / `DEBUG_SQL` flags | `[x]` | `src/lib/observability/debug.ts` + config |
| 0.7.3 | SLO middleware (latency warn >1.5s) | `[x]` | `withSloRoute`, `GET /api/health/slo` |
| 0.7.4 | `maintenance.cleanup` queue + retention policies | `[x]` | `src/lib/maintenance/retention.ts` + worker handler |
| 0.7.5 | `docs/PLATFORM_ARCHITECTURE.md` | `[x]` | Создан 2026-06-15 |

**Критерий выхода фазы 0:** документы готовы, Docker build проходит, Redis+BullMQ scaffold работает локально.

---

## 4. Фаза 1 — Foundation

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 1.1 | Расширить `users` (`role`, `display_name`) | `[x]` | Схема + `UserService`; миграция `0003` |
| 1.2 | Унифицировать sessions | `[x]` | `user_sessions` + `docs/AUTH_SESSION_MAPPING.md` (OnTrash/NW cutover) |
| 1.3 | Notification hub v1 (`module`, `payload` JSONB, `channel`) | `[x]` | Hub + API + in-app bell UI (`NotificationsBell`) |
| 1.4 | User settings (`notification_preferences`, `enabled_modules[]`) | `[x]` | Схема + GET/PUT `/api/user/settings` |
| 1.5 | Navigation shell (Sidebar: Anime active, Releases/Torrents disabled) | `[x]` | `PlatformShell`, `PlatformNav`, stub pages |
| 1.5.1 | PWA: manifest + service worker (`@serwist/next`) | `[x]` | Serwist + `public/offline.html`, icons 192/512 |
| 1.5.2 | Адаптив: карточки вместо таблиц на mobile/tablet | `[x]` | Card grid, mobile filter sheet, touch ≥44px |
| 1.6 | TMDB integration package (`src/lib/integrations/tmdb.ts`) | `[x]` | `integrations/tmdb/*` client + health + cache (фаза 2) |
| 1.7 | ID mapping table `media_external_ids` | `[x]` | Схема + `MediaExternalIdsService` |
| 1.8 | `docs/PLATFORM_ARCHITECTURE.md` | `[x]` | Создан 2026-06-15 (Coolify, BullMQ, Redis, observability) |
| 1.9 | `docs/DB_ARCHITECTURE.md` | `[x]` | Создан 2026-06-16 |

**Миграции Drizzle:** только additive.

**Критерий выхода:** TMDB health check из AniSync; admin role в БД; флаги модулей в settings.

---

## 5. Фаза 2 — Releases MVP

### 5.1 Backend

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 2.1.1 | Content API `/api/content/*` → `/api/releases/content/*` | `[x]` | trending, upcoming, genres, search, detail |
| 2.1.2 | Watchlist API `/api/watchlist/*` → `/api/releases/watchlist/*` | `[x]` | CRUD + stats |
| 2.1.3 | Drizzle schema `watchlist_items` → `release_watchlist_entries` | `[x]` | Миграция `0004` |
| 2.1.4 | OpenAPI → `packages/api-spec` или `docs/openapi/` | `[x]` | `docs/openapi/releases.yaml` |
| 2.1.5 | SLO middleware (pino + metrics endpoint) | `[x]` | `slo-metrics.ts`, `withSloRoute`, `/api/health/slo` |
| 2.1.6 | TMDB Redis cache + precompute upcoming в worker | `[x]` | Redis + cron `*/30` |
| 2.1.7 | Batch watchlist refresh queue (устранить N×TMDB) | `[x]` | Hourly job + `schedule_updated_at` |

### 5.2 Frontend

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 2.2.1 | Страницы Discover/Watchlist/Dashboard под `[locale]/releases/*` | `[x]` | Dashboard + detail modal |
| 2.2.2 | Адаптация компонентов под shadcn/ui + Tailwind AniSync | `[x]` | `ReleaseContentCard`, card grid |
| 2.2.3 | React Query hooks (Orval или ручные) | `[x]` | `@tanstack/react-query`, `src/lib/releases/hooks.ts` |
| 2.2.4 | PWA: единый manifest или отложить | `[x]` | Manifest + Serwist SW + PNG icons |

### 5.3 Параллельный run / импорт (greenfield → N/A)

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 2.3.1 | Скрипт миграции users OnTrash → AniSync | `[n/a]` | CLI остаётся; apply не нужен (пустые БД) |
| 2.3.2 | Скрипт миграции `watchlist_items` | `[n/a]` | То же |
| 2.3.3 | Admin UI «Импорт из OnTrash» | `[n/a]` | Скрыт; `LEGACY_ONTRASH_IMPORT_ENABLED=true` включает |

### 5.4 Cutover OnTrash

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 2.4.1 | `RELEASES_MODULE_ENABLED=true` для beta | `[x]` | Default on в `.env.example` + greenfield `.env` |
| 2.4.2 | 1 неделя parallel run | `[n/a]` | Нет legacy traffic |
| 2.4.3 | `ontrash.ru` → 301 на `anisync.ru/releases` | `[n/a]` | Домен только anisync.ru (PRODUCT_DEFAULTS) |
| 2.4.4 | Read-only legacy container 2 недели | `[n/a]` | Нет legacy container |

**Критерий выхода:** Releases usable на AniSync с нуля (TMDB key + flag); parity vs OnTrash — справочный checklist, не gate.

---

## 6. Фаза 3 — Torrents integration

### 6.1 Архитектура интеграции

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 3.1.1 | Единый TS runtime без service bridge | `[x]` | Remote client и `TORRENT_SERVICE_URL` удалены |
| 3.1.2 | Multi-user local `torrent_watchlist.user_id` | `[x]` | Drizzle migration 0006 + единый auth |
| 3.1.3 | Local routes: CRUD, prefs, candidates, pin, releases, health | `[x]` | `/api/torrents/*` → `TorrentLocalStore` |
| 3.1.4 | UI `/[locale]/torrents` | `[x]` | Cards, metadata, prefs, pin/hunting, releases |
| 3.1.5 | Telegram `telegram_chat_id` per user | `[x]` | Settings + local watcher |

### 6.2 Связь Releases ↔ Torrents

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 3.2.1 | Кнопка «Следить за торрентом» в карточке release | `[x]` | В `ReleaseDetailModal`, добавление в `/api/torrents/watchlist` |
| 3.2.2 | TMDB → IMDb lookup при добавлении | `[x]` | TMDB `external_ids` + кэш в `media_external_ids` |

### 6.3 Параллельный run

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 3.3.1 | NW работает для текущего admin | `[n/a]` | Greenfield: local `torrent_*`; sidecar NW опционален |
| 3.3.2 | Новые пользователи только через AniSync | `[x]` | Facade + local store |
| 3.3.3 | Дублирование уведомлений `notifications` + Telegram | `[x]` | При sidecar NW; local — in-app через notify API |

**Критерий выхода:** CRUD и TS watcher/Telegram работают в AniSync без sidecar.

---

## 7. Фаза 4 — Data migration & cutover

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 4.1 | Финальная миграция данных OnTrash | `[n/a]` | Greenfield — нет source data |
| 4.2 | Финальная миграция NW watchlist → `torrent_watchlist` | `[n/a]` | Таблицы уже в AniSync; данные создаются с нуля |
| 4.3 | Один PostgreSQL AniSync (+ backup policy) | `[~]` | Prod AniSync уже единый; Coolify PG resource — 0.5.5 |
| 4.4 | 301 redirects: `ontrash.ru`, nightwatcher host | `[n/a]` | Нет legacy DNS cutover |
| 4.5 | Отключить dual-write | `[n/a]` | Dual-write не включался |
| 4.6 | Обновить `docs/CHANGELOG.md` | `[x]` | + GREENFIELD |

---

## 8. Фаза 5 — Decommission

| # | Задача | Статус | Заметки |
|---|--------|:------:|---------|
| 5.1 | Архив репозиториев NextScene, nightwatcher | `[~]` | Код frozen; GitHub archive выполняется вручную владельцем |
| 5.2 | Удалить legacy Docker/Coolify сервисы | `[x]` | Compose/Coolify только web+worker+scheduler |
| 5.3 | Порт watcher на TypeScript | `[x]` | Metadata, prefs, bencode, pin/hunting, BullMQ |
| 5.4 | Финальный аудит документации | `[x]` | `LEGACY_PARITY_AUDIT` + post-audit plan |

---

## 9. Критерии готовности по фазам

### Фаза 1 Done

- `[x]` `media_external_ids` миграция применена на prod `anisync` (2026-07-20, 16 tables)
- `[x]` TMDB `/api/releases/health` + `integrations/tmdb` (ключ — на окружении)
- `[x]` Feature flags работают (server + `NEXT_PUBLIC_*` для UI)
- `[x]` `PLATFORM_ARCHITECTURE.md` создан
- `[x]` `DB_ARCHITECTURE.md` создан
- `[x]` Platform navigation shell (desktop + mobile)
- `[x]` PWA (manifest + Serwist SW + install prompt)

### Фаза 2 Done (Releases parity)

- `[x]` Upcoming catalog (код); prod delta vs OnTrash — checklist `RELEASES_PARITY_CHECKLIST.md`
- `[x]` Watchlist CRUD
- `[x]` Dashboard 7-day schedule
- `[x]` Search
- `[x]` Login/session через AniSync
- `[x]` RU/EN
- `[x]` Mobile без таблиц (card grid + bottom sheet фильтров)

### Фаза 3 Done (Torrents)

- `[x]` Add/remove/toggle IMDb item (только local `torrent_*`)
- `[x]` TS watcher scan (Prowlarr → notify); Telegram с VPS при доступном Prowlarr
- `[x]` In-app notification (`NotificationHub` + log)
- `[x]` In-app UI: колокольчик (`NotificationsBell`)
- `[x]` Health: local + Prowlarr/Telegram env + `lastWatcherRun`

### Фаза 4 Done (Cutover)

- `[n/a]` verify counts vs legacy — нет legacy data
- `[n/a]` Redirects 48ч — нет legacy DNS
- `[n/a]` Legacy read-only — не применимо
- `[x]` AniSync schema + local torrents + feature flags greenfield

---

## 10. Связанные документы

| Документ | Фаза | Статус |
|----------|:----:|:------:|
| `docs/SERVICE_CONSOLIDATION_PLAN.md` | 0+ | `[x]` |
| `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md` | 0+ | `[x]` |
| `docs/GREENFIELD.md` | 0+ | `[x]` |
| `docs/ENV_INVENTORY.md` | 0 | `[x]` |
| `docs/API_MAPPING.md` | 0 | `[x]` |
| `docs/PLATFORM_ARCHITECTURE.md` | 0+ | `[x]` |
| `docs/RELEASES_ARCHITECTURE.md` | 2 | `[x]` |
| `docs/TORRENTS_ARCHITECTURE.md` | 3 | `[x]` |
| `docs/DB_ARCHITECTURE.md` | 1 | `[x]` |
| `docs/AUTH_SESSION_MAPPING.md` | 1 | `[x]` |
| `docs/schemas/` | 0 | `[x]` |
| `docs/SCHEMA_PARITY.md` | 4 | `[x]` |
| `docs/DUAL_WRITE_CUTOVER.md` | 4 | `[n/a]` |
| `docs/PRODUCT_DEFAULTS.md` | 2+ | `[x]` принято |
| `docs/RELEASES_PARITY_CHECKLIST.md` | 2 | `[x]` |
| `docs/LEGACY_PARITY_AUDIT.md` | 5 | `[x]` |
| `docs/POST_AUDIT_CLOSURE_PLAN.md` | 5 | `[x]` |
| `docs/CHANGELOG.md` | 0+ | `[x]` |

---

## 11. Продуктовые решения

| Решение | Статус | Значение |
|---------|:------:|----------|
| Бренд | `[x]` | AniSync |
| Домены | `[x]` | только `anisync.ru` |
| Torrents audience | `[x]` | все зарегистрированные + flag |
| Регистрация | `[x]` | открытая; API/UI уважают `REGISTRATION_OPEN` |

---

## 12. Сводный прогресс

| Фаза | Done `[x]` | Частично `[~]` | Не начато `[ ]` | Блок `[blocked]` | N/A `[n/a]` |
|------|:---------:|:--------------:|:---------------:|:----------------:|:-----------:|
| 0 | 7 | 0 | 0 | 0 | 0 |
| 0.5–0.7 | 16 | 0 | 0 | 1 | 0 |
| 1 | 10 | 0 | 0 | 0 | 0 |
| 2 | 10 | 0 | 0 | 0 | 6 |
| 3 | 10 | 0 | 0 | 0 | 1 |
| 4 | 1 | 1 | 0 | 0 | 4 |
| 5 | 2 | 0 | 1 | 0 | 1 |

**Текущий фокус (greenfield):**
1. ~~`TMDB_API_KEY`~~ — live
2. ~~TS torrent watcher~~ — единый цикл на `torrent_*` (без Python sidecar)
3. Deploy: worker + scheduler + `PROWLARR_*` на VPS
4. Smoke 1–11 на Coolify / Redis в одной сети
5. Владелец переводит внешние GitHub repositories в read-only archive (5.1)

---

*Обновлять этот трекер при каждом значимом изменении вместе с CHANGELOG (правило проекта о синхронности кода и документации).*
