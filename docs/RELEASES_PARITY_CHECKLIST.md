# Releases parity checklist (код vs OnTrash)

> **Дата:** 2026-07-20  
> **Без prod OnTrash DB** — сверка по `NextScene` + `apps/web` Releases.

| Capability | OnTrash (NextScene) | AniSync Releases | Parity |
|------------|---------------------|------------------|:------:|
| Auth session | `ontrash.sid` | `auth-token` / `user_sessions` | `[x]` (re-login) |
| Trending | `/api/content/trending` | `/api/releases/content/trending` | `[x]` |
| Upcoming + filters | `/api/content/upcoming` | `/api/releases/content/upcoming` | `[~]` (нужна сверка цифр на prod) |
| Search | `/api/content/search` | `/api/releases/content/search` | `[x]` |
| Genres | `/api/content/genres` | `/api/releases/content/genres` | `[x]` |
| Detail | `/api/content/:id` | `/api/releases/content/[tmdbId]` | `[x]` |
| Watchlist CRUD | `/api/watchlist` | `/api/releases/watchlist` | `[x]` |
| Dashboard 7-day | frontend | `/releases` dashboard | `[x]` |
| RU/EN | i18n | next-intl | `[x]` |
| Mobile cards | PWA SPA | card grid + bottom nav | `[x]` |
| TMDB cache | Redis | Redis + worker precompute | `[x]` |
| User migration | — | CLI + Admin UI | `[x]` code / apply blocked |
| Domain 301 | — | DNS blocked | `[blocked]` |

**Оценка:** ≥ 90% функционального parity в коде; prod content delta — после access к OnTrash DB.
