# Контракт модуля AniSync

> **Версия:** 1.0  
> **Дата:** 2026-07-20  
> **Связанные документы:** [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md), [SERVICE_CONSOLIDATION_PLAN.md](SERVICE_CONSOLIDATION_PLAN.md)

---

## 1. Цель

Единый способ добавлять bounded context (Anime, Releases, Torrents, будущие модули) **без правки соседних доменов** и без нового HTTP-сервера.

Платформа — **modular monorepo**:

| Слой | Путь | Роль |
|------|------|------|
| Web BFF | `apps/web` | Next.js: UI + Route Handlers |
| Packages | `packages/*` | Общая платформа (по мере нужды) |
| Workers | `apps/web/scripts/{worker,scheduler}.ts` | BullMQ jobs модулей |
| Docs | `docs/`, `docs/modules/` | Архитектура по модулям |

---

## 2. Структура модуля

```
apps/web/src/modules/<name>/
├── manifest.ts      # id, nav, featureFlag, enabledByDefault
├── api/             # доменная логика / handlers (вызываются из app/api)
├── ui/              # pages/components (опционально; страницы могут жить в app/[locale])
├── jobs.ts          # опционально: BullMQ queues / handlers
└── index.ts         # re-export manifest (+ публичный API модуля)
```

Route Handlers в `apps/web/src/app/api/<name>/*` остаются **тонкими** (auth + вызов module api).

Префикс API: `/api/<name>/*` (исключения platform: `/api/auth`, `/api/user`, `/api/health`).

---

## 3. Манифест

```ts
export type ModuleNavItem = {
  href: string;       // путь без locale, напр. '/releases'
  labelKey: string;   // ключ next-intl
  order?: number;
};

export type ModuleManifest = {
  id: string;                    // 'anime' | 'releases' | 'torrents' | ...
  featureFlag: string;           // env / settings key
  enabledByDefault: boolean;
  nav: ModuleNavItem[];
  apiPrefix?: string;            // default `/api/${id}`
};
```

Регистрация: `apps/web/src/modules/registry.ts` импортирует все манифесты.

Платформа читает registry для:

- `PlatformNav` / mobile nav
- feature flags (`src/lib/feature-flags.ts` + `user_settings.enabled_modules`)
- worker job registration (`jobs.ts`)

---

## 4. Чеклист нового модуля

1. Создать `apps/web/src/modules/<name>/` с `manifest.ts` и `index.ts`.
2. Добавить feature flag в env + `feature-flags.ts`.
3. Зарегистрировать в `registry.ts`.
4. Добавить тонкие routes в `src/app/api/<name>/`.
5. Добавить страницы в `src/app/[locale]/<name>/` (или `modules/<name>/ui` + re-export).
6. Миграции Drizzle — только additive, в `apps/web/drizzle/`.
7. Документ: `docs/modules/<NAME>_ARCHITECTURE.md`.
8. Запись в `docs/CHANGELOG.md`.
9. При необходимости — i18n ключи в `messages/ru.json` и `en.json`.
10. Stub-модуль с `enabledByDefault: false` не должен ломать prod.

**Запрещено:** править код соседнего модуля «для удобства»; общие вещи — в `platform` или `packages/*`.

---

## 5. packages/* — когда выносить

Выносить в `packages/` только если:

- появился **второй** TypeScript-потребитель, или
- циклические импорты внутри `apps/web` мешают сборке.

Кандидаты: `db`, `config`, `feature-flags`, `observability`.  
Домены (`anime`, `releases`, …) **не** дробить на packages на старте.

---

## 6. Polyglot sidecars

Тяжёлые/зрелые Python-воркеры живут в `services/<name>/`.  
Web ходит к ним через internal HTTP + service token (см. Torrents).  
UI и единый auth — только в `apps/web`.

---

## 7. Документация модулей

| Модуль | Документ |
|--------|----------|
| Platform | [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) |
| Anime | [modules/ANIME_ARCHITECTURE.md](modules/ANIME_ARCHITECTURE.md) |
| Releases | [modules/RELEASES_ARCHITECTURE.md](modules/RELEASES_ARCHITECTURE.md) |
| Torrents | [modules/TORRENTS_ARCHITECTURE.md](modules/TORRENTS_ARCHITECTURE.md) |
