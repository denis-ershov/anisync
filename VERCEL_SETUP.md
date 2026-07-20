# Настройка базы данных на Vercel (legacy)

> **Внимание (2026-07-20):** продакшен целевой — Coolify (`docs/COOLIFY_DEPLOY.md`).  
> Этот файл оставлен как историческая инструкция. **Не храните реальные пароли в git.**

## Проблема: Database connection test failed

Если локально `/api/health/db` → ok, а на хостинге — ошибка подключения:

1. PostgreSQL не принимает внешние IP (см. `VPS_POSTGRES_SETUP.md`)
2. Неверные env на хостинге

## Решение

### 1. Environment Variables

Задайте `DATABASE_URL` только в UI хостинга (не в репозитории):

```
postgresql://USER:PASSWORD@HOST:5432/anisync?sslmode=require
```

### 2. Проверки

- Firewall / `pg_hba.conf` разрешают IP платформы
- Порт 5432 доступен
- После смены env — Redeploy

### 3. Диагностика

```
GET /api/health/env
GET /api/health/db
```

### 4. Рекомендация

Предпочтительно Coolify + отдельный `anisync-postgres` resource, а не прямой VPS+Vercel.

## Ротация секретов

Если пароль БД когда-либо попадал в git/документацию — **смените пароль PostgreSQL** и обновите `DATABASE_URL` на всех окружениях.
