# Архитектура модуля Anime

> **Версия:** 1.10  
> **Дата:** 2026-07-29  
> **Контракт:** [MODULE_CONTRACT.md](../MODULE_CONTRACT.md)

## Границы

- Каталог и библиотека аниме (Shikimori / MAL / AniList).
- Sync jobs, library entries, provider OAuth.
- API: `/api/user/anime/*`, `/api/user/library/*`, `/api/integrations/*`, `/api/user/integrations/sync*`, `/api/user/integrations/sync/queue` (обзор очереди).
- UI: расписание, настройки интеграций (очередь jobs + entry-задачи).

## Primary / Secondary / AniSync

Настройки в `user_settings`: `primary_service`, `secondary_service` (оба nullable enum).

| Роль | Смысл |
|------|--------|
| **Primary** | Эталон при **сравнении сервисов**. Статус/наличие в списке primary побеждает secondary. |
| **Secondary** | Только **gap**: тайтла **физически нет** на primary **или** он **цензурирован/unusable** (`isCensored`: в API есть, list/write нельзя). MAL schedule fetch обязан с `nsfw=true`, иначе NSFW/GL gaps не видны. |
| **AniSync (локальные правки)** | Явные правки пользователя (`manual_update` / `retry_sync`) → outbound на primary и все connected. |
| Остальные connected | Targets для push состояния эталона. |

### Матрица авторитета

| Ситуация | Эталон | Действие |
|----------|--------|----------|
| Тайтл в membership primary | Primary (статус/серии) | Импорт в local (если нет pending правки) → push на остальные |
| Тайтл **есть** на primary-сервисе, **статуса нет** (нет в membership), на secondary есть статус | Primary («нет в списке») | Не импортировать secondary; cascade delete local + с провайдеров |
| Тайтла **физически нет** на primary **или** `isCensored` | Secondary | Gap-import; cascade не удаляет |
| Пользователь изменил запись в AniSync | Local (intentional) | `outOfSync` + `user_entry_changes` → push на primary и все; refresh не затирает |

Правила:

1. Primary всегда важнее secondary при сравнении сервисов.
2. Gap ≠ «нет в membership». Gap = «нет usable на primary» (probe / resolve by MAL; `isCensored` = unusable).
3. Secondary-импорт **не** создаёт intentional `user_entry_changes` и не должен случайно пушиться как «правка каталога».
4. Outbound после refresh: (a) состояние primary → others; (b) только intentional pending (`manual_update` / `retry_sync`).
5. Secondary ≠ primary; при смене primary совпадающий secondary сбрасывается.
6. Schedule: PTW + `currently_airing` импортируется даже без `nextEpisodeDate` (MAL).

## Primary unavailable (Shikimori цензура / удалён каталог)

Сигнал: PATCH/POST `user_rates` на Shiki → HTTP **404/422**, затем probe GraphQL `animes(ids)` пустой; либо membership rate с `anime: null`.

Recovery (`recoverFromUnavailablePrimary`):

1. DELETE `user_rates` на Shiki (404 = ok).
2. `sourceService` → explicit secondary (или MAL).
3. Outbound push на secondary + остальные **без** write на Shiki.
4. Notification + UI-бейдж «Недоступно на Shikimori».

## Полная синхронизация каталога primary

UI: «Синхронизировать каталог primary с другими сервисами»  
API: `POST /api/user/integrations/sync/catalog`  
Job: `direction = primary_catalog_push`

1. `fetchLibrary(primary, { scope: 'membership' })` — полный список.
2. Local upsert с primary (`preserveOutOfSync`).
3. `dispatchEntrySync` на каждую → outbound на остальные connected.
4. Без cascade-delete; без импорта gap с secondary.

Отдельно: Manual Sync (schedule) = `primary_import` → `refreshScheduleSlice`.

## Загрузка расписания (stale-while-revalidate)

`GET /api/user/anime` → БД сразу (только `watching` / `planned` / `rewatching`); stale → `anime.schedule.refresh`.  
Статусы `dropped` / `completed` / `on_hold` в расписание не загружаются и не показываются.

UI (`schedule-day.ts`): день недели по `next_episode_date` (для planned — `aired_on`) в **IANA timezone** пользователя (`user_settings.timezone`, по умолчанию `Europe/Moscow`). «Сегодня» = календарная дата в этой TZ (не rolling 24h). После эфира Shiki двигает `next` на +7д — UI восстанавливает предыдущий слот и держит тайтл в «Сегодня». Отображение времени — в TZ пользователя (`formatNextEpisodeShort` / `formatZonedTime`). Instants в БД — UTC/ISO.

### AniList и `next_episode_date`

При импорте/линке каталога с `serviceName === 'anilist'` используется режим слияния `fill-gaps-next-date` (`library-service` / `catalog-next-episode.ts`):

- **перезаписывается только** `nextEpisodeDate` из AniList (`nextAiringEpisode.airingAt` → ISO);
- остальные поля каталога — как в `fill-gaps` (не затирают уже заполненные).

Так secondary AniList может обновить дату эфира поверх Shikimori/MAL без полной перезаписи метаданных.

## Mixed-provider schedule import

1. Primary membership → cascade: нет в membership **и** тайтл существует на primary → delete (+ providers). Физически нет → keep (gap). `outOfSync` не трогаем.
2. Upsert с primary → local (`preserveOutOfSync` для ручных правок).
3. Secondary/fallback: импорт **только** если тайтла нет на primary-сервисе; если есть на primary без статуса — skip.
4. Outbound: primary-aligned entries + intentional pending only.
5. Soft prune.

## Outbound sync

`syncEntryToProviders`: локальное состояние entry → primary → MAL → rest.

Источники постановки в очередь:

- UI PATCH / episodes → `manual_update` + `outOfSync`;
- Retry → `retry_sync`;
- Schedule refresh → push эталона primary (не secondary-import).

Очередь BullMQ `anime.sync.entry`:

- `enqueueEntrySync` — dedupe по `jobId`; completed/failed снимаются, иначе повторный enqueue блокировался.
- Scheduler каждую минуту: `process-entry-sync-drain` (до 25 pending).
- UI: `GET|POST /api/user/integrations/sync/queue` — обзор и «Запустить обработку» (`flushPendingEntrySyncs`).

Обзор очереди: панель на `/settings/integrations` (`SyncQueuePanel`).

## Документы / код

- `sync-service.ts`, `library-service.ts`, `integrations/page.tsx`
- `resolveShikimoriIdByMalId` / `probeShikimoriAnimeExists` — проверка «есть ли тайтл на primary»
- Миграция: `drizzle/0007_secondary_service.sql` — применяется автоматически при старте `web` (`RUN_MIGRATIONS=true`)
