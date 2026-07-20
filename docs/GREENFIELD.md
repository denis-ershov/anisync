# Greenfield: запуск платформы с нуля

> **Дата решения:** 2026-07-20  
> **Статус:** принято

## Решение

Объединение AniSync + Releases + Torrents идёт как **greenfield**:

- Целевая БД AniSync — **пустая / схема только из миграций** (уже применено).
- **Перенос данных** из OnTrash / legacy NightWatcher **не нужен**.
- Parallel run, dual-write, verify counts по legacy, DNS 301 со старых хостов — **N/A**, пока явно не понадобятся.

## Следствия для плана

| Было (Strangler Fig) | Стало (greenfield) |
|----------------------|--------------------|
| Миграция users/watchlist OnTrash | Пропуск; регистрация + bootstrap admin |
| Import NW → `torrent_*` | Пропуск; CRUD сразу в AniSync `torrent_*` |
| Parallel run 1–2 недели | Не требуется |
| dual-write / cutover legacy | Не требуется |
| Архив NextScene/NW после parity-аудита | Frozen/read-only; не runtime |

Скрипты миграции и Admin «Импорт из OnTrash» остаются в репо как **опциональный legacy-инструмент** (`LEGACY_ONTRASH_IMPORT_ENABLED`), по умолчанию скрыты.

## Product defaults (приняты)

См. [PRODUCT_DEFAULTS.md](PRODUCT_DEFAULTS.md):

- Бренд: **AniSync**
- Домен: **anisync.ru**
- Torrents: все зарегистрированные (+ feature flag)
- Регистрация: открытая (`REGISTRATION_OPEN=true`)

## Режим Torrents

Единственный режим: local `torrent_watchlist` / `torrent_releases` +
`TorrentWatcherService` в AniSync worker. Remote sidecar не поддерживается.

## Что делать дальше

1. ~~`TMDB_API_KEY`~~ — задан; health Bearer JWT.
2. ~~TS torrent watcher~~ — `TorrentWatcherService` + очередь / cron.
3. Deploy: `worker` + `scheduler` с `PROWLARR_*` / `TELEGRAM_*` / `REDIS_URL` на VPS.
4. Coolify: PG/Redis в одной сети ([COOLIFY_DEPLOY.md](COOLIFY_DEPLOY.md)).
5. После smoke владелец архивирует внешние GitHub repositories.

Трекер: [SERVICE_CONSOLIDATION_IMPLEMENTATION.md](SERVICE_CONSOLIDATION_IMPLEMENTATION.md).
