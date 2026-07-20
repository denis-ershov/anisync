# API Mapping — AniSync / Releases / Torrents

> **Версия:** 1.0  
> **Дата:** 2026-07-20  
> **Связано:** [MODULE_CONTRACT.md](MODULE_CONTRACT.md), [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md), [GREENFIELD.md](GREENFIELD.md)

---

## AniSync platform (`apps/web`)

| Method | Path | Auth | Назначение |
|--------|------|------|------------|
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/logout` | session | Logout |
| GET | `/api/auth/me` | session | Current user + settings |
| GET/PUT | `/api/user/settings` | session | Theme, modules, **notificationPreferences** (incl. `telegramChatId`) |
| GET/PUT | `/api/user/profile` | session | Profile |
| GET | `/api/user/notifications` | session | In-app list + `unreadCount` (`?limit`, `?unreadOnly`) |
| PATCH | `/api/user/notifications` | session | Mark read (`notificationIds` optional = all unread) |
| GET/POST | `/api/admin/migrations/ontrash` | admin | Status / dry-run / apply OnTrash migration scripts |
| GET | `/api/health` | — | Liveness |
| GET | `/api/health/ready` | — | DB + Redis |
| GET | `/api/health/slo` | secret | SLO metrics |
| POST | `/api/internal/sync-jobs/process` | CRON | Anime sync worker fallback |
| POST | `/api/internal/entry-sync/process` | CRON | Entry sync |

## Releases

| Method | Path | Auth | Назначение |
|--------|------|------|------------|
| GET | `/api/releases/content/trending` | session* | Trending |
| GET | `/api/releases/content/upcoming` | session* | Upcoming catalog |
| GET | `/api/releases/content/search` | session* | Search |
| GET | `/api/releases/content/genres` | session* | Genres |
| GET | `/api/releases/content/[tmdbId]` | session* | Detail |
| GET/POST | `/api/releases/watchlist` | session | Watchlist CRUD |
| PATCH/DELETE | `/api/releases/watchlist/[id]` | session | Item |
| GET | `/api/releases/watchlist/stats` | session | Stats |
| GET | `/api/releases/health` | — | TMDB health |

\*Модуль gated `RELEASES_MODULE_ENABLED`.

## Torrents (local TypeScript runtime)

| Method | AniSync endpoint | Auth | Назначение |
|---|---|---|---|
| GET/POST | `/api/torrents/watchlist` | session | Список / add с TMDB metadata |
| PATCH/DELETE | `/api/torrents/watchlist/[id]` | session | Preferences / delete |
| POST | `/api/torrents/watchlist/[id]/toggle` | session | Pause/resume |
| GET | `/api/torrents/watchlist/[id]/candidates` | session | Prowlarr pin candidates |
| POST/DELETE | `/api/torrents/watchlist/[id]/pin` | session | Pin/unpin |
| GET | `/api/torrents/releases/[imdbId]` | session | Найденные релизы |
| GET | `/api/torrents/health` | session | Local DB/Prowlarr/Telegram health |
| POST | `/api/internal/torrents/watch` | CRON secret | Queue/inline TS watcher scan |

## NightWatcher admin UI (archived legacy)

| Path | Notes |
|------|-------|
| `/login`, `/` | Jinja admin; scoped to `user_id=1` |
| `/api/*` JSON used by Jinja | intentionally removed; не runtime |

## OnTrash (legacy NextScene) — reference only

| Old | New in AniSync |
|-----|----------------|
| `/api/content/*` | `/api/releases/content/*` |
| `/api/watchlist/*` | `/api/releases/watchlist/*` |
| `/api/healthz/slo` | `/api/health/slo` |
| `ontrash.sid` | `auth-token` / `user_sessions` |
