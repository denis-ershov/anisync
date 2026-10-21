# Архитектура модуля Torrents

> **Версия:** 2.1  
> **Дата:** 2026-07-21  
> **Режим:** greenfield — только **TypeScript watcher в AniSync**

---

## Назначение

Модуль **Torrents** — мониторинг раздач через Prowlarr, хранение в AniSync `torrent_*`, уведомления Telegram + in-app. Python-процесс отсутствует.

---

## Компоненты (целевой стек)

| Слой | Путь | Ответственность |
|------|------|-----------------|
| Facade API | `apps/web/src/app/api/torrents/*` | Auth → `torrent-facade` |
| Local store | `torrent-local-store.ts` | CRUD `torrent_watchlist` / `torrent_releases`; enrich digital/premiere dates via TMDB |
| **TS Watcher** | `torrent-watcher-service.ts` | Scan due items → Prowlarr → filters → DB → notify |
| Prowlarr | `integrations/prowlarr/client.ts` | searchByImdb / searchByQuery / download link |
| Filters | `lib/torrents/watcher/*` | identity, parsers, quality/audio/season |
| Telegram | `integrations/telegram/bot.ts` | Bot API sendMessage/sendPhoto |
| In-app | `NotificationHubService` | module=`torrents` |
| Queue | BullMQ `torrents.watcher` | every 30 min via scheduler |
| Cron fallback | `POST /api/internal/torrents/watch` | inline scan без Redis |
| UI | `modules/torrents/`, `components/torrents/` | watchlist, prefs, pin/hunting |

---

## Поток данных (greenfield)

```mermaid
flowchart LR
  UI[Torrents UI] --> API["/api/torrents"]
  API --> Store[torrent_watchlist]
  Sched[BullMQ / cron] --> Watcher[TorrentWatcherService]
  Watcher --> Store
  Watcher --> Prowlarr
  Watcher --> Releases[torrent_releases]
  Watcher --> TG[Telegram]
  Watcher --> Hub[NotificationHub]
```

---

## Watcher & Поиск раздач

1. Due-фильтр: `enabled` + `check_interval` / `last_checked` (как NW).
2. **Комплексный опрос Prowlarr:**
   - Параллельный опрос через `Promise.allSettled` по IMDb ID (`tt...`, для зарубежных индексаторов) и текстовым запросам (`searchByQuery`, для трекеров RuTracker, NNM-Club, Rutor без поддержки Torznab IMDb), предотвращающий таймауты обратного прокси.
   - Передача полного спектра категорий Prowlarr, включая подкатегории (`TV/Foreign 5020`, `TV/HD 5040`, `TV/UHD 5045`, `Movies/Foreign 2010`, `Movies/UHD 2045`) и категорию `Other 8000`, используемую RuTor и рядом российских индексаторов.
   - Защита от сбоев декодирования URI (`URIError: URI malformed`) при обработке параметров раздач и магнет-ссылок.
3. **Умная фильтрация озвучки и языков:**
   - **Отечественный контент (`isRussianOrigin`):** для российских/советских фильмов и сериалов («Холоп 3», «Слово пацана», «Мастер и Маргарита») русский звук является языком оригинала — раздачи проходят и при выборе `russian`, и при `original`.
   - **Словарь студий и типов озвучки:** распознаются все ведущие релиз-группы (`Red Head Sound`, `HDRezka Studio`, `LostFilm`, `NewComers`, `TVShows`, `AlexFilm`, `ViruseProject`, `Kubik`, `WinMedia`, `Syncmer`, `Le-Production`, `Coldfilm`, `Dragon Money Studio`, `Дубляж TVOЁ`, `Пифагор`, `Flarrow Films`, `Невафильм`, `Кураж-Бамбей` и др.), сокращения трекеров (`ДБ`, `ПД`, `ПМ`, `ЛД`, `ЛМ`, `AVO`, `DVO`, `MVO`), разделители трекеров в pipe-формате (`| D |`, `| P |`, `| P2 |`, `| D, P |`, `| D, P, P2 |`, `| L |`, `| A |`), маркеры трекеров (`- RUSSIAN`, `Rus`, `Рус`), а также маркеры качества (`Лицензия`, `Чистый звук`).
   - **Субтитры:** наличие субтитров не отсекает раздачу, если в релизе присутствует звуковая дорожка или указана студия.
   - **Оригинальная озвучка (`original`):** признает сцен-релизы с международных трекеров (YTS, 1337x, EZTV, TGx), раздачи со сценарными тегами (`WEB-DL`, `BluRay`, `Remux` без русского дубляжа) и мультиязычные релизы (`Rus, Eng`, `Multi`).
