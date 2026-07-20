# Настройка PostgreSQL на VPS (legacy)

> **Внимание (2026-07-20):** целевой деплой — Coolify Database resource.  
> **Не коммитьте IP, пароли и connection strings.** Используйте плейсхолдеры.

## Типичная проблема

Локально БД отвечает, с Vercel/внешнего хоста — нет:

1. `listen_addresses` только `localhost`
2. Firewall режет 5432
3. `pg_hba.conf` не пускает внешние IP

## Шаги (общие)

1. `listen_addresses = '*'` в `postgresql.conf`
2. `hostssl ... md5` (или scram) в `pg_hba.conf` — лучше ограничить диапазонами IP
3. `ufw allow 5432/tcp` / firewalld — только если действительно нужен публичный доступ
4. `DATABASE_URL=...?sslmode=require` только в секретах окружения
5. Отдельный DB-user с сильным паролем (не `postgres` superuser)

## Безопаснее

- Coolify Postgres **без** публичного порта + private network
- Cloudflare Tunnel / SSH tunnel вместо открытого 5432

## Ротация

Если в git когда-либо светились host/password — смените пароль и пересмотрите `pg_hba.conf`.
