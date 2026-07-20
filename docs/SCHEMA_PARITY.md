# Schema parity — сверка схем из кода (без live чужих БД)

> **Дата:** 2026-07-20  
> **Ограничение:** доступ только к AniSync `DATABASE_URL`; OnTrash/NW — по SQL/TypeScript в репозиториях.

## Источники

| Система | Канон схемы в коде |
|---------|-------------------|
| AniSync | `apps/web/src/lib/db/schema.ts` + `apps/web/drizzle/*.sql` |
| NightWatcher (archive reference) | legacy `migrations/init.sql` (+ 006/007) |
| OnTrash / NextScene | `NextScene/backend/src/lib/bootstrap.ts`, `lib/db/src/schema/*` |

Live AniSync: `docs/schemas/anisync-live.sql` (после migrate).

## Маппинг доменов

| Legacy | AniSync target | Статус |
|--------|----------------|--------|
| OnTrash `users` | `users` (+ email synthetic, `role`) | CLI `migrate-ontrash-users.ts` |
| OnTrash `watchlist_items` | `release_watchlist_entries` | CLI `migrate-ontrash-watchlist.ts` |
| OnTrash `app_sessions` | — (не переносим; re-login) | `AUTH_SESSION_MAPPING.md` |
| NW `imdb_watchlist` | `torrent_watchlist` | AniSync local runtime (`0006`) |
| NW `torrent_releases` | `torrent_releases` | `0006` |
| NW `notifications_history` | `torrent_notification_log` | `0006` (+ optional `user_id`) |

## NW → torrent_watchlist (ключевые поля)

| NW `imdb_watchlist` | AniSync `torrent_watchlist` |
|---------------------|-----------------------------|
| `user_id` | `user_id` → FK `users.id` |
| `imdb_id` | `imdb_id` UNIQUE(user_id, imdb_id) |
| `enabled`, `target_season`, prefs… | same |
| `telegram_chat_id` | `telegram_chat_id` |
| `check_interval`, `last_checked` | same |
| extended metadata (actors, budget…) | **не перенесены** в v1 (достаточно для watcher cutover) |

## OnTrash → release_watchlist_entries

| OnTrash | AniSync |
|---------|---------|
| `tmdb_id`, `type`, `status` | same |
| `title` / `title_ru` | same |
| `next_episode_*` | same |
| — | `schedule_updated_at` (AniSync-only) |

## Greenfield-решение

- импорт OnTrash/NW данных: `not applicable`, source DB пустые;
- legacy sessions: `intentionally removed`;
- расширенные display-only поля NW не добавляются без runtime-потребителя.

Канон схемы — только Drizzle migrations AniSync. Legacy SQL не запускается в deployment.