4. **Нормализация, сопоставление и генерация поисковых запросов:**
   - **Точные оригинальные тайтлы:** слитные оригинальные названия (`VisionQuest`) сохраняются в точном соответствии с источником и трекерами без искусственного разбиения, гарантируя поиск точных совпадений (`VisionQuest 2026`, `Квест Вижна 2026`).
   - **Предочистка релизных метаданных (`cleanReleaseTitleForTokens`):** перед сопоставлением названий из заголовков релизов вычищаются теги сезонности и серий (`[S01E01-02 of 08]`, `[02x01-04 из 10]`, `S1E1-2`, `1-2 of 8`, `1-2 серии`), технические видео/аудио спецификации (`HDR10+`, `DV P8`, `10-bit`, `WEB-DL`, `HEVC`, `AVC`), студии озвучки и 4-значные года. Это предотвращает загрязнение токенов служебными цифрами.
   - **Изоляция защиты от сиквелов:** проверка сиквелов в `containsSequence` (`Холоп` vs `Холоп 3`) ограничена исключительно фильмами (`itemType === 'movie'`). Для ТВ-сериалов раздачи с диапазонами эпизодов (`S1E1-2`) или тегами сезонов не могут быть ложно отклонены как «сиквелы».
   - **Парсинг сезонов и эпизодов:**
     - Поддержка стандартных форматов (`S02E01`, `S2E1-4`, `S02E01-05 of 10`).
     - Поддержка формата трекеров и EZTV NxMM: диапазоны с общим числом (`[02x01-04 из 10]`), диапазоны (`02x01-04`), одиночные серии (`3x01`, `02x04 of 10`).
     - Поддержка кириллических маркеров сезонов и серий (`С02Е01-04`, `2 сезон`, `(2 сезон: 1-10 серии)`).
     - Автоматическое вычисление `effectiveSeason` из названия элемента watchlist при отсутствии явного `target_season` в БД.
   - Нормализация буквы `ё` -> `е` и разделение цифр и букв в кириллице.
   - Генерация запросов для сериалов под стандарты трекеров (`s02`, `s2`, `2 сезон`, `сезон 2`, `2026 s02`, `2026 s2`), а также базовых запросов без указания года для онгоингов и готовящихся проектов.
   - Корректная обработка годов для ТВ-сериалов: релизы последующих сезонов (2, 3, 4...) не отсекаются по году старта сериала.
   - Автоматическое выделение короткого базового названия для составных тайтлов с подзаголовками через точку или двоеточие.
5. **Точное разделение качества и динамического диапазона (SDR vs HDR vs Dolby Vision):**
   - Выделенный парсер `detectReleaseQuality` разделяет физическое разрешение (`2160p`, `1080p`, `720p`, `480p`) и цветовое пространство / dynamic range (`SDR`, `HDR`, `DV`).
   - Фильтр `2160p SDR` принимает исключительно 4K релизы без HDR (или с явной пометкой SDR), жестко отсекая HDR/Dolby Vision.
   - Фильтр `2160p HDR` принимает строго HDR10, HDR10+, Dolby Vision и HLG, отсекая SDR.
   - Устранены коллизии неточного поиска по подстрокам.
6. **Сквозной отбор и ранжирование кандидатов:**
   - В `listReleaseCandidates` исключена преждевременная обрезка пула раздач квотами трекеров до сортировки по предпочтениям. Все найденные раздачи дедуплицируются и ранжируются сквозным образом: pinned $\to$ совпадение с предпочтениями $\to$ сиды $\to$ размер.
   - В авто-watcher (`processItem`) проверяются все найденные раздачи, а лимит применяется строго к числу отправляемых уведомлений (`maxReleasesCount`).
7. **Mobile First адаптивный интерфейс карточек торрентов:**
   - На экранах `< sm` (смартфоны, iPhone SE, современные Android/iOS устройства) карточка принимает горизонтальный вид (media card) высотой ~140px с компактным постером 96px, лаконичной мета-информацией и тач-кнопками. На один экран смартфона помещается 4–5 карточек без горизонтального и избыточного вертикального скролла.
   - На экранах `sm` и шире сохраняется классическая 5-колоночная сетка вертикальных постеров.
8. Dedup `(imdb_id, info_hash)` + `content_hash`.
9. **Telegram (per-item `telegram_chat_id` или env) + `torrent_notification_log` + in-app:**
   - Формат NightWatcher+: постер + HTML (title/year/IMDb rating/genre, описание сюжета, релиз, размер, ссылки на magnet / Prowlarr / страницу раздачи / страницу IMDb).
   - Кликабельная ссылка на IMDb в строке рейтинга (`⭐️ IMDb: <a href="...">8.4</a>`) и в строке действий (`⭐️ IMDb`).
   - Описание фильма или сериала (`📖 <i>...</i>`) с умной обрезкой по границе слова (`truncatePlot` до ~350 символов) для гарантированного соблюдения лимита Telegram `caption` (1024 символа).
