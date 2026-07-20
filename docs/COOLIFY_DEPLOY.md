# Деплой AniSync в Coolify

> **Версия:** 4.0  
> **Дата:** 2026-07-20  
> **Связанные документы:** [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md), [ENV_INVENTORY.md](ENV_INVENTORY.md), [`.env.example`](../.env.example)

Целевой прод-деплой — **Coolify** + ресурс типа **Docker Compose** на файле [`docker-compose.yml`](../docker-compose.yml) из корня репозитория.

Все секреты и URL задаются в **Environment Variables** ресурса Coolify (не коммитятся в git). Coolify формирует `.env` для подстановки `${VAR}` в compose.

---

## 1. Что поднимает compose

| Сервис | Роль |
|--------|------|
| `postgres` | PostgreSQL 18 (данные в volume `anisync_pg_data`) |
| `redis` | Redis 7 + AOF (volume `anisync_redis_data`) |
| `web` | Next.js UI + API, миграции при старте (`RUN_MIGRATIONS=true`) |
| `worker` | BullMQ consumers (sync, torrents watcher, …) |
| `scheduler` | Repeatable jobs (singleton) |

Публичный HTTP — только у `web`, контейнерный порт **3000**. Coolify Proxy / Traefik вешает домен на этот сервис.

---

## 2. Создание ресурса в Coolify

1. **Servers** → ваш сервер с Docker.
2. **+ New** → **Docker Compose** (не «Dockerfile» / не три отдельных Application).
3. Подключите Git-репозиторий AniSync (ветка `main` / prod).
4. **Docker Compose Location:** `docker-compose.yml` (корень репо).
5. Base Directory: `/` (корень).
6. Сохраните ресурс → откройте вкладку **Environment Variables**.

---

## 3. Environment Variables (Coolify UI)

Скопируйте ключи из [`.env.example`](../.env.example). Ниже — обязательный минимум и значения для стека **внутри** этого compose.

### 3.1. Публичный URL

| Ключ | Пример | Примечание |
|------|--------|------------|
| `APP_BASE_URL` | `https://anisync.ru` | OAuth callbacks, server-side ссылки |
| `NEXT_PUBLIC_BASE_URL` | `https://anisync.ru` | **Build-arg** — вшивается в клиентский бандл |

В Coolify для `NEXT_PUBLIC_*` включите флаг **Available at Buildtime** / Build Variable (название зависит от версии UI), иначе после деплоя в UI останется старый домен.

### 3.2. Postgres и Redis внутри compose

| Ключ | Пример |
|------|--------|
| `POSTGRES_USER` | `anisync` |
| `POSTGRES_PASSWORD` | длинный случайный пароль |
| `POSTGRES_DB` | `anisync` |
| `DATABASE_URL` | `postgresql://anisync:PASSWORD@postgres:5432/anisync` |
| `REDIS_URL` | `redis://redis:6379` |
| `BULLMQ_PREFIX` | `anisync` |

Хосты в URL — **имена сервисов** compose (`postgres`, `redis`), не `localhost` и не публичный IP сервера.

### 3.3. Секреты

| Ключ | Требование |
|------|------------|
| `JWT_SECRET` | ≥ 16 символов |
| `CRON_SECRET` | ≥ 16 символов |
| `INTERNAL_SERVICE_SECRET` | ≥ 16 символов |

### 3.4. Модули и интеграции

| Ключ | Зачем |
|------|--------|
| `RELEASES_MODULE_ENABLED` / `NEXT_PUBLIC_RELEASES_MODULE_ENABLED` | Releases |
| `TORRENTS_MODULE_ENABLED` / `NEXT_PUBLIC_TORRENTS_MODULE_ENABLED` | Torrents |
| `REGISTRATION_OPEN` / `NEXT_PUBLIC_REGISTRATION_OPEN` | Регистрация |
| `TMDB_API_KEY` | Releases (TMDB) |
| `PROWLARR_URL`, `PROWLARR_API_KEY` | Torrents |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Уведомления |
| `SHIKIMORI_*`, `MYANIMELIST_*`, `ANILIST_*` | OAuth Anime |

Полный список — [ENV_INVENTORY.md](ENV_INVENTORY.md).

### 3.5. Bootstrap admin (один раз)

| Ключ | Пример |
|------|--------|
| `BOOTSTRAP_ADMIN_USERNAME` | `admin` |
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@anisync.ru` |
| `BOOTSTRAP_ADMIN_PASSWORD` | сильный пароль |

После первого успешного деплоя создайте админа командой из §7, затем пароль можно убрать из env.

---

## 4. Домен и Proxy

1. В ресурсе Compose откройте сервис **`web`**.
2. Добавьте FQDN: `anisync.ru` (+ `www` при необходимости).
3. Включите HTTPS (Let's Encrypt через Coolify).
4. Порт сервиса для proxy: **3000** (как в `ports: - '3000'` у `web`).

`APP_BASE_URL` и `NEXT_PUBLIC_BASE_URL` должны совпадать с этим доменом (`https://…`).

