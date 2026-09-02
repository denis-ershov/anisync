# Агрегация дат цифрового релиза фильмов

> **Версия:** 2.2  
> **Дата:** 2026-09-02  
> **Код:** `movie-digital-release-date-service.ts`, `movie-digital-release-pick.ts`, `tmdb/digital-release-dates.ts`, `release-catalog-aggregator.ts`

---

## Назначение

Единая **мульти-источниковая** агрегация даты цифрового релиза фильма для Discover-каталога, поиска, карточек, модальных окон деталей, watchlist и расписания торрентов.

---

## Источники и Приоритеты

| Источник | API | Что собираем |
|----------|-----|----------------|
| **TMDB** | `/movie/{id}/release_dates` | Все digital-like entries (type 4 + SVOD type 6 с платформой в `note`) по всем регионам |
| **Watchmode** | `/title/movie-{tmdbId}/details` | `release_date` (если `WATCHMODE_API_KEY`) |
| **Trakt** | `/movies/tmdb:{id}/releases/us` | Все `release_type: digital` (если `TRAKT_CLIENT_ID`) |

### Приоритеты регионов и типов:
1. **US регион** (TMDB US, Watchmode US, Trakt US) — первичный ориентир для цифровых релизов.
2. **PVOD (покупка/аренда)** — определяет официальную каноническую дату выхода тайтла в цифре.
3. **SVOD (подписочные стриминги)** — фиксируются как вторичные окна доступности.

---

## Алгоритм и Вариант А (Строгий каталог предстоящих релизов)

1. **Каноническая дата релиза (`resolveDisplay(tmdbId)`)**:
   - `collectCandidates(tmdbId)` собирает кандидатов со всех источников.
   - Ищется минимальная календарная дата среди US-кандидатов (или глобально, если US отсутствует).
   - *Пример «Мандалорец и Грогу»*: PVOD US `2026-07-21` + Disney+ US `2026-09-02` → каноническая дата: **`2026-07-21`**.

2. **Фильтрация каталога предстоящих релизов (Discover, Вариант А)**:
   - В `ReleaseCatalogAggregator` (`resolveFromTmdbId`, `resolveFromImdb`, `enrichTmdbFromExternal`) для фильмов каноническая дата TMDB (`detail.releaseDate`) является приоритетной над сторонними календарями стримингов.
   - Если каноническая дата релиза меньше начала каталожного окна (`releaseDate < from`, например `2026-07-21 < 2026-09-01`), тайтл считается **уже вышедшим** и исключается из выборки предстоящих релизов этого месяца.
   - Если каноническая дата релиза попадает в диапазон `[from, toExclusive)`, фильм отображается с точной датой своего релиза как в карточке списка, так и в деталях.

3. **Отображение в UI (Поиск, Карточки, Модальные окна)**:
   - В поиске, модальном окне деталей и карточках используется `resolveDisplay(tmdbId)`.
   - В модальном окне отображается оригинальное название (`originalTitle`) и кликабельная ссылка на IMDb.

---

## Архитектура производительности и кэширования

| Уровень | Технология | Описание |
|---------|------------|----------|
| **L1 (In-Memory)** | SingleFlight / Request Coalescing | Карта `activePoolFetches` объединяет параллельные запросы к одинаковым фильтрам каталога. |
| **L2 (Redis Pool)** | Page-Independent Pool Cache | Кэширование пула элементов `releases:catalog:pool:v5:...` с мгновенной пагинацией в памяти (<5ms). |
| **L3 (HTTP / CDN)** | `Cache-Control` | `public, max-age=60, s-maxage=300, stale-while-revalidate=1800` на `/api/releases/content/upcoming`. |
| **Zero DB Writes** | Read-Only GET Path | Устранены вызовы `MediaExternalIdsService.upsert` при обработке GET-запросов каталога. |

---

## Потребители

- `MovieDigitalReleaseDateService` — единая точка входа
- `getMovieDigitalReleaseDateDisplay` — каноническая дата для UI, поиска и модалок
- `ReleaseCatalogAggregator.getUpcoming` — пул и пагинация предстоящих релизов
- `ReleaseScheduleDateService.resolveMovie`
- `getContentDetail` (movie)

