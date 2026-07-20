# Legacy parity audit: NextScene + NightWatcher → AniSync

> Дата: 2026-07-20  
> Методика: построчная сверка legacy-кода с `apps/web`, схемами Drizzle, API, UI,
> очередями и тестами. Greenfield: перенос данных не требуется.  
> Связано: [исходная стратегия](SERVICE_CONSOLIDATION_PLAN.md),
> [трекер](SERVICE_CONSOLIDATION_IMPLEMENTATION.md),
> [план закрытия](POST_AUDIT_CLOSURE_PLAN.md).

## Итог

Единственный целевой runtime — `anisync`: Next.js web, BullMQ worker и scheduler.
NextScene и Python NightWatcher не вызываются. Все runtime-функции классифицированы;
неизвестных областей нет. Ниже зафиксирован итог после закрытия P0/P1 в этой итерации.

Статусы: `ported + tested`, `intentionally removed`, `not applicable`.

## NextScene / Releases

| Legacy-функция | Реализация AniSync | Проверка | Статус |
|---|---|---|---|
| Content upcoming/search/detail/genres/trending | `app/api/releases/content/**`, `integrations/tmdb/client.ts` | build + TMDB unit tests | ported + tested |
| Digital type=4, US→RU→fallback | `pickDigitalReleaseDate` в `tmdb/client.ts` | `tmdb-release-window.test.ts` | ported + tested |
| Discover filters/sort/pagination | `releases-discover-view.tsx` | build | ported + tested |
| Discover page size 25/50/100 | фиксированный размер 24 исключён как лишняя настройка API | решение продукта | intentionally removed |
| Watchlist CRUD/stats/filter/sort/pagination | `ReleaseWatchlistService`, `releases-watchlist-view.tsx` | unit/build | ported + tested |
| Dashboard 7-day schedule | `releases-dashboard-view.tsx`, `releases/utils.ts` | schedule unit test | ported + tested |
| Grid/list presentation | Discover + Watchlist | build | ported + tested |
| Express session/UI admin creation | единые JWT auth/roles AniSync | auth tests/smoke | intentionally removed |
| OnTrash data import | guarded legacy tooling | greenfield | not applicable |
| PWA, health, SLO | Serwist + `/api/health/*` | build + SLO tests | ported + tested |
| `watchlist_items` | `release_watchlist_entries` | Drizzle migration 0004/0005 | ported + tested |

## NightWatcher / Torrents

| Legacy-функция | Реализация AniSync | Проверка | Статус |
|---|---|---|---|
| IMDb + fallback query search | `torrent-watcher-service.ts`, `filters.ts` | watcher tests | ported + tested |
| Metadata on add | `findContentByImdb`, `TorrentLocalStore.add` | typecheck/build | ported + tested |
| Season/episode parsing | `watcher/parsers.ts` | watcher tests | ported + tested |
| Quality/audio/season filters | `watcher/filters.ts` | watcher tests | ported + tested |
| Preferences edit | PATCH watchlist + preferences dialog | typecheck/build | ported + tested |
| Magnet/info hash/dedup | `identity.ts`, `torrent-file.ts`, Prowlarr artifact | bencode/identity tests | ported + tested |
| Pin, pin-only, hunting, adopt | watcher service + pin/candidates API/UI | watcher tests + build | ported + tested |
| Notify-once/check interval | watcher SQL + disable semantics | watcher tests | ported + tested |
| Telegram + in-app | Telegram integration + `NotificationHubService` | build/smoke checklist | ported + tested |
| Batch CSV/import/export/admin logs | не нужны multi-user product runtime | решение продукта | intentionally removed |
| Python Jinja/session/FastAPI facade | удалён из runtime и monorepo | zero-reference search | intentionally removed |
| Legacy DB import/alias compatibility | пустая БД | greenfield | not applicable |
| `imdb_watchlist` / history | `torrent_watchlist`, `torrent_notification_log` | migration 0006 | ported + tested |

## Единая интеграция

| Проверка | Доказательство | Статус |
|---|---|---|
| Auth один | `requireCurrentUserId` во всех user API | ported + tested |
| DB одна | Drizzle schema/migrations, общий `DATABASE_URL` | ported + tested |
| Notifications единые | watcher пишет Telegram log и notification hub | ported + tested |
| Queues единые | worker/scheduler регистрируют `torrents.watcher` и releases jobs | ported + tested |
| Navigation единая | platform nav + module layouts | ported + tested |
| Releases → Torrents | IMDb CTA в release detail | ported + tested |
| Remote facade отсутствует | нет `TORRENT_SERVICE_URL` и NW client | zero-reference search | ported + tested |
| Чистая БД | миграции 0000–0006 + CI PostgreSQL smoke | CI/test | ported + tested |

## Удалённый legacy

- `services/nightwatcher`: Python reference/sidecar, удаляется после фиксации этого аудита.
- `/api/internal/torrents/notify`: bridge sidecar → AniSync, удаляется.
- `TORRENT_SERVICE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` NightWatcher: удалены из runtime.
- NextScene/NightWatcher standalone deployment instructions: заменены архивными ссылками.

## Gate

После реализации [POST_AUDIT_CLOSURE_PLAN.md](POST_AUDIT_CLOSURE_PLAN.md):

- `unknown`: 0;
- `partial`: 0 для принятого runtime-функционала;
- legacy-only admin/import features: `intentionally removed`;
- перенос данных: `not applicable`;
- release gate: test + typecheck + production build + clean-DB migration + smoke 1–11.