После смены домена или `NEXT_PUBLIC_*` — **Redeploy with rebuild** (не только Restart).

---

## 5. Первый деплой

1. Заполните Environment Variables (§3).
2. **Deploy** (Coolify сделает `docker compose build` + `up`).
3. Дождитесь healthy у `postgres`, `redis`, `web`.
4. Проверьте:
   - `https://anisync.ru/api/health`
   - `https://anisync.ru/api/health/ready` → `status: ready`
5. Создайте админа (§7).
6. Smoke: `/api/torrents/health`, логи `worker` / `scheduler` в Coolify.

Обновление с Git:

1. Push в отслеживаемую ветку (или webhook).
2. Coolify Redeploy → миграции снова выполнит entrypoint `web`.

---

## 6. Как env попадает в контейнеры

1. Coolify UI → генерирует `.env` в артефактах деплоя.
2. Compose подставляет `${VAR}` в `build.args` и `environment:` каждого сервиса.
3. Явные оверрайды в YAML:
   - `web`: `RUN_MIGRATIONS` (default `true`), `NODE_ENV=production`
   - `worker` / `scheduler`: `RUN_MIGRATIONS=false`

`.env` **не** лежит в git (`.gitignore`). В compose нет `env_file: .env` — только явный `environment:`, чтобы поведение было предсказуемым и в свежих версиях Coolify.

---

## 7. Первый админ

В Coolify → сервис `web` → **Execute Command** / Terminal:

```bash
node --import tsx scripts/seed-bootstrap-admin.ts
```

Скрипт читает `BOOTSTRAP_ADMIN_*` и `DATABASE_URL` из окружения контейнера. Работает только при пустой таблице `users`.

---

## 8. Альтернатива: внешние Postgres / Redis в Coolify

Если БД уже созданы как отдельные Coolify **Database** resources:

1. В `docker-compose.yml` можно оставить только `web` / `worker` / `scheduler` (убрать `postgres`/`redis` и их `depends_on`) — либо завести отдельный override (сейчас в репо полный стек).
2. В Environment Variables подставьте **internal** connection strings из карточек Database (hostname вида `xxxx` в сети Coolify), например:

```env
DATABASE_URL=postgresql://user:pass@<coolify-postgres-host>:5432/anisync
REDIS_URL=redis://default:pass@<coolify-redis-host>:6379/0
```

3. Compose-приложение и Database-ресурсы должны быть на **одном сервере / в одной Docker-сети Coolify**, иначе internal hostname не резолвится.

Рекомендуемый путь для greenfield — **полный compose из репо** (§1–5): один ресурс, меньше ручной связки сетей.

---

## 9. Частые ошибки

### Build: пустой `NEXT_PUBLIC_BASE_URL`

Переменная не помечена как build-time в Coolify, либо не задана до первого build. Задайте URL и сделайте rebuild.

### Readiness 503

- Неверный `DATABASE_URL` / `REDIS_URL` (часто `localhost` вместо `postgres` / `redis`).
- Postgres ещё не healthy — смотрите логи `postgres`.
- Пароль в `DATABASE_URL` не совпадает с `POSTGRES_PASSWORD`.

### OAuth redirect mismatch

`APP_BASE_URL` и callback URL в приложениях Shikimori/MAL/AniList должны быть `https://ваш-домен/...`.

### Prowlarr недоступен из worker

`PROWLARR_URL` должен открываться **из контейнера** на сервере Coolify (публичный IP/домен или общая Docker-сеть), не только с вашего домашнего ПК.

### UI-флаги не сменились

`NEXT_PUBLIC_*` вшиты на build → Redeploy **with build**.

### Worker: нет `tsx`

Пересоберите образы без кэша (Force rebuild в Coolify).

---

## 10. Откат и бэкапы

- **Приложение:** Redeploy предыдущего commit / tag в Coolify.
- **Данные:** volume `anisync_pg_data` — настройте backup в Coolify (или `pg_dump` по cron). Не удаляйте volumes при `down`, если нужны данные.
- Redis AOF — кэш/очереди; критичное состояние живёт в Postgres.

---

## 11. Соответствие файлов

| Файл | Назначение |
|------|------------|
| [`docker-compose.yml`](../docker-compose.yml) | Единственный compose для Coolify |
| [`apps/web/Dockerfile`](../apps/web/Dockerfile) | Образ web / worker / scheduler |
| [`.env.example`](../.env.example) | Шаблон ключей для Coolify Environment Variables |
| [`docs/ENV_INVENTORY.md`](ENV_INVENTORY.md) | Полный инвентарь env |

---

*При изменении топологии обновить [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) и [CHANGELOG.md](CHANGELOG.md).*
