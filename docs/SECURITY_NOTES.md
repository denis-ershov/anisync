# Security notes (consolidation)

## 2026-07-20

В git (исторически в `VERCEL_SETUP.md` / `VPS_POSTGRES_SETUP.md`) светились:

- PostgreSQL password
- VPS host IP
- connection string examples with real credentials

**Сделано в репо:** тексты заменены на плейсхолдеры.

**Сделайте вручную (обязательно):**

1. Сменить пароль пользователя PostgreSQL на VPS / Coolify.
2. Обновить `DATABASE_URL` во всех окружениях (Coolify, локальный `.env`, любые CI secrets).
3. Проверить, что старый пароль нигде не используется.
4. Не возвращать secrets в markdown; только Coolify/env UI.

Корневой `.env` и `apps/web/.env` в `.gitignore` — не коммитить.
