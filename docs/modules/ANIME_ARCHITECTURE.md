# Архитектура модуля Anime

> **Версия:** 1.4  
> **Дата:** 2026-07-24  
> **Контракт:** [MODULE_CONTRACT.md](../MODULE_CONTRACT.md)

## Границы

- Каталог и библиотека аниме (Shikimori / MAL / AniList).
- Sync jobs, library entries, provider OAuth.
- API: `/api/user/anime/*`, `/api/user/library/*`, `/api/integrations/*`, `/api/user/integrations/sync*`.
- UI: расписание, настройки интеграций.

## Primary / Secondary

Настройки в `user_settings`: `primary_service`, `secondary_service` (оба nullable enum).

| Роль | Смысл |
|------|--------|
| **Primary** | Эталон всего, что есть в его списке (статусы, оценки, эпизоды). |
| **Secondary** | Эталон **только** для тайтлов, которых **нет** на primary (schedule gaps). |
| Остальные connected | Targets для outbound push с primary; не эталон сами по себе. |

Правила:

1. Любая синхронизация смотрит на primary в первую очередь.
2. Secondary ≠ primary; при смене primary совпадающий secondary сбрасывается.
3. Тайтл есть на MAL/AniList, но нет на primary → full catalog sync **не** меняет его статус/серии/оценки.
4. Schedule refresh: gaps сначала с explicit secondary, затем MAL → AniList → Shikimori.

## Полная синхронизация каталога primary

UI: «Синхронизировать каталог primary с другими сервисами»  
API: `POST /api/user/integrations/sync/catalog`  
Job: `direction = primary_catalog_push`

1. `fetchLibrary(primary, { scope: 'membership' })` — полный список.
2. Local upsert всех записей с primary.
3. `dispatchEntrySync` на каждую → outbound create/update на остальные connected.
4. Без cascade-delete; без импорта тайтлов, которых нет на primary.

Отдельно: Manual Sync (schedule) = `primary_import` → `refreshScheduleSlice`.

## Загрузка расписания (stale-while-revalidate)

`GET /api/user/anime` → БД сразу (только `watching` / `planned` / `rewatching`); stale → `anime.schedule.refresh`.  
Статусы `dropped` / `completed` / `on_hold` в расписание не загружаются и не показываются.

## Mixed-provider schedule import

1. Primary membership → cascade delete (только primary) + upsert (schedule + align локальных).
2. Push primary entries на остальные.
3. Fallback services: secondary first, затем остальные; library только если нет на primary.
4. Soft prune.

## Outbound sync

`syncEntryToProviders`: primary → MAL → rest; update или create.

## Документы / код

- `sync-service.ts`, `library-service.ts`, `integrations/page.tsx`
- Миграция: `drizzle/0007_secondary_service.sql` — применяется автоматически при старте `web` (`RUN_MIGRATIONS=true`)
