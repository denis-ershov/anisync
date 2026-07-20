# Decommission внешних репозиториев

> **Дата:** 2026-07-20  
> **Статус:** parity завершён; внешние remotes frozen, GitHub Archive выполняет владелец

## Текущее состояние

| Бывший репозиторий | В monorepo | Действие |
|--------------------|------------|----------|
| `anisync` | корень + `apps/web` | единственный активный remote |
| `nightwatcher` | TS port в `apps/web` | GitHub **Archive** |
| `NextScene` (OnTrash) | не импортирован (логика в `apps/web` Releases) | GitHub **Archive** + README «moved to anisync» |

## Чеклист archive (вручную на GitHub)

1. Убедиться, что Coolify/CI собирают только `anisync`.
2. `/api/torrents/health` возвращает `storage: local`; worker выполняет scan.
3. В старых репозиториях: Settings → Archive repository.
4. В README старых репо добавить ссылку на `anisync`.
5. Удалить deploy-сервисы Coolify для legacy NextScene / standalone NW, если они были созданы.

## Не делать

- Force-push / удаление истории без бэкапа.
- Удаление GitHub repo; используется только GitHub Archive/read-only.
