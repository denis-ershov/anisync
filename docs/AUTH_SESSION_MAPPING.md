# Auth & session mapping (AniSync ↔ OnTrash ↔ NightWatcher)

> Связано: [SERVICE_CONSOLIDATION_PLAN.md](SERVICE_CONSOLIDATION_PLAN.md) §9, задача **1.2**.

## Целевая модель (AniSync)

| Аспект | Значение |
|--------|----------|
| Cookie | `auth-token` (httpOnly) |
| Хранение | таблица `user_sessions` |
| Пароль | bcrypt (принимаем cost 10 и 12; rehash on login по желанию) |
| Роли | `user` \| `admin` |

OAuth провайдеров anime (Shikimori / MAL / AniList) не меняется.

## OnTrash → AniSync

| OnTrash | AniSync | Миграция |
|---------|---------|----------|
| Cookie `ontrash.sid` | `auth-token` | **не переносится** |
| Таблица `app_sessions` (sid, sess, expire) | `user_sessions` | не копируется |
| `users.password_hash` (bcrypt) | `users.password_hash` | copy as-is (`migrate-ontrash-users.ts`) |
| `users.role` | `users.role` | `admin` / `user` |
| нет email | `{username}@ontrash.migrated` | synthetic |

**Session cutover:** пользователи логинятся заново один раз. UI-баннер (опционально): «Сервисы объединены — войдите снова».

ID map: `scripts/.ontrash-user-map.json` (`legacy_user_id` → `anisync_user_id`).

## NightWatcher → AniSync

| NW | AniSync | Примечание |
|----|---------|------------|
| Cookie `nightwatcher_session` + `ADMIN_PASSWORD` | обычный login admin | legacy Jinja UI до cutover |
| нет multi-user auth | `X-AniSync-User-Id` на internal API | facade `/api/torrents/*` |
| `TELEGRAM_CHAT_ID` env | `notification_preferences.telegramChatId` | per-user + env fallback |

Отдельный NW login отключается после стабильного facade (фаза 3.3 / 4).

## Политика коллизий username (OnTrash)

1. Username свободен → создать user, импортировать hash.
2. Username/email занят → map на существующего (`skipped` в скрипте) или `--prefix`.
3. Admin → `role=admin`.

## Проверка после миграции

```bash
pnpm exec tsx scripts/migrate-verify-counts.ts
```
