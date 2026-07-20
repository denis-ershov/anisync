# План объединения сервисов в единую платформу AniSync

> **Версия:** 1.2
> **Дата:** 2026-05-25 (обновлено 2026-07-20)
> **Главный репозиторий:** `anisync`
> **Объединяемые сервисы:** AniSync, NightWatcher, OnTrash (NextScene)
> **Трекер реализации:** [SERVICE_CONSOLIDATION_IMPLEMENTATION.md](SERVICE_CONSOLIDATION_IMPLEMENTATION.md)
> **Режим запуска:** [GREENFIELD.md](GREENFIELD.md) — **с нуля, без переноса данных** (принято 2026-07-20)

---

## Содержание

1. [Резюме и цель](#1-резюме-и-цель)
2. [Текущее состояние трёх сервисов](#2-текущее-состояние-трёх-сервисов)
3. [Сравнительный анализ](#3-сравнительный-анализ)
4. [Целевая концепция продукта](#4-целевая-концепция-продукта)
5. [Целевая архитектура](#5-целевая-архитектура)
6. [Стратегия плавного перехода](#6-стратегия-плавного-перехода)
7. [Поэтапный план миграции](#7-поэтапный-план-миграции)
8. [Унификация данных и схемы БД](#8-унификация-данных-и-схемы-бд)
9. [Унификация аутентификации](#9-унификация-аутентификации)
10. [Карта функций и приоритетов](#10-карта-функций-и-приоритетов)
11. [Инфраструктура и деплой](#11-инфраструктура-и-деплой)
12. [Риски и митигация](#12-риски-и-митигация)
13. [Критерии готовности по фазам](#13-критерии-готовности-по-фазам)
14. [Приложения](#14-приложения)

---

## 1. Резюме и цель

### 1.1 Зачем объединять

Три сервиса решают **смежные задачи персонального медиа-трекинга**, но разнесены по стеку, БД, auth и деплою:

| Сервис | Фокус | Пользовательский сценарий |
|--------|-------|---------------------------|
| **AniSync** | Аниме, синхронизация Shikimori / MAL / AniList | «Веду список аниме, смотрю по расписанию, синхронизирую с трекерами» |
| **OnTrash** (NextScene) | Цифровые релизы фильмов и сериалов (TMDB) | «Слежу за digital-релизами, веду watchlist, календарь на неделю» |
| **NightWatcher** | Торрент-мониторинг IMDb watchlist (Prowlarr) | «Когда появится раздача — пришли в Telegram» |

Объединение даёт:

- **Один аккаунт** вместо трёх систем входа
- **Единый watchlist** с разными «режимами» (аниме / релизы / торренты)
- **Общие уведомления** (in-app + Telegram + будущие каналы)
- **Меньше дублирования** TMDB-метаданных, расписаний, PostgreSQL
- **Единый UI/UX** (RU/EN, тёмная тема, адаптив)

### 1.2 Принципы объединения

1. **AniSync — хост-платформа** (Next.js 15, PostgreSQL, Drizzle, prod `anisync.ru`)
2. **Greenfield first** — пустые БД, без ETL из OnTrash/NW; Strangler Fig / parallel run — только если позже появятся живые legacy-данные (см. [GREENFIELD.md](GREENFIELD.md))
3. **Bounded contexts** — аниме, кино/сериалы, торренты — отдельные домены внутри одного продукта
4. **Не big-bang** — каждая фаза даёт ценность и откатываема
5. **Документация синхронна с кодом** — CHANGELOG + `*_ARCHITECTURE.md` по правилам проекта

### 1.3 Что НЕ делаем в первой волне

- Полный parity pin/hunting/bencode с Python NightWatcher (MVP TS watcher уже в AniSync)
- Слияние доменов «аниме ↔ TMDB» в одну таблицу каталога (разные источники и ID)
- Перенос данных / dual-write / parallel run со старыми prod-сервисами (greenfield — N/A)

---

## 2. Текущее состояние трёх сервисов

### 2.1 AniSync (`anisync`) — главный

| Аспект | Детали |
|--------|--------|
| **Домен** | Синхронизация аниме-листов, недельное расписание, прогресс по эпизодам |
| **Стек** | Next.js 15, React 19, TypeScript, Tailwind, shadcn/ui, Drizzle, PostgreSQL |
| **Auth** | Регистрация/login, сессии в `user_sessions`, cookie `auth-token` |
| **Интеграции** | Shikimori (GraphQL+REST), MAL, AniList (OAuth + PKCE) |
| **Фон** | `sync_jobs`, `user_entry_changes`, internal cron routes + `CRON_SECRET` |
| **Деплой** | Сейчас: Vercel + VPS PostgreSQL. **Целевое:** Coolify (Docker), см. [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) |
| **i18n** | next-intl (`ru`, `en`) |
| **Уникальное** | Provider adapter registry, rate-limit aware Shikimori, out-of-sync state |

**Ключевые таблицы:** `users`, `user_settings`, `user_integrations`, `anime_catalog`, `anime_service_ids`, `user_library_entries`, `sync_jobs`, `notifications`.

**Технический долг:** legacy `user_anime_list`; README устарел (JWT/SQLite); неиспользуемые deps (`firebase`, `jsonwebtoken`); cron — programmatic fetch из `SyncService` (нет `vercel.json` schedule).

---

### 2.2 OnTrash / NextScene (`NextScene`)

| Аспект | Детали |
|--------|--------|
| **Домен** | Календарь digital-релизов фильмов/сериалов, discover, watchlist |
| **Стек** | pnpm monorepo: React 19 + Vite 7, Express 5, Drizzle, OpenAPI → Orval |
| **Auth** | express-session, cookie `ontrash.sid`, `app_sessions`, роли admin/user |
| **Интеграции** | TMDB API v3 (только backend) |
| **Деплой** | Один Docker-контейнер, Coolify, `ontrash.ru` |
| **i18n** | RU/EN в клиенте |
| **Уникальное** | Сложная логика digital US→RU→earliest, фильтрация жанров, серверная пагинация после пост-фильтров, PWA, `/api/healthz/slo` |

**Ключевые таблицы:** `users`, `watchlist_items`, `app_sessions` (последняя — только raw SQL, вне Drizzle-схемы).

**Технический долг:** нет CI; bootstrap DDL дублирует Drizzle; `app_sessions` существует только в raw SQL (вне Drizzle-схемы); `lib/integrations/*` объявлен glob-ом в `pnpm-workspace.yaml`, но директории нет вообще.

---

### 2.3 NightWatcher (`nightwatcher`)

| Аспект | Детали |
|--------|--------|
| **Домен** | Мониторинг торрентов по IMDb watchlist → Telegram |
| **Стек** | Python 3.11, FastAPI, SQLAlchemy async (raw SQL), Jinja2 UI |
| **Auth** | Один пароль `ADMIN_PASSWORD` + обязательный `SESSION_SECRET`, сессия `nightwatcher_session`; **single-tenant** — понятия `user_id` нет нигде в коде и схеме |
| **Интеграции** | Prowlarr, TMDB, TVMaze, Telegram (aiogram) |
| **Процессы** | API + Watcher (30 мин), `multiprocessing` или supervisor |
| **Деплой** | Docker, docker-compose, systemd; **нет CI** |
| **Уникальное** | Magnet pipeline, content_hash, сезонный мониторинг, фильтры качества/озвучки, дедуп btih |

**Ключевые таблицы:** `imdb_watchlist`, `torrent_releases`, `notifications_history`.

**Технический долг:** monolithic HTML (`app/templates/index.html` ~4308 строк); `check_interval` в БД не влияет на watcher (интервал hardcoded `1800` в `run.py`); смешанные runtime/file миграции; single-tenant — добавление `user_id` потребует миграции.

---

## 3. Сравнительный анализ

### 3.1 Матрица пересечений

| Возможность | AniSync | OnTrash | NightWatcher | Пересечение |
|-------------|---------|---------|--------------|-------------|
| Watchlist | ✅ library | ✅ watchlist_items | ✅ imdb_watchlist | **Высокое** — разная модель, общая UX-цель |
| Недельное расписание | ✅ anime | ✅ dashboard | ❌ | **Среднее** — перенос паттерна UI |
| Уведомления | ✅ рабочая таблица + API/сервис (типы `new_episode`/`sync_*`/`system`); нет `module`/`channel`/`payload` | ❌ | ✅ Telegram (глобальный `chat_id`) | **Высокое** — единый notification hub |
| TMDB | ❌ | ✅ core | ✅ metadata | **Среднее** — общий TMDB-модуль в AniSync |
| OAuth внешние | ✅ 3 провайдера | ❌ | ❌ | Уникально AniSync |
| Торренты / Prowlarr | ❌ | ❌ | ✅ core | Уникально NightWatcher |
| Мультиязычность | ✅ | ✅ | ❌ (UI RU) | **Высокое** |
| PostgreSQL | ✅ | ✅ | ✅ | **Инфраструктурное** |
| Session auth | ✅ | ✅ | ✅ (admin) | **Высокое** — унификация |

### 3.2 Матрица различий (границы доменов)

| Измерение | AniSync | OnTrash | NightWatcher |
|-----------|---------|---------|--------------|
| ID каталога | MAL/AniList/Shikimori + internal catalog | `tmdb_id` | `imdb_id` |
| Тип контента | Аниме | movie / show | movie / tv |
| Источник правды прогресса | Внешний провайдер (primary) | Локальный watchlist | Локальный enabled flag |
| Фоновая работа | sync_jobs, entry_changes | Нет (только TMDB cache) | watcher loop |
| Публичный API | Next.js Route Handlers | Express REST + OpenAPI | FastAPI + HTML |

**Вывод:** объединять нужно на уровне **платформы (users, notifications, navigation)**, а не на уровне **одной таблицы каталога**.

### 3.3 Дублирование, которое устраняем

| Дубль | Где | Решение |
|-------|-----|---------|
| TMDB client + кэш | OnTrash, NightWatcher | `@anisync/integrations-tmdb` в monorepo |
| Users / sessions | 3 схемы | Единая `users` + `user_sessions` AniSync |
| Watchlist UX | 3 UI | Единый shell: разделы «Аниме» / «Релизы» / «Торренты» |
| PostgreSQL инстансы | До 3 БД | Одна БД, schema prefixes или PostgreSQL schemas |
| RU/EN | AniSync, OnTrash | next-intl везде |

### 3.4 Синергии после объединения

1. **OnTrash watchlist + NightWatcher:** пользователь добавляет фильм в «Релизы», опционально включает «Следить за торрентом» → тот же `tmdb_id`/`imdb_id` маппится через TMDB find.
2. **AniSync notifications + NightWatcher Telegram:** один центр настроек каналов.
3. **Единое расписание:** вкладки «Аниме на неделе» / «Сериалы на неделе» / «Digital-релизы».

---

## 4. Целевая концепция продукта

### 4.1 Позиционирование

**AniSync Platform** (рабочее название) — персональный хаб отслеживания:

- **Модуль Anime** — текущий AniSync без регрессий
- **Модуль Releases** — бывший OnTrash (TMDB, digital calendar)
- **Модуль Torrents** — бывший NightWatcher (Prowlarr, Telegram)

Бренд на проде может остаться `anisync.ru` с подразделами:

- `/` или `/anime` — аниме-расписание (текущая главная)
- `/releases` — каталог и watchlist релизов
- `/torrents` — торрент-мониторинг (admin/power-user)

### 4.2 Персоны пользователей

| Персона | Модули | Миграция |
|---------|--------|----------|
| Аниме-фан | Anime | Без изменений URL |
| Кино/сериалы | Releases | Redirect с `ontrash.ru` |
| Power user / homelab | Torrents | Бывший NightWatcher admin |

### 4.3 Нефункциональные требования

- **Zero-downtime** для AniSync prod при фазах 0–2
- **Обратная совместимость API** AniSync минимум 1 релизный цикл
- **Feature flags** для новых модулей
- **Мультиязычность** без хардкодов (правило проекта)
- **Адаптив:** без таблиц на mobile/tablet для списков

---

## 5. Целевая архитектура

### 5.1 Высокоуровневая схема (целевое состояние)

```mermaid
flowchart TB
    subgraph client [Клиент]
        Web[Next.js App - anisync.ru]
        PWA[PWA / Mobile Web]
    end

    subgraph platform [AniSync Platform - anisync]
        API[Next.js API Routes]
        Anime[Domain: Anime]
        Releases[Domain: Releases]
        Torrents[Domain: Torrents API Facade]
        Notify[Notification Service]
        Auth[Auth / Users]
    end

    subgraph workers [Фоновые воркеры]
        SyncW[Anime Sync Worker]
        TorrentW[NightWatcher Watcher - Python]
    end

    subgraph data [Data]
        PG[(PostgreSQL)]
    end

    subgraph external [Внешние API]
        SH[Shikimori / MAL / AniList]
        TMDB[TMDB]
        PR[Prowlarr]
        TG[Telegram]
    end

    Web --> API
    API --> Auth
    API --> Anime
    API --> Releases
    API --> Torrents
    API --> Notify
    Anime --> PG
    Releases --> PG
    Torrents --> PG
    Notify --> PG
    SyncW --> PG
    TorrentW --> PG
    Anime --> SH
    Releases --> TMDB
    TorrentW --> PR
    TorrentW --> TMDB
    Notify --> TG
    API -.->|internal HTTP| SyncW
    API -.->|webhook/queue| TorrentW
```

### 5.2 Рекомендуемая структура репозитория (целевая)

Вариант **Modular monorepo** (зафиксировано 2026-07-20). Контракт модулей: [MODULE_CONTRACT.md](MODULE_CONTRACT.md).

```
anisync/
├── apps/
│   └── web/                            # Next.js BFF (UI + Route Handlers)
│       ├── src/
│       │   ├── app/                    # routing: pages + тонкие API
│       │   ├── components/             # shared UI
│       │   └── modules/
│       │       ├── platform/           # auth, nav, notifications
│       │       ├── anime/
│       │       ├── releases/
│       │       └── torrents/           # facade к Python sidecar
│       ├── scripts/                    # worker.ts, scheduler.ts
│       └── drizzle/                    # миграции Drizzle
├── packages/                           # db / config / flags / observability (по нужде)
├── services/
│   └── nightwatcher/                   # Python FastAPI + watcher
├── scripts/                            # кросс-сервисные data-migration утилиты
├── docs/
│   ├── MODULE_CONTRACT.md
│   ├── PLATFORM_ARCHITECTURE.md
│   ├── modules/                        # ANIME / RELEASES / TORRENTS
│   └── CHANGELOG.md
├── pnpm-workspace.yaml
└── package.json                        # root scripts → filter web
```

**Почему не Express + Vite monorepo OnTrash:** домен Releases уже в Next.js; два HTTP-сервера на одном домене усложняют auth и деплой.

**Почему NightWatcher остаётся Python в `services/`:** зрелый watcher (`app/watcher.py`, ~1745 строк); риск регрессий при rewrite высокий; UI — только в `apps/web`.

### 5.3 Границы API (целевые префиксы)

| Префикс | Назначение | Источник |
|---------|------------|----------|
| `/api/auth/*` | Единый auth | AniSync (расширить ролями) |
| `/api/user/*` | Профиль, settings, notifications | AniSync |
| `/api/anime/*`, `/api/user/library/*` | Anime domain | AniSync |
| `/api/releases/content/*` | TMDB proxy, upcoming, search | OnTrash `/api/content/*` |
| `/api/releases/watchlist/*` | Watchlist релизов | OnTrash `/api/watchlist/*` |
| `/api/torrents/*` | Watchlist, releases, health | NightWatcher JSON API |
| `/api/internal/*` | Cron, workers | AniSync + новые job types |

### 5.4 Notification Hub (новый компонент)

Единая таблица `notifications` (расширить существующую в AniSync):

| Тип | Источник | Канал |
|-----|----------|-------|
| `anime_new_episode` | Anime sync | in-app, push (будущее) |
| `release_reminder` | Releases | in-app |
| `torrent_found` | NightWatcher | in-app + Telegram |
| `sync_failed` | Anime | in-app |

Пользовательские настройки: `notification_channels` (telegram_chat_id, email, in_app).

---

## 6. Стратегия плавного перехода

### 6.1 Паттерн Strangler Fig

```mermaid
flowchart LR
    subgraph phase1 [Фаза 0-1]
        U[Пользователь] --> AS[anisync.ru]
        U --> OT[ontrash.ru]
        U --> NW[nightwatcher:8000]
    end

    subgraph phase2 [Фаза 2-3]
        U2[Пользователь] --> AS2[anisync.ru]
        AS2 --> OTproxy[/releases - новый модуль]
        AS2 --> NWapi[/api/torrents - facade]
        NWworker[NW Python worker]
        NWapi --> NWworker
    end

    subgraph phase3 [Фаза 4-5]
        U3[Пользователь] --> AS3[anisync.ru only]
        OTredirect[ontrash.ru 301]
        NWredirect[nightwatcher 301]
        OTredirect --> AS3
        NWredirect --> AS3
    end
```

### 6.2 Правила cutover

1. **Dual-write** при миграции watchlist OnTrash → AniSync (короткое окно)
2. **Read fallback** — если новый API пуст, читать из legacy БД (только фаза миграции)
3. **Feature flag** `RELEASES_MODULE_ENABLED`, `TORRENTS_MODULE_ENABLED`
4. **Redirect 301** только после 2 недель стабильного parallel run
5. **Rollback** — флаги off, DNS обратно на старые хосты

### 6.3 Коммуникация с пользователями

| Этап | Действие |
|------|----------|
| За 2 недели до redirect | Баннер в OnTrash / NightWatcher |
| В день redirect | Email/Telegram (если есть) |
| После | Страница «Что изменилось» в `/help/migration` |

---

## 7. Поэтапный план миграции

### Обзор фаз

| Фаза | Название | Длительность* | Риск | Пользовательский эффект |
|------|----------|---------------|------|-------------------------|
| 0 | Подготовка | 1–2 нед | Низкий | Нет |
| 1 | Foundation | 2–3 нед | Низкий | Нет |
| 2 | Releases MVP | 4–6 нед | Средний | OnTrash → preview на anisync |
| 3 | Torrents integration | 3–4 нед | Средний | NW через facade |
| 4 | Data migration & cutover | 2–3 нед | Высокий | Redirect доменов |
| 5 | Decommission | 1–2 нед | Низкий | Только AniSync |

\*Оценка для одного разработчика; параллелить фазы 2 и 3 подготовку можно частично.

---

### Фаза 0: Подготовка (1–2 недели)

**Цель:** зафиксировать baseline, не ломая prod.

| # | Задача | Артефакт |
|---|--------|----------|
| 0.1 | Inventory env vars всех трёх сервисов | `docs/ENV_INVENTORY.md` |
| 0.2 | Снимок схем БД (pg_dump --schema-only) | `docs/schemas/*.sql` |
| 0.3 | Матрица API endpoints | `docs/API_MAPPING.md` |
| 0.4 | Убрать секреты из git (VERCEL_SETUP.md и т.п.) | security fix |
| 0.5 | Включить CI для NightWatcher (минимум lint/test) | `.github/workflows/` |
| 0.6 | Feature flag инфраструктура в AniSync | `src/lib/feature-flags.ts` |
| 0.7 | Создать `docs/CHANGELOG.md` | changelog |

**Критерий выхода:** документы готовы, AniSync prod без изменений поведения.

---

### Фаза 1: Foundation — единый фундамент (2–3 недели)

**Цель:** подготовить платформу без переноса UI OnTrash/NW.

| # | Задача | Детали |
|---|--------|--------|
| 1.1 | Расширить `users` | Поля: `role` (`user` \| `admin`), `display_name` |
| 1.2 | Унифицировать sessions | Оставить `user_sessions` + cookie `auth-token`; документировать mapping с `ontrash.sid` |
| 1.3 | Notification hub v1 | Расширить `notifications`: `module`, `payload` JSONB, `channel` |
| 1.4 | User settings | `notification_preferences`, `enabled_modules[]` |
| 1.5 | Navigation shell | Sidebar: Anime (active), Releases (disabled), Torrents (disabled) |
| 1.6 | TMDB integration package | Порт `backend/src/lib/tmdb.ts` → `src/lib/integrations/tmdb.ts` |
| 1.7 | ID mapping table | `media_external_ids` (tmdb_id, imdb_id, mal_id, …) |
| 1.8 | `docs/PLATFORM_ARCHITECTURE.md` | Архитектура платформы |

**Миграции Drizzle:** только additive migrations, без breaking changes.

**Критерий выхода:** TMDB health check из AniSync; admin role в БД; флаги модулей в settings.

---

### Фаза 2: Releases MVP — перенос OnTrash (4–6 недель)

**Цель:** модуль «Релизы» на `anisync.ru/releases` в beta.

#### 2.1 Backend

| # | Задача | From → To |
|---|--------|-----------|
| 2.1.1 | Content API | `/api/content/*` → `/api/releases/content/*` |
| 2.1.2 | Watchlist API | `/api/watchlist/*` → `/api/releases/watchlist/*` |
| 2.1.3 | Drizzle schema | `watchlist_items` → `release_watchlist_entries` |
| 2.1.4 | OpenAPI | Перенести `lib/api-spec` в `packages/api-spec` или `docs/openapi/` |
| 2.1.5 | SLO middleware | Опционально: pino + metrics endpoint |

#### 2.2 Frontend

| # | Задача |
|---|--------|
| 2.2.1 | Страницы Discover, Watchlist, Dashboard (releases) под `[locale]/releases/*` |
| 2.2.2 | Адаптировать компоненты OnTrash под shadcn/ui + Tailwind AniSync |
| 2.2.3 | React Query hooks — регенерация Orval или ручные hooks |
| 2.2.4 | PWA: решить — единый manifest AniSync или отложить |

#### 2.3 Параллельный run

```
ontrash.ru (legacy)  ──dual-write──►  anisync releases DB
                     ◄──read compare──   (shadow mode, admin only)
```

| # | Задача |
|---|--------|
| 2.3.1 | Скрипт миграции users OnTrash → AniSync (username collision policy) |
| 2.3.2 | Скрипт миграции watchlist_items |
| 2.3.3 | Admin UI: «Импорт из OnTrash» (опционально для пользователей) |

#### 2.4 Cutover OnTrash

1. `RELEASES_MODULE_ENABLED=true` для beta-тестеров
2. 1 неделя parallel
3. `ontrash.ru` → 301 на `anisync.ru/releases`
4. Read-only legacy container ещё 2 недели

**Критерий выхода:** parity checklist (см. §13) для Releases ≥ 90%.

---

### Фаза 3: Torrents integration — NightWatcher (3–4 недели)

**Цель:** не переписывать watcher; интегрировать через API facade.

#### 3.1 Архитектура интеграции

```
AniSync Next.js  --/api/torrents/*-->  NightWatcher FastAPI (internal network)
                                              │
                                         watcher.py
```

| # | Задача |
|---|--------|
| 3.1.1 | Service token auth между AniSync ↔ NW (`INTERNAL_SERVICE_SECRET`) |
| 3.1.2 | Multi-user NW: привязать `imdb_watchlist.user_id` (миграция) |
| 3.1.3 | Facade routes: list, add, toggle, releases, health |
| 3.1.4 | UI `/[locale]/torrents` — порт логики из Jinja в React (поэтапно) |
| 3.1.5 | Telegram: настройка `telegram_chat_id` per user в AniSync settings |

#### 3.2 Связь Releases ↔ Torrents

| # | Задача |
|---|--------|
| 3.2.1 | Кнопка «Следить за торрентом» в карточке release (если есть imdb_id) |
| 3.2.2 | TMDB → IMDb lookup при добавлении |

#### 3.3 Параллельный run

- NightWatcher продолжает работать для текущего admin
- Новые пользователи — только через AniSync
- Уведомления дублировать в `notifications` + Telegram до cutover

**Критерий выхода:** добавление IMDb id из AniSync → уведомление в Telegram; watcher стабилен 7 дней.

---

### Фаза 4: Data migration & domain cutover (2–3 недели)

| # | Задача |
|---|--------|
| 4.1 | Финальная миграция данных OnTrash (если не сделана) |
| 4.2 | Финальная миграция NightWatcher watchlist → `torrent_watchlist` |
| 4.3 | Объединить PostgreSQL (один инстанс, backup policy) |
| 4.4 | 301 redirects: `ontrash.ru`, nightwatcher host |
| 4.5 | Отключить dual-write |
| 4.6 | Обновить `docs/CHANGELOG.md` |

---

### Фаза 5: Decommission (1–2 недели)

| # | Задача |
|---|--------|
| 5.1 | Архив репозиториев NextScene, nightwatcher (read-only) |
| 5.2 | Удалить legacy Docker/Coolify сервисы |
| 5.3 | Опционально: порт watcher на TypeScript (долгосрочный backlog) |
| 5.4 | Финальный аудит документации |

---

## 8. Унификация данных и схемы БД

### 8.1 Принцип: один PostgreSQL, логические домены

Рекомендуется **одна БД `anisync`** с префиксами таблиц или PostgreSQL schemas:

- `public` — users, sessions, notifications (shared)
- anime tables — без префикса (текущие)
- `release_*` — бывший OnTrash
- `torrent_*` — бывший NightWatcher

### 8.2 Целевые таблицы (additive)

#### Shared

```sql
-- Расширение существующих
users (+ role, avatar_url, ...)
user_settings (+ enabled_modules jsonb, notification_preferences jsonb)
notifications (+ module, channel, payload jsonb)

-- Новая
media_external_ids (
  id, media_type, -- 'anime'|'movie'|'show'
  tmdb_id, imdb_id, mal_id, anilist_id, shikimori_id,
  created_at
)
```

#### Releases (из OnTrash)

```sql
release_watchlist_entries (
  id, user_id,
  tmdb_id, type, status, -- watching|plan
  title, title_ru, poster_path, ...
  next_episode_season, next_episode_number, next_episode_date,
  UNIQUE(user_id, tmdb_id, type)
)
```

#### Torrents (из NightWatcher)

```sql
torrent_watchlist (
  id, user_id, -- NEW: multi-tenant
  imdb_id, type, enabled, target_season,
  preferred_quality, preferred_audio, ...
)
torrent_releases ( ... как в NW, + user_id через watchlist )
torrent_notification_log ( ... )
```

### 8.3 Маппинг ID между доменами

| From | To | Метод |
|------|-----|-------|
| tmdb_id → imdb_id | TMDB `/find` | При «Следить за торрентом» |
| anime catalog | — | Не смешивать с TMDB без явного «связанного тайтла» |
| mal_id ↔ shikimori | Уже в `anime_service_ids` | Расширить `media_external_ids` |

### 8.4 Скрипты миграции (черновик порядка)

1. `scripts/migrate/ontrash-users.ts`
2. `scripts/migrate/ontrash-watchlist.ts`
3. `scripts/migrate/nightwatcher-watchlist.ts`
4. `scripts/migrate/verify-counts.ts`

Каждый скрипт: **dry-run** → **staging** → **prod** с отчётом расхождений.

---

## 9. Унификация аутентификации

### 9.1 Целевая модель

| Аспект | Решение |
|--------|---------|
| Метод | Email/username + password (как AniSync) |
| Сессия | `user_sessions` + httpOnly `auth-token` |
| OAuth | Только для anime providers (не ломать) |
| Роли | `user`, `admin` (из OnTrash) |
| NW legacy | `ADMIN_PASSWORD` → admin user + отключить отдельный login |

### 9.2 Миграция пользователей OnTrash

| Политика | Действие |
|----------|----------|
| Username свободен | Создать user, импортировать hash |
| Username занят | `{username}_ot` или merge by email |
| Admin | `role=admin` |

Пароли: bcrypt совместим (OnTrash cost 12, AniSync cost 10 — принять оба, rehash on login).

### 9.3 Session cutover

- Не переносить старые cookies — пользователи логинятся заново один раз
- Баннер: «Мы объединили сервисы, войдите снова»

---

## 10. Карта функций и приоритетов

### 10.1 Must have (MVP объединения)

| Функция | Модуль | Источник |
|---------|--------|----------|
| Anime schedule + sync | Anime | AniSync |
| Releases upcoming + watchlist | Releases | OnTrash |
| Torrent watchlist + Telegram notify | Torrents | NightWatcher |
| Единый login | Platform | AniSync |
| RU/EN UI | Platform | AniSync i18n |

### 10.2 Should have (после MVP)

| Функция | Модуль |
|---------|--------|
| «Следить за торрентом» из карточки release | Cross |
| In-app уведомления для torrent | Platform |
| Импорт OnTrash watchlist UI | Releases |
| PWA единый | Platform |
| OpenAPI публичная документация | Platform |

### 10.3 Could have (backlog)

| Функция | Модуль |
|---------|--------|
| Anime ↔ TMDB linking (один тайтл) | Cross |
| Discord notifications | Platform |
| TS watcher вместо Python | Torrents |
| MAL/AniList как primary для UI | Anime |

### 10.4 Won't have (явно исключено)

- Единая таблица каталога для аниме и фильмов
- Big-bang переписывание NightWatcher до стабилизации facade

---

## 11. Инфраструктура и деплой

> **Детальная архитектура:** [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) — Coolify, BullMQ, Redis, observability, retention, PWA.

### 11.1 Целевая инфраструктура (Coolify)

| Компонент | Решение |
|-----------|---------|
| Web | Coolify Application: `anisync-web` (Next.js standalone Docker) |
| Workers | Coolify Application: `anisync-worker` + `anisync-scheduler` (отдельные процессы, тот же образ) |
| Очереди | **BullMQ + Redis 7** на отдельном Coolify Redis |
| Кэш | Тот же `anisync-redis` (разные DB index: очереди / TMDB / rate limits) |
| DB | **PostgreSQL 18** — отдельный Coolify Database resource `anisync-postgres` |
| Torrent worker | Coolify Application: `nightwatcher-api` + `nightwatcher-worker` (фаза 3) |
| Cron | BullMQ repeatable jobs (не HTTP self-dispatch) |
| Secrets | Coolify env/secrets, не в git |
| Logs | pino JSON → stdout; `DEBUG`/`DEBUG_MODULES` для отладки |
| PWA | Единый manifest + service worker (`@serwist/next`) |

### 11.2 Изменения по сервисам

| Сервис | Было | Станет |
|--------|------|--------|
| AniSync | Vercel + PG | Миграция на Coolify Docker (web + worker + scheduler) |
| OnTrash | Coolify Docker | Decommission после фазы 4 |
| NightWatcher | Docker/local | Worker only, UI через AniSync |

### 11.3 Новые переменные окружения (AniSync)

```env
# Feature flags
RELEASES_MODULE_ENABLED=false
TORRENTS_MODULE_ENABLED=false
REGISTRATION_OPEN=true
MAINTENANCE_MODE=false

# Redis / Queues (prod: internal URL от Coolify resource anisync-redis)
REDIS_URL=redis://anisync-redis:6379
BULLMQ_PREFIX=anisync

# Database (prod: internal URL от Coolify resource anisync-postgres)
DATABASE_URL=postgresql://user:pass@anisync-postgres:5432/anisync

# Observability
LOG_LEVEL=info
DEBUG=false
DEBUG_MODULES=
DEBUG_SQL=false
DEBUG_EXTERNAL_API=false
SENTRY_DSN=

# TMDB (from OnTrash)
TMDB_API_KEY=
TMDB_TIMEOUT_MS=10000
TMDB_RETRIES=2

# NightWatcher facade
TORRENT_SERVICE_URL=http://nightwatcher-api:8000
TORRENT_SERVICE_SECRET=

# Telegram (per-user config in DB, global bot token)
TELEGRAM_BOT_TOKEN=

# Data retention (days)
RETENTION_SYNC_JOBS_DAYS=180
RETENTION_NOTIFICATIONS_READ_DAYS=365
RETENTION_TORRENT_RELEASES_DAYS=180
```

### 11.4 Переменные NightWatcher (для справки при интеграции)

```env
ADMIN_PASSWORD=
SESSION_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
PROWLARR_URL=
PROWLARR_API_KEY=
TMDB_API_KEY=
DATABASE_URL=
```

### 11.5 CI/CD

| Repo | Действие |
|------|----------|
| anisync | Расширить CI: test releases module, worker smoke, migration dry-run, Docker build |
| nightwatcher | Добавить workflow: pytest, ruff |
| NextScene | Freeze; архив после cutover |

---

## 12. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Регрессия anime sync | Средняя | Критическое | Feature flags; E2E smoke; не трогать anime domain в фазе 2 |
| Потеря данных при миграции watchlist | Средняя | Высокое | Dry-run, dual-write, backup, verify-counts |
| Rate limit TMDB/Shikimori | Средняя | Среднее | Общий cache; раздельные quotas |
| Сложность NW multi-user | Высокая | Среднее | Сначала facade + admin; потом user_id в NW |
| Два стека UI (shadcn vs custom OnTrash) | Высокая | Среднее | Переписать Releases UI под design system AniSync |
| Vercel/Coolify timeout на тяжёлых запросах | Средняя | Среднее | BullMQ workers; Redis/PG cache; никакой тяжёлой работы в HTTP |
| Рост данных без retention | Высокая | Высокое | `maintenance.cleanup` queue + политики TTL (см. PLATFORM_ARCHITECTURE) |
| Нет Redis при scale-out | Средняя | Высокое | Redis с фазы 0.6; shared TMDB cache |
| Secrets в репозитории | Уже есть | Критическое | Ротация credentials, git filter-repo |

---

## 13. Критерии готовности по фазам

### Фаза 1 Done

- [ ] `media_external_ids` миграция применена
- [ ] TMDB `/api/releases/health` возвращает OK
- [ ] Feature flags работают
- [ ] `PLATFORM_ARCHITECTURE.md` создан

### Фаза 2 Done (Releases parity)

- [ ] Upcoming catalog: те же фильтры/сортировка, ±1 страница расхождения
- [ ] Watchlist CRUD
- [ ] Dashboard 7-day schedule
- [ ] Search
- [ ] Login/session через AniSync
- [ ] RU/EN
- [ ] Mobile без таблиц

### Фаза 3 Done (Torrents)

- [ ] Add/remove/toggle IMDb item
- [ ] Watcher находит релиз → Telegram
- [ ] In-app notification запись
- [ ] Health: DB + Prowlarr + Telegram

### Фаза 4 Done (Cutover)

- [ ] 0 потерянных записей watchlist (verify script)
- [ ] Redirects работают 48ч без инцидентов
- [ ] Legacy в read-only

---

## 14. Приложения

### 14.1 Сравнение технологических стеков

| | AniSync | OnTrash | NightWatcher |
|---|---------|---------|--------------|
| Runtime | Node 20 | Node 22 | Python 3.11 |
| Framework | Next.js 15 | Express 5 | FastAPI |
| ORM | Drizzle | Drizzle | Raw SQL |
| Frontend | RSC + Client | Vite SPA | Jinja |
| API contract | Ad-hoc routes | OpenAPI | Ad-hoc |
| Docker | Нет | Да | Да |
| CI | Да | Нет | Нет |

### 14.2 Первые 5 PR (рекомендуемый порядок)

1. `docs/` + feature flags + CHANGELOG
2. `users.role` + notification schema extension
3. `src/lib/integrations/tmdb.ts` + health route
4. `media_external_ids` migration
5. Navigation shell с disabled Releases/Torrents tabs

### 14.3 Связанные документы (создать по мере выполнения)

| Документ | Фаза |
|----------|------|
| `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md` (трекер статусов) | 0+ |
| `docs/ENV_INVENTORY.md` | 0 |
| `docs/API_MAPPING.md` | 0 |
| `docs/PLATFORM_ARCHITECTURE.md` | 1 |
| `docs/RELEASES_ARCHITECTURE.md` | 2 |
| `docs/TORRENTS_ARCHITECTURE.md` | 3 |
| `docs/CHANGELOG.md` | 0+ |

### 14.4 Решения, требующие подтверждения

Перед фазой 2 желательно зафиксировать с product owner:

1. **Бренд:** остаётся AniSync или новое имя платформы?
2. **Домены:** только `anisync.ru` или сохранить `ontrash.ru` как alias?
3. **Torrents для всех пользователей** или только admin/homelab?
4. **Монетизация/регистрация:** открытая регистрация OnTrash-style или invite-only?

---

## История документа

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2026-05-25 | Первоначальный план на основе анализа трёх codebases |
| 1.1 | 2026-06-15 | Верификация плана по коду; исправлены неточности; добавлен трекер `SERVICE_CONSOLIDATION_IMPLEMENTATION.md` |
| 1.1.1 | 2026-06-15 | Восстановление документов после случайного удаления |
| 1.2 | 2026-06-15 | Целевой деплой Coolify; BullMQ+Redis; observability/retention/PWA — см. `PLATFORM_ARCHITECTURE.md` |
| 1.2.1 | 2026-06-16 | Зафиксирована версия СУБД: PostgreSQL **18** |
| 1.2.2 | 2026-06-16 | PG 18 и Redis — **отдельные** Coolify Database resources (не в образе app) |

---

*Документ подготовлен для реализации в репозитории `anisync`. Следующий шаг: фаза 0 — `ENV_INVENTORY.md` и `API_MAPPING.md`. Статусы задач — в [SERVICE_CONSOLIDATION_IMPLEMENTATION.md](SERVICE_CONSOLIDATION_IMPLEMENTATION.md).*
