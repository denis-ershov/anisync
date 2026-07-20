# Архитектура модуля Anime

> **Версия:** 1.0  
> **Дата:** 2026-07-20  
> **Контракт:** [MODULE_CONTRACT.md](../MODULE_CONTRACT.md)

## Границы

- Каталог и библиотека аниме (Shikimori / MAL / AniList).
- Sync jobs, library entries, provider OAuth.
- API: `/api/anime/*`, `/api/user/library/*`, `/api/integrations/*`.
- UI: главные страницы платформы (расписание, библиотека).

## Код

- Модуль: `apps/web/src/modules/anime/`
- Сервисы (текущие): `apps/web/src/lib/services/*`, `apps/web/src/lib/integrations/providers*`
- Манифест: `manifest.ts` → registry

## Зависимости платформы

Auth, sessions, notifications, BullMQ queues `anime.sync.*`.
