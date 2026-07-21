# Деплой AniSync в Coolify

> **Версия:** 7.0  
> **Дата:** 2026-07-20  
> **Связанные документы:** [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md), [ENV_INVENTORY.md](ENV_INVENTORY.md), [`.env.example`](../.env.example)

Целевой прод-деплой — **Coolify** + ресурс типа **Docker Compose** ([`docker-compose.yml`](../docker-compose.yml)).

Секреты — в **Environment Variables** Coolify.  
PostgreSQL и Redis — **отдельные** Coolify Database resources. В compose только приложение; подключение через `DATABASE_URL` и `REDIS_URL`. Переменные `POSTGRES_*` **не нужны**.

---

## 1. Что поднимает compose

| Сервис | Роль |
|--------|------|
| `web` | Next.js UI + API, миграции при старте |
| `worker` | BullMQ consumers |
| `scheduler` | Repeatable jobs |

Postgres и Redis **не** входят в compose — Coolify Database + **Connect To Predefined Network**.  
В env только полные строки `DATABASE_URL` и `REDIS_URL` (internal hostname из карточки ресурса).

---

## 2. Создание ресурса

1. Coolify → **+ New** → **Docker Compose**.
2. Git-репозиторий AniSync, compose file: `docker-compose.yml`.
3. Environment Variables (§3).
4. Домен на сервис **`web`**, порт `3000`, HTTPS.

---

## 3. Environment Variables

Шаблон: [`.env.example`](../.env.example).

### Обязательные

| Ключ | Пример |
|------|--------|
| `APP_BASE_URL` | `https://anisync.ru` |
| `NEXT_PUBLIC_BASE_URL` | `https://anisync.ru` (**build-time** в Coolify) |
| `DATABASE_URL` | полная строка `postgresql://…` или `postgres://…` |
| `REDIS_URL` | полная строка Coolify Redis (internal) — **обязателен** |
| `JWT_SECRET` | ≥ 16 символов |
| `CRON_SECRET` | ≥ 16 символов |
| `INTERNAL_SERVICE_SECRET` | ≥ 16 символов |

### Redis / Postgres

1. Создайте Coolify **Database** (PostgreSQL + Redis) или используйте существующие.
2. В ресурсе Compose включите **Connect To Predefined Network** (общая сеть с Database).
3. В Environment Variables вставьте **internal** connection strings из карточек Database.
4. `REDIS_URL` **не оставляйте пустым** — entrypoint упадёт с ошибкой.
5. `POSTGRES_*` не нужны.

### Интеграции (по модулям)

`TMDB_API_KEY`, `PROWLARR_*`, `TELEGRAM_*`, `SHIKIMORI_*` / `MYANIMELIST_*` / `ANILIST_*` — см. [ENV_INVENTORY.md](ENV_INVENTORY.md).

### Bootstrap admin (один раз)

`BOOTSTRAP_ADMIN_USERNAME` / `_EMAIL` / `_PASSWORD` — затем:

```bash
node --import tsx scripts/seed-bootstrap-admin.ts
```

(в Terminal сервиса `web`).

---

## 4. DATABASE_URL

1. Создайте PostgreSQL 18 в Coolify (**Database**) или используйте уже существующий.
2. Скопируйте connection string в `DATABASE_URL`.
3. Если БД — Coolify Database на том же сервере: используйте **internal** URL (hostname из карточки БД), чтобы `web`/`worker` резолвили хост из Docker-сети.
4. Публичный IP/порт — только если БД реально доступна с хоста compose снаружи.

`POSTGRES_*` задавать не нужно — всё внутри одной строки.

---

## 5. Первый деплой

1. Заполните env (§3), особенно `DATABASE_URL` и `REDIS_URL`.
2. **Deploy** (rebuild образа).
3. Проверьте `https://<domain>/api/health` и `/api/health/ready`.
4. Bootstrap admin (§3).

### Health checks (Coolify / Traefik)

В `docker-compose.yml` заданы Docker health checks для всех сервисов:

| Сервис | Проверка | Назначение |
|--------|----------|------------|
| `web` | `GET /api/health` (liveness) | Traefik маршрутизирует трафик только на healthy `web` |
| `worker` | ping Redis | фоновый процесс + доступность очередей |
| `scheduler` | ping Redis | repeatable jobs + Redis |

**В Coolify UI** для Compose-ресурса **не дублируйте** health check в настройках сервиса — достаточно блока `healthcheck` в compose (при конфликте приоритет у Dockerfile/compose).

- Liveness (`/api/health`) — быстрый, без БД; используется в health check контейнера `web`.
- Readiness (`/api/health/ready`) — DB + Redis; для ручной диагностики, не для Docker health check (иначе Traefik снимет маршрут при кратковременных сбоях БД).

Если статус **Running (unknown)** — redeploy после обновления compose; если **unhealthy** — смотрите логи сервиса и `docker inspect` → `Health`.

---

## 6. Частые ошибки

### Restart loop / Exited (10x restarts)

1. В Coolify откройте **Logs** у конкретного сервиса (`web` / `worker` / `scheduler`) — там будет точная ошибка.
2. Частые причины:
   - **`REDIS_URL is required`** — не задан или пустой; нужен internal URL Coolify Redis + predefined network.
   - **`DATABASE_URL` / migration failed** — БД недоступна; проверьте Connect To Predefined Network и internal URL.
   - **`JWT_SECRET`** короче 16 символов или пустой.
3. После правок env — Redeploy (для кода с новым entrypoint нужен rebuild образа).

### Readiness 503 / не подключается к БД

- `DATABASE_URL` недоступен из контейнера (internal hostname другой сети, firewall, неверный пароль).
- Проверьте логи `web` на старте миграций.

### Build: старый домен в UI

`NEXT_PUBLIC_BASE_URL` не помечен build-time → Redeploy **with build**.

### OAuth redirect mismatch

`APP_BASE_URL` = публичный `https://` домен.

### Prowlarr

`PROWLARR_URL` должен открываться из контейнера `worker`.

---

## 7. Откат и бэкапы

- Приложение: предыдущий commit в Coolify.
- Данные: бэкапы внешнего Postgres (Coolify Database backups).
- Redis Coolify Database — очереди/кэш, не источник истины.

---

*При изменении топологии — [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) и [CHANGELOG.md](CHANGELOG.md).*
