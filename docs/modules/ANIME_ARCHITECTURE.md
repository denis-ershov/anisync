# Архитектура модуля Anime

> **Версия:** 1.2  
> **Дата:** 2026-07-24  
> **Контракт:** [MODULE_CONTRACT.md](../MODULE_CONTRACT.md)

## Границы

- Каталог и библиотека аниме (Shikimori / MAL / AniList).
- Sync jobs, library entries, provider OAuth.
- API: `/api/user/anime/*`, `/api/user/library/*`, `/api/integrations/*`.
- UI: главные страницы платформы (расписание, библиотека).

## Загрузка расписания (stale-while-revalidate)

`GET /api/user/anime`:

1. Если библиотека пуста — cold start: `ensurePrimaryLibraryLoaded` → `refreshScheduleSlice` (ждём).
2. Иначе сразу `listUserLibrary` из БД.
3. Если срез старше **15 минут** (или `?force=1`) — enqueue `anime.schedule.refresh` (или fire-and-forget без Redis).
4. Ответ: `{ anime, sync: { status, stale } }`.

UI показывает кэш сразу; индикатор «Обновление списка…» (бейдж со спиннером) + poll ~5с пока `sync.status` не `idle`. Статус фонового refresh хранится в `sync_jobs` (`direction=schedule_refresh`), чтобы переживать запросы/инстансы.

## Mixed-provider schedule import

`SyncService.refreshScheduleSlice(userId)`:

1. **Membership cascade delete** — **только primary**: `fetchLibrary({ scope: 'membership' })`. Если тайтл был привязан к primary и пропал из его списка — удаление на остальных connected + local. Secondary (MAL/AniList) **не** триггерят cascade (иначе enrichment id → ложный wipe primary).
2. **Primary** — полный upsert метаданных и library entries (replace progress); фиксация изменившихся `watchStatus` / `watchedEpisodes`.
3. **MAL** (если подключён) — только тайтлы, которых **нет** на primary; метаданные с MAL.
4. **Остальные** (AniList и т.д.) — только тайтлы, которых нет ни на primary, ни на MAL.
5. На уже существующие строки каталога secondary делает `fill-gaps`: **добивает только пустые поля** — **не перезаписывает** primary.
6. **Soft prune** — `pruneLibraryToScheduleSlice` не удаляет active titles вне schedule-окна; удаления только через cascade (§primary membership) или UI DELETE.
7. Для записей с изменившимся progress/status с primary — `requeueEntrySync` + `dispatchEntrySync` (push на остальные сервисы).

Приоритет источника метаданных и удалений: **primary всегда authoritative**. Secondary не переопределяет primary.

### Сопоставление тайтлов

Канонический мост — `anime_catalog.mal_id`:

- Shikimori: `anime.malId`
- MAL: id = mal id
- AniList: `Media.idMal` (nullable)

Если `malId` нет — fallback по нормализованному названию (+ год).

## Outbound sync (upsert-all)

`syncEntryToProviders`:

- Targets = **все** интеграции с `accessToken` (не только `automaticSync`).
- Порядок: **primary → myanimelist → остальные**.
- На каждом target: update если запись есть; иначе **create** с тем же status/episodes/rating.
- Shikimori: PATCH по `user_rate` id **или POST** `/api/v2/user_rates` (create) по anime id.
- MAL / AniList: upsert по anime/media id.
- После успешного create — `ensureServiceId` + обновление `sourceEntryId` для authoritative/primary.

## Поиск и добавление

- `ProviderAdapter.searchAnime` — Shikimori GraphQL, MAL `/v2/anime?q=`, AniList `Page.media(search)`.
- `GET /api/user/anime/search?q=&service=` — default service = primary.
- `POST /api/user/library` — `{ service, externalAnimeId, watchStatus?, watchedEpisodes? }`:
  1. `fetchAnimeDetails` → catalog upsert;
  2. local library upsert;
  3. outbound sync через тот же pipeline, что PATCH.

UI: диалог «Добавить аниме» на расписании (`AddAnimeDialog`).

## Primary import (schedule scope)

По умолчанию `fetchLibrary({ scope: 'schedule' })`:

1. Статусы **watching / planned / rewatching**.
2. **watching / rewatching** — импортируются **целиком** (в т.ч. без даты / с эфиром вне окна) → блок «Продолжаю смотреть».
3. **planned** — только окно **14 дней** по `nextEpisodeDate` / `airedOn`.
4. Фильтр окна — только import/отображение среза planned, не DELETE.
5. Отдельно `scope: 'membership'` — id тайтлов во всех статусах списка (для cascade delete).

## Удаление статуса (library entry)

- `DELETE /api/user/library/[id]`: local delete + cascade на **все** connected провайдеры (явное действие пользователя).
- External delete: детект **только с primary** через membership → cascade на остальные + local. Secondary absence не считается удалением.

## Код

- Модуль: `apps/web/src/modules/anime/`
- Сервисы: `sync-service.ts`, `library-service.ts`, `catalog-match.ts`, `providers.ts`
- Очередь: `anime.schedule.refresh`, `anime.sync.entry`
- UI: `schedule-view.tsx`, `add-anime-dialog.tsx`
- Манифест: `manifest.ts` → registry

## Зависимости платформы

Auth, sessions, notifications, BullMQ queues `anime.sync.*`, `anime.schedule.refresh`.
