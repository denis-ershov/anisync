# Архитектура модуля Anime

> **Версия:** 1.0  
> **Дата:** 2026-07-20  
> **Контракт:** [MODULE_CONTRACT.md](../MODULE_CONTRACT.md)

## Границы

- Каталог и библиотека аниме (Shikimori / MAL / AniList).
- Sync jobs, library entries, provider OAuth.
- API: `/api/anime/*`, `/api/user/library/*`, `/api/integrations/*`.
- UI: главные страницы платформы (расписание, библиотека).

## Primary import (schedule scope)

По умолчанию `fetchLibrary({ scope: 'schedule' })`:

1. У провайдера запрашиваются только статусы **watching / planned / rewatching** (не completed/dropped/on_hold).
2. Клиентский фильтр: дата эфира (`nextEpisodeDate`) или для planned — `airedOn` попадает в rolling-окно **14 дней** от сегодня (текущая + ближайшая неделя).
3. В БД upsert только этот срез; затем prune — удаляются completed/dropped/… и watching/planned вне окна.

`scope: 'full'` остаётся для редких админ/отладочных сценариев.

## Код

- Модуль: `apps/web/src/modules/anime/`
- Сервисы (текущие): `apps/web/src/lib/services/*`, `apps/web/src/lib/integrations/providers*`
- Фильтр импорта: `apps/web/src/lib/integrations/library-schedule-import.ts`
- Манифест: `manifest.ts` → registry

## Зависимости платформы

Auth, sessions, notifications, BullMQ queues `anime.sync.*`.
