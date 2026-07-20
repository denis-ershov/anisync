# Releases beta cutover (2.4.1)

> Чеклист включения модуля Releases на staging/beta без миграции OnTrash prod-данных.

---

## Предусловия

- [ ] `npm run db:migrate` на целевой БД
- [ ] `TMDB_API_KEY` валиден (`GET /api/releases/health` → `tmdb.ok: true`)
- [ ] Redis доступен (опционально, но рекомендуется для cache/precompute)
- [ ] Worker/scheduler запущены (`ANISYNC_PROCESS=worker`, `scheduler`)

---

## Переменные окружения (Coolify / `.env`)

```env
RELEASES_MODULE_ENABLED=true
NEXT_PUBLIC_RELEASES_MODULE_ENABLED=true
TMDB_API_KEY=<key>
REDIS_URL=redis://anisync-redis:6379
```

Остальные `TMDB_*` и `RELEASES_WATCHLIST_*` — по умолчанию из `.env.example`.

---

## Порядок включения

1. Deploy с флагами **выключенными** → smoke: login, anime module, `/api/health/db`
2. Включить `RELEASES_MODULE_ENABLED=true` (server only) → проверить API:
   - `GET /api/releases/health`
   - `GET /api/releases/content/upcoming?page=1`
3. Включить `NEXT_PUBLIC_RELEASES_MODULE_ENABLED=true` → redeploy → UI:
   - `/releases/dashboard`, `/releases/discover`, `/releases/watchlist`
4. Мониторинг 24–48ч: `GET /api/health/slo`, ошибки TMDB, latency upcoming

---

## Rollback

```env
RELEASES_MODULE_ENABLED=false
NEXT_PUBLIC_RELEASES_MODULE_ENABLED=false
```

Redeploy. Данные `release_watchlist_entries` сохраняются в БД.

---

## Не входит в beta

- Миграция users/watchlist из OnTrash (2.3.x) — blocked
- 301 redirect `ontrash.ru` (2.4.3) — blocked
- Parallel run 1 неделя (2.4.2) — после beta на prod

---

## Связанные документы

- [RELEASES_ARCHITECTURE.md](RELEASES_ARCHITECTURE.md)
- [SERVICE_CONSOLIDATION_IMPLEMENTATION.md](SERVICE_CONSOLIDATION_IMPLEMENTATION.md)
