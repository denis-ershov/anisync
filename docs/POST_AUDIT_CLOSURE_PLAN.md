# План закрытия результатов parity-аудита

> Дата: 2026-07-20  
> Основание: [SERVICE_CONSOLIDATION_PLAN.md](SERVICE_CONSOLIDATION_PLAN.md),
> [SERVICE_CONSOLIDATION_IMPLEMENTATION.md](SERVICE_CONSOLIDATION_IMPLEMENTATION.md),
> `Pre-deploy final check` (`pre-deploy_final_check_f148b4c4.plan.md`, внешний immutable plan),
> [LEGACY_PARITY_AUDIT.md](LEGACY_PARITY_AUDIT.md).

Этот документ создан после аудита и не заменяет исходный consolidation-план.

## P0 — deployment gate

1. **TS watcher parity**
   - файлы: `torrent-watcher-service.ts`, `torrent-local-store.ts`, torrent API/UI;
   - задачи: metadata, preferences, bencode, pin/pin-only/hunting/adopt, default limit=1;
   - тесты: pure logic + hunting/adopt behavior;
   - приёмка: Python sidecar не участвует в scan/notify.
2. **Single runtime**
   - файлы: compose, Dockerfile, Coolify/architecture/env docs;
   - задачи: удалить remote facade, `TORRENT_SERVICE_URL`, sidecar service и bridge endpoint;
   - приёмка: zero runtime references.
3. **Greenfield bootstrap**
   - portable admin bootstrap script и documented first deploy;
   - CI PostgreSQL 18: migrate на чистой БД и assert ключевых таблиц.
4. **Verification**
   - test, isolated typecheck, production build, compose config;
   - smoke 1–11 на web/worker/scheduler.

## P1 — подтверждённый пользовательский parity

1. Releases watchlist sort/pagination и grid/list.
2. Digital release regional tests.
3. Удаление NightWatcher user-facing copy и hardcoded Windows env paths.
4. Синхронизация API/schema/parity/architecture docs.

## P2 — исключённое или отложенное

- CSV/batch/admin logs/standalone notifications history: intentionally removed;
- legacy DB migration и alias compatibility: not applicable для пустой БД;
- direct tracker-specific URL fallback и extra indexes: post-deploy optimization;
- Discover page-size selector и Dashboard list mode: не входят в обязательный product flow.

## Зависимости

`audit → P0 watcher → single runtime cleanup → P1 UX/docs → archive → verification/deploy`.

## Rollback

Откат выполняется redeploy предыдущего AniSync image и restore PostgreSQL backup.
Python NightWatcher и NextScene не являются rollback-целями.

## Результат выполнения 2026-07-20

- P0/P1 код и документация закрыты; sidecar/remote facade удалены.
- `pnpm test`: 41/41; `pnpm typecheck`: pass; `pnpm build`: pass.
- Configured AniSync DB migration: pass; CI добавляет clean PostgreSQL 18 migration.
- HTTP smoke: liveness/pages/TMDB/local torrents/guards/legacy 404 — pass.
- Локальная readiness ожидаемо `503`: `REDIS_URL` — internal Coolify network.
- Prowlarr из Windows недоступен; повторный worker/scheduler smoke выполняется после
  Coolify deploy в одной сети.
- GitHub archive подготовлен, но на рабочей машине нет `gh`; NightWatcher содержит
  незакоммиченные изменения, поэтому внешние repositories не мутировались автоматически.
