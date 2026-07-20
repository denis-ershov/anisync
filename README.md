# AniSync (monorepo)

Персональный хаб: **Anime** + **Releases** (TMDB) + **Torrents** (встроенный TS watcher).

## Структура

```
anisync/
├── apps/web                 # Next.js BFF (UI + API)
├── packages/                # платформенные пакеты (по нужде)
├── docs/                    # архитектура + MODULE_CONTRACT
└── docker-compose.yml       # local: web, worker, scheduler, postgres, redis
```

Контракт модулей: [docs/MODULE_CONTRACT.md](docs/MODULE_CONTRACT.md)  
План объединения: [docs/SERVICE_CONSOLIDATION_PLAN.md](docs/SERVICE_CONSOLIDATION_PLAN.md)  
Деплой: [docs/COOLIFY_DEPLOY.md](docs/COOLIFY_DEPLOY.md)

## Быстрый старт

```bash
cp apps/web/.env.example apps/web/.env
pnpm install
pnpm dev                 # http://localhost:9002
# или полный стек:
pnpm docker:up
```

Скрипты из корня проксируются в `@anisync/web` (`dev`, `build`, `test`, `worker`, `scheduler`, `db:*`).

## Модули

| Модуль | Путь | API |
|--------|------|-----|
| Anime | `apps/web/src/modules/anime` | `/api/anime`, library |
| Releases | `apps/web/src/modules/releases` | `/api/releases/*` |
| Torrents | `apps/web/src/modules/torrents` | `/api/torrents/*` + BullMQ watcher |
| Platform | `apps/web/src/modules/platform` | auth, user, health |

Feature flags: `RELEASES_MODULE_ENABLED`, `TORRENTS_MODULE_ENABLED` (+ `NEXT_PUBLIC_*`).
