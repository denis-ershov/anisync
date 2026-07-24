# Архитектура модуля Anime

> **Версия:** 1.1  
> **Дата:** 2026-07-24  
> **Контракт:** [MODULE_CONTRACT.md](../MODULE_CONTRACT.md)

## Границы

- Каталог и библиотека аниме (Shikimori / MAL / AniList).
- Sync jobs, library entries, provider OAuth.
- API: `/api/anime/*`, `/api/user/library/*`, `/api/integrations/*`.
- UI: главные страницы платформы (расписание, библиотека).

## Загрузка расписания (stale-while-revalidate)

`GET /api/user/anime`:

1. Если библиотека пуста — cold start: `ensurePrimaryLibraryLoaded` → `refreshScheduleSlice` (ждём).
2. Иначе сразу `listUserLibrary` из БД.
3. Если срез старше **15 минут** (или `?force=1`) — enqueue `anime.schedule.refresh` (или fire-and-forget без Redis).
4. Ответ: `{ anime, sync: { status, stale } }`.

UI показывает кэш сразу; индикатор «Обновление списка…» + poll ~5с пока `sync.status` не `idle`.

## Mixed-provider schedule import

`SyncService.refreshScheduleSlice(userId)`:

1. Все интеграции с токеном (не только primary).
2. Primary: полный upsert library entries.
3. Secondary: link в `anime_catalog` / `anime_service_ids`; library entry только если тайтла нет на primary.
4. Prune по **union** animeId всех срезов.
5. Опционально: обогащение AniList id через `Page.media(idMal_in: …)`.

### Сопоставление тайтлов

Канонический мост — `anime_catalog.mal_id`:

- Shikimori: `anime.malId`
- MAL: id = mal id
- AniList: `Media.idMal` (nullable)

Если `malId` нет — fallback по нормализованному названию (+ год); при неоднозначности создаётся отдельная строка каталога.

## Outbound sync

`syncEntryToProviders`: primary первым (если есть ID), затем `automaticSync` с **per-service** `externalAnimeId` из `anime_service_ids`. Если на primary нет тайтла — sync на провайдеры, где ID есть; при успехе fallback может обновить `sourceService`.

## Primary import (schedule scope)

По умолчанию `fetchLibrary({ scope: 'schedule' })`:

1. Статусы **watching / planned / rewatching**.
2. Окно **14 дней** по `nextEpisodeDate` / `airedOn` (planned).
3. Импорт через `refreshScheduleSlice` (mixed).

## Удаление статуса (library entry)

`DELETE /api/user/library/[id]`: local delete + best-effort provider delete.

## Код

- Модуль: `apps/web/src/modules/anime/`
- Сервисы: `sync-service.ts`, `library-service.ts`, `catalog-match.ts`, `providers.ts`
- Очередь: `anime.schedule.refresh`
- Манифест: `manifest.ts` → registry

## Зависимости платформы

Auth, sessions, notifications, BullMQ queues `anime.sync.*`, `anime.schedule.refresh`.
