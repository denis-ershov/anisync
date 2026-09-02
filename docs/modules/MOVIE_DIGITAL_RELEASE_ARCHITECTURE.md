# Агрегация дат цифрового релиза фильмов

> **Версия:** 2.3  
> **Дата:** 2026-09-02  
> **Код:** `movie-digital-release-date-service.ts`, `movie-digital-release-pick.ts`, `tmdb/digital-release-dates.ts`, `release-catalog-aggregator.ts`, `release-watchlist-service.ts`

---

## Назначение

Единая **мульти-источниковая** агрегация даты цифрового релиза фильма для Discover-каталога, поиска, карточек, модальных окон деталей, watchlist, дашборда и расписания торрентов.

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

2. **Фильтрация каталога предстоящих релизов и 7-дневного расписания (Вариант А)**:
   - В `pickEarliestDigitalCandidate(candidates, from, toExclusive)` каноническая дата релиза проверяется на принадлежность окну `[from, toExclusive)`.
   - Если фильм уже вышел в цифре до начала окна (`canonicalDate < from`, например `2026-07-21 < 2026-09-02`), он **строго отклоняется** (`null`) и не попадает в расписание как новый релиз.
   - В `ReleaseCatalogAggregator` фильмы, чей цифровой релиз состоялся до начала каталожного окна, исключаются из списка предстоящих релизов.

3. **Самовосстановление и синхронизация Watchlist (`ReleaseWatchlistService.listForUser`)**:
   - При запросе пользовательского Watchlist даты фильмов сверяются с `MovieDigitalReleaseDateService.resolveDisplay`.
   - Если в БД хранилась устаревшая или смещенная дата (например `2026-09-02`), она мгновенно нормализуется до канонической (`2026-07-21`), фоново обновляя строку в базе данных.
   - Дашборд недели (`buildWeekSchedule`) получает канонические даты, исключая уже вышедшие фильмы из расписания на сегодня.

4. **Отображение в UI (Поиск, Карточки, Модальные окна)**:
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