10. `notify_once` для movie → disable.
11. Concurrency 5.
12. Torrent bencode → magnet/info hash.
13. Pin-only и hunting auto-pin; UI-поиск кандидатов для pin — только по кнопке (открепить / заменить pin).
    Unpin и смена pin удаляют прежнюю раздачу из `torrent_releases`.
14. **Ручная отправка уведомления (`POST /api/torrents/watchlist/[id]/notify`):**
    - Использует готовые данные выбранного кандидата (`title`, `quality`, `size`, `seeders`, `magnetUrl`, `downloadUrl`, `infoUrl`) напрямую, исключая повторный 20-секундный поиск в Prowlarr.
    - При отсутствии magnet-ссылки выполняет точечный запрос `getDownloadArtifact(indexerId, guid)` ровно для одной конкретной раздачи.
    - Автоматически резолвит `telegram_chat_id`: если в строке вотчлиста поле пустое, подтягивает `telegramChatId` из профиля пользователя (`user_settings`) и сохраняет в запись.
    - Возвращает структурированный статус 400 (`telegram_chat_not_configured`, `telegram_bot_not_configured`) для отображения понятных подсказок пользователю в UI.

Trigger:
- Scheduler: `*/30 * * * *` → queue `torrents.watcher`
- Manual: `POST /api/internal/torrents/watch` + `Authorization: Bearer $CRON_SECRET`
- Manual notify: UI → `POST /api/torrents/watchlist/[id]/notify`

---

## Производительность и актуализация данных (v2.2)

1. **Моментальная загрузка списка торрентов (`/api/torrents/watchlist` < 20ms):**
   - **Устранение блокирующих внешних HTTP-вызовов:** поля расписаний (`digitalReleaseDate`, `nextEpisodeSeason`, `nextEpisodeNumber`, `nextEpisodeDate`, `scheduleUpdatedAt`) персистятся непосредственно в таблицу `torrent_watchlist`. Ответ пользователю отдаётся за один запрос к БД без сетевых задержек в TMDB/Trakt/Watchmode.
   - **Фоновая сверка расписаний (`reconcileStaleSchedules`):** для записей без расписания или старше 12 часов процесс сверки запускается асинхронно в фоне, обновляя БД без задержки ответа клиенту.
   - **Устранение N+1 SQL-запросов:** подсчет числа релизов и получение последнего релиза выполняются двумя батч-запросами к `torrent_releases` (с агрегацией `count` и `DISTINCT ON (imdb_id)`) вместо 2N отдельных запросов на каждый элемент.
2. **Мгновенная актуализация при редактировании и поиске кандидатов:**
   - **Auto-save перед поиском:** при нажатии кнопки «Поиск раздач» или «Обновить список» в модальном окне настроек `TorrentPreferencesDialog` измененные пользователем поля формы автоматически сохраняются в базу данных, гарантируя, что поисковый воркер ищет с актуальными параметрами.
   - **Сброс кэша кандидатов:** при сохранении/редактировании элемента и ручном поиске кэш React Query `['torrents', 'watchlist', id, 'candidates']` принудительно удаляется (`removeQueries`), а `staleTime: 0` обеспечивает получение актуальных раздач без залипания в кэше браузера.
   - **HTTP Headers:** на роутах `/api/torrents/watchlist` и `/api/torrents/watchlist/[id]/candidates` включены `force-dynamic`, `revalidate = 0` и заголовки `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.

---

## Хранение

Единственное хранилище: `torrent_*`; единственный watcher: TypeScript worker.

---

## Env

| Переменная | Назначение |
|------------|------------|
| `TORRENTS_MODULE_ENABLED` / `NEXT_PUBLIC_*` | Feature flags |
| `PROWLARR_URL` / `PROWLARR_API_KEY` | Search + health |
| `PROWLARR_PUBLIC_URL` | Опционально: публичный base для download-ссылок в Telegram (если `PROWLARR_URL` — Docker-internal) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Notify |
| `REDIS_URL` | BullMQ (иначе cron inline) |
| `INTERNAL_SERVICE_SECRET` / `CRON_SECRET` | Internal routes |

---

## Связанные документы

- [GREENFIELD.md](../GREENFIELD.md)
- [PLATFORM_ARCHITECTURE.md](../PLATFORM_ARCHITECTURE.md)
- [CHANGELOG.md](../CHANGELOG.md)
