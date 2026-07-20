# Product defaults (принято, greenfield)

> Решение product owner / операционный default: **2026-07-20**.  
> Контекст: [GREENFIELD.md](GREENFIELD.md).

| Решение | Значение | Обоснование |
|---------|----------|-------------|
| Бренд | **AniSync** | Домен, README, monorepo |
| Домены | только `anisync.ru` | Legacy `ontrash.ru` / NW host — N/A без cutover |
| Torrents audience | **все зарегистрированные** + `TORRENTS_MODULE_ENABLED` | Homelab-friendly |
| Регистрация | **открытая** (`REGISTRATION_OPEN=true`) | Закрытие — flip flag |

Env: `REGISTRATION_OPEN`, `TORRENTS_MODULE_ENABLED`, `RELEASES_MODULE_ENABLED`, `NEXT_PUBLIC_*`.
