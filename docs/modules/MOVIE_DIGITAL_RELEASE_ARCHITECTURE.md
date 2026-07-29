# Агрегация дат цифрового релиза фильмов

> **Версия:** 2.0  
> **Дата:** 2026-07-29  
> **Код:** `movie-digital-release-date-service.ts`, `tmdb/digital-release-dates.ts`

---

## Назначение

Единая **мульти-источниковая** агрегация даты цифрового релиза фильма для Releases, torrent watchlist и расписания.

---

## Источники

| Источник | API | Что собираем |
|----------|-----|----------------|
| **TMDB** | `/movie/{id}/release_dates` | Все digital-like entries (type 4 + SVOD type 6 с платформой в `note`) по **всем регионам** |
| **Watchmode** | `/title/movie-{tmdbId}/details` | `release_date` (если `WATCHMODE_API_KEY`) |
| **Trakt** | `/movies/tmdb:{id}/releases/us` | Все `release_type: digital` (если `TRAKT_CLIENT_ID`) |

---

## Алгоритм

1. `collectCandidates(tmdbId)` — параллельный fetch всех источников.
2. Объединить в один пул `DigitalReleaseCandidate[]`.
3. **Display** (карточки, модалки): `min(date)` по всему пулу.
4. **Window** (Discover, 7-day schedule): `min(date)` среди candidates в `[from, toExclusive)`.
5. `source` победившего candidate сохраняется в `ReleaseScheduleSlot`.

Пример FNAF 2: TMDB US 2026-08-03 + Watchmode 2025-12-23 → **2025-12-23**.

---

## TMDB-специфика

Парсинг в `digital-release-dates.ts`:

- type 4 = Digital (VOD purchase/rent)
- type 6 + platform note = SVOD (Peacock, Netflix, …)
- Theatrical / Physical не участвуют

В агрегаторе TMDB даёт **несколько** candidates (по регионам и платформам), не одну «каноническую» дату.

---

## Кэш

| Ключ | Содержимое |
|------|------------|
| `movie:digital:candidates:v2:{tmdbId}` | полный список candidates |
| `tmdb:movie:{id}:digital_display_v3` | resolved display date |
| `tmdb:movie-release:v3:{id}:{from}:{toExclusive}` | windowed date |
| `trakt:movie-digital-releases:{tmdbId}:us` | Trakt US digital dates |
| `watchmode:movie-release:{tmdbId}` | Watchmode date |

---

## Потребители

- `MovieDigitalReleaseDateService` — единая точка входа
- `getMovieDigitalReleaseDate` / `getMovieDigitalReleaseDateDisplay` (TMDB client)
- `ReleaseScheduleDateService.resolveMovie`
- `torrent-local-store.enrichTorrentSchedule`
- `getContentDetail` (movie)

---

## Ключевые решения

- **Cross-source min** — сравниваем даты между TMDB, Watchmode и Trakt, не «TMDB first».
- **US Trakt** — `/releases/us` для согласованности с US digital market.
- **TMDB multi-entry** — каждая digital-запись в пуле, не только earliest per region.
