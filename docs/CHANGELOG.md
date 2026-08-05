# Changelog

## 2026-08-05 (fix: catalog card grid Tailwind classes)

**Файлы:** `components/ui/catalog-grid.ts`, `releases-discover-view.tsx`, `releases-watchlist-view.tsx`, `torrents-watchlist-view.tsx`, `tailwind.config.ts`, `lib/ui/catalog-pagination.ts`.

**Изменения:** классы сетки `sm:grid-cols-5` перенесены из `src/lib` в `src/components` (и `lib` добавлен в Tailwind `content`), иначе JIT не генерировал utility и сетка оставалась в 1 колонку.

**Обоснование:** на Каталоге карточка растягивалась на всю ширину.

## 2026-08-05 (ci: fix quality — cache key test + pnpm action Node 24)

**Файлы:** `tests/releases-cache.test.ts`, `.github/workflows/ci.yml`.

**Изменения:**
- Тест `buildUpcomingCacheKey` обновлён под формат `tmdb:upcoming:v2:…:window`.
- `pnpm/action-setup` → `@v5` (Node.js 24), убрано deprecation-предупреждение Node 20.

**Обоснование:** quality job падал на устаревшем ожидании cache key после выравнивания окна каталога.

## 2026-08-05 (ui: pagination page size 25/50/100 + even card grid)

**Файлы:** `catalog-pagination.ts`, `catalog-pagination-bar.tsx`, `releases-discover-view.tsx`, `releases-watchlist-view.tsx`, `torrents-watchlist-view.tsx`, `release-content-card.tsx`, `torrent-watchlist-card.tsx`, messages, tests, `releases-precompute-service.ts`.

**Изменения:**
- На Каталоге, Списке и Торрентах — пагинация с выбором размера страницы **25 / 50 / 100**.
- Сетка карточек: **1 → 5 колонок** (`sm+`), чтобы полная страница делилась без «хвоста» (раньше 6 колонок при pageSize 24/25 ломали ряды).
- Общий `CatalogPaginationBar` + константы в `lib/ui/catalog-pagination.ts`.

**Обоснование:** ровная сетка и единый контроль размера страницы на страницах со списками карточек.

## 2026-08-05 (fix: Discover catalog window alignment)

**Файлы:** `release-catalog-aggregator.ts`, `tmdb/client.ts`, `tmdb/cache-keys.ts`, `tests/catalog-window.test.ts`, `docs/modules/RELEASES_ARCHITECTURE.md`.

**Изменения:**
- Discover больше не режет TMDB-выборку «2 месяца → top N» до отдельного окна 14 дней: aggregator и `getUpcoming` используют **одно** окно дат.
- По умолчанию окно = текущий + следующий календарный месяц; `RELEASES_CATALOG_WINDOW_DAYS` — опциональный rolling override.
- Cache keys `merged:v3` / `tmdb:upcoming:v2` включают границы окна, чтобы не отдавать устаревшие «урезанные» страницы.

**Обоснование:** на `/releases/discover` оставалось ~11 карточек и `hasNextPage=false`, потому что из топа 2-месячного Discover почти ничего не попадало в 14-дневный post-filter.

## 2026-07-29 (feat: multi-source movie digital date aggregation)

**Файлы:** `movie-digital-release-date-service.ts`, `release-schedule-date-service.ts`, `torrent-local-store.ts`, `tmdb/client.ts`, `trakt/client.ts`, `tmdb/cache-keys.ts`, `movie-digital-release-date-service.test.ts`, `docs/modules/MOVIE_DIGITAL_RELEASE_ARCHITECTURE.md`, `RELEASES_ARCHITECTURE.md`.

**Изменения:**
- Единый агрегатор digital dates: TMDB (все digital-like entries по регионам) + Watchmode + Trakt US.
- Display и schedule window: **earliest** дата среди всех источников, не «TMDB first + Watchmode fallback».
- `ReleaseScheduleDateService.resolveMovie` и torrent enrich используют агрегатор; `source` = победивший API.
- Cache keys `v3` для windowed movie release dates.

**Обоснование:** даты нужно сравнивать между всех доступных сервисов (FNAF2 и др.), а не полагаться только на TMDB.

## 2026-07-29 (fix: TMDB digital release date aggregation)

**Файлы:** `tmdb/digital-release-dates.ts`, `tmdb/client.ts`, `tmdb/cache-keys.ts`, `digital-release-dates.test.ts`, `docs/modules/MOVIE_DIGITAL_RELEASE_ARCHITECTURE.md`, `RELEASES_ARCHITECTURE.md`.

**Изменения:**
- Агрегация digital: все US entries type 4 + SVOD type 6 (note с платформой); **earliest** дата.
- Display (карточки/modal/torrent): earliest US digital без окна (FNAF2 → 2025-12-23, не 2026-08-03).
- Catalog/schedule window: earliest US digital **внутри окна**, не «canonical вне окна → null».
- Cache keys `v2` для сброса старых значений.

**Обоснование:** показывалась поздняя digital date; реальный первый digital (US VOD) терялся.

## 2026-07-29 (ui: torrent watchlist digital / premiere dates)

**Файлы:** `torrent-local-store.ts`, `torrents/types.ts`, `torrents/schedule-label.ts`, `torrent-watchlist-card.tsx`, `torrent-watchlist-detail-modal.tsx`, `tmdb/client.ts`, messages.

**Изменения:** при загрузке torrent watchlist TMDB enrich: фильмы — canonical digital date; сериалы — премьера сезона / следующий эпизод. Даты на карточке и в модалке.

**Обоснование:** в torrent watchlist не было понятно, когда ждать цифровой релиз.

## 2026-07-29 (ui: Releases digital / season premiere dates)

**Файлы:** `release-content-card.tsx`, `release-detail-modal.tsx`, `release-schedule-item.tsx`, `modules/releases/utils.ts`, `tmdb/client.ts` (`getContentDetail`, episode sort), messages.

**Изменения:**
- На карточке и в модалке фильмов показывается дата **цифрового** релиза.
- Для сериалов — дата премьеры сезона (E1) или ближайшего эпизода с читаемой подписью.
- `getContentDetail` для movie подставляет digital date; при выборе эпизода TMDB приоритет у E1.

**Обоснование:** без даты на карточке/в модалке непонятно что и когда выходит.

## 2026-07-29 (ui: integration service logos)

**Файлы:** `integration-service-icon.tsx`, `settings/integrations/page.tsx`, `public/icons/{anilist,myanimelist,shikimori}.svg`.

**Изменения:** в настройках интеграций inline SVG заменены на актуальные логотипы из `public/icons/` через общий компонент `IntegrationServiceIcon`.

**Обоснование:** единые брендированные иконки MAL / AniList / Shikimori в разделе подключения и выбора primary/secondary.

## 2026-07-29 (ui: torrent watchlist cards + detail modal)

**Файлы:** `torrent-watchlist-card.tsx`, `torrent-watchlist-detail-modal.tsx`, `torrents-watchlist-view.tsx`, `torrent-preferences-dialog.tsx`, messages.

**Изменения:** карточки с постером 2:3, бейджи и метаданные; клик открывает модалку с фильтрами, релизами и действиями; Trakt/TVmaze enrich остаётся на backend.

**Обоснование:** постеры и инфо были нечитаемы на маленьких thumbnail.

## 2026-07-29 (feat: user timezone + schedule Today + Releases posters)

**Файлы:** `timezone.ts`, `schedule-day.ts`, `drizzle/0008_user_timezone.sql`, `user-service`/`schema`/`types`, `appearance/page.tsx`, `anime-card.tsx`, `anime-detail-modal.tsx`, `schedule-view.tsx`, `release-catalog-aggregator.ts`, messages, tests, docs.

**Изменения:**
- Настройка IANA timezone в профиле (Внешний вид); даты в БД остаются UTC.
- «Сегодня» = календарный день в TZ пользователя (убран rolling 24h через границу суток); implied Shiki +7d сохранён.
- Короткий таймер «След. через N мин/ч/дн.» на карточке и в модалке.
- Releases: Trakt/TVmaze обогащаются через TMDB (`getContentDetail`), dedup по tmdbId+imdb, карточки без постера отфильтровываются.

**Обоснование:** корректное «Сегодня» и читаемый countdown; Discover без пустых дублей.

## 2026-07-29 (fix: Trakt calendars auth headers + streaming = movies)

**Файлы:** `integrations/trakt/client.ts`, `release-catalog-aggregator.ts`, `.env.example`, `docs/modules/RELEASES_ARCHITECTURE.md`.

**Изменения:** для публичных `/calendars/all/*` достаточно Client ID (`trakt-api-key`) + `User-Agent` / `trakt-api-version`; OAuth Bearer не используется. Streaming-календарь мержится как digital movies, не shows.

**Обоснование:** по docs Trakt OAuth нужен для `/calendars/my/*`; без User-Agent API может отклонять запросы.

## 2026-07-29 (feat: AniList next_episode + multi-source Releases)

**Файлы:** `catalog-next-episode.ts`, `library-service.ts`, `sync-service.ts`, `release-catalog-aggregator.ts`, `release-schedule-date-service.ts`, `release-watchlist-*.ts`, `releases-precompute-service.ts`, `integrations/{tvmaze,trakt,watchmode}/`, `modules/releases/utils.ts`, `docs/modules/{ANIME,RELEASES}_ARCHITECTURE.md`, `docs/openapi/releases.yaml`, `.env.example`, тесты.

**Изменения:**
- AniList: режим `fill-gaps-next-date` — при sync перезаписывается только `nextEpisodeDate`.
- Releases Discover: aggregator TMDB + TVmaze (+ Trakt при `TRAKT_CLIENT_ID`).
- Releases schedule: `ReleaseScheduleDateService` (TMDB digital / TVmaze episodes / Watchmode fallback); dates при add и batch refresh (movies + shows).
- Dashboard TZ: ISO-instant → `localDateKey` в локали браузера.
- Precompute прогревает merged catalog; env `TRAKT_CLIENT_ID`, `WATCHMODE_API_KEY`.

**Обоснование:** secondary AniList даёт актуальные эфиры; Discover и 7-дневное расписание покрывают стриминг/digital, а не только theatrical TMDB.

## 2026-07-24 (fix: «Сегодня» после сдвига next_episode на +7д)

**Файлы:** `apps/web/src/lib/integrations/schedule-day.ts`, `apps/web/tests/schedule-day.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** если Shiki уже переставил `nextEpisodeAt` на следующую неделю (+7д), UI восстанавливает предыдущий слот (`next − 7`) и держит тайтл в «Сегодня». Иначе пятничные эфиры пропадали из недели (ровно +7 не в гриде 0..6 и не в catching-up).

**Обоснование:** live БД — у пятничных тайтлов `next` уже 31.07, «Сегодня» пустое при вышедших сегодня сериях.

## 2026-07-24 (fix: MAL NSFW list + broken Shiki mal_id lookup)

**Файлы:** `apps/web/src/lib/integrations/providers.ts`, `apps/web/scripts/diag-mal-46488*.mjs`, `apps/web/scripts/verify-mal-46488-import.mjs`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:**
- MAL `fetchLibrary` всегда запрашивает `nsfw=true` — иначе API скрывает NSFW/часть Girls Love (MAL 46488: watching есть, в list без nsfw — нет).
- `resolveShikimoriIdByMalId`: убран REST `?mal_id=` (параметр игнорируется, брался чужой `response[0]`); lookup через GraphQL `ids` + проверка `malId` / `isCensored`.

**Обоснование:** 46488 в `anime_catalog` (censored), в MAL watching, но не попадал в `user_library_entries` — secondary gap не видел тайтл в schedule fetch.

## 2026-07-24 (fix: застрявшие pending правки тайтлов)

**Файлы:** `apps/web/src/lib/queue/queues.ts`, `workers.ts`, `scheduler.ts`, `names.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/app/api/user/integrations/sync/queue/route.ts`, `apps/web/src/components/sync-queue-panel.tsx`, `apps/web/messages/*`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:**
- `enqueueEntrySync` больше не блокируется старым completed/failed `jobId` — снимает и ставит заново; `removeOnComplete: true`.
- Минутный drain pending через scheduler + job `process-entry-sync-drain`.
- Кнопка «Запустить обработку» + `POST /api/user/integrations/sync/queue` (`flushPendingEntrySyncs`).
- Счётчики pending/processing/failed через `COUNT(*)`, не из лимита 40 строк.

**Обоснование:** 40 правок висели в pending при processing=0 — повторный enqueue с тем же BullMQ jobId тихо падал, drain не было.

## 2026-07-24 (ui: очередь синхронизации на интеграциях)

**Файлы:** `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/app/api/user/integrations/sync/queue/route.ts`, `apps/web/src/components/sync-queue-panel.tsx`, `apps/web/src/[locale]/settings/integrations/page.tsx`, `apps/web/messages/*`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** панель «Очередь и задачи» — counts, последние sync jobs, pending/failed правки тайтлов с названиями; автообновление при активной работе; API `GET /api/user/integrations/sync/queue`.

**Обоснование:** на интеграциях было непонятно, что в очереди и работает ли sync.

## 2026-07-24 (ui: компактные карточки на mobile/PWA)

**Файлы:** `apps/web/src/components/schedule-view.tsx`, `apps/web/src/components/anime-card.tsx`, `apps/web/messages/ru.json`, `apps/web/messages/en.json`.

**Изменения:** сетка расписания `grid-cols-2` на мобиле (как Releases); компактные отступы/заголовки/empty state; у карточек на xs скрыты описание и жанры, уменьшены паддинги, touch-target ≥44px для +/− и меню.

**Обоснование:** одна колонка + полный poster делали карточку на весь экран PWA.

## 2026-07-24 (fix: цензура Shiki = gap для secondary)

**Файлы:** `apps/web/src/lib/integrations/providers.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/tests/provider-http-error.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** `probeShikimoriAnimeExists` / resolve by MAL считают `isCensored` **unusable** (не эталон primary). Такие тайтлы (напр. MAL 46488) импортируются с secondary и не блокируются «есть в API Shiki».

**Обоснование:** цензурный тайтл виден в API, но list/write недоступны — secondary должен закрывать gap.

## 2026-07-24 (fix: вышедшие сегодня не скрываются из «Сегодня»)

**Файлы:** `apps/web/src/lib/integrations/schedule-day.ts`, `apps/web/src/components/schedule-view.tsx`, `apps/web/tests/schedule-day.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** тайтлы с эфиром сегодня / за последние 24ч остаются в блоке «Сегодня», а не пропадают из недели в catching-up из‑за `daysUntilRelease < 0` (уже вышло / сдвиг TZ).

**Обоснование:** после выхода серии расписание выглядело пустым на сегодня.

## 2026-07-24 (sync: primary эталон при сравнении сервисов)

**Файлы:** `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/services/library-service.ts`, `apps/web/src/lib/integrations/providers.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:**
- Primary всегда эталон vs secondary: есть на primary без статуса → не импортируем secondary, cascade удаляет и пушит отсутствие.
- Gap только если тайтла физически нет на primary (`probe` / `resolveShikimoriIdByMalId`).
- Primary → local с `preserveOutOfSync`; затем push primary-состояния на остальные.
- Outbound «из каталога» только для явных правок (`manual_update` / `retry_sync`), не для secondary-import.

**Обоснование:** secondary не должен перебивать primary; ручные правки в AniSync должны уходить на все сервисы без случайных откатов/удалений от импорта.

## 2026-07-24 (fix: gap с secondary когда тайтла нет на primary)

**Файлы:** `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/integrations/library-schedule-import.ts`, `apps/web/tests/library-schedule-import.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:**
- Gap = нет в **membership** primary (malId / external id), а не «в каталоге есть shiki id».
- Cascade: primary эталон, но если аниме физически нет на Shiki (probe) — не удаляем (оставляем secondary).
- Schedule: `planned` + `currently_airing` импортируется без `nextEpisodeDate` (иначе MAL PTW airing не попадал в каталог).

**Обоснование:** MAL 46488 и подобные — нет на Shiki, есть на MAL secondary, но не загружались / сносились.

## 2026-07-24 (fix: локальные правки не затираются inbound)

**Файлы:** `apps/web/src/lib/services/library-service.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/integrations/library-schedule-import.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** schedule refresh больше не перезаписывает статус/серии/оценки уже локальных записей с primary (`onExistingLibrary: 'keep'`). `upsertLibraryEntries` / `upsertLibraryEntry` по умолчанию не трогают `outOfSync`. После refresh outbound пушит новые с primary + все pending локальные правки (каталог → сервисы), а не «состояние primary на всех».

**Обоснование:** правки в AniSync откатывались stale refresh и уходили на сервисы уже затёртыми данными primary.

## 2026-07-24 (fix: cascade + gap secondary)

**Файлы:** `apps/web/src/lib/services/sync-service.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** уточнены правила cascade/gap — см. запись «gap с secondary когда тайтла нет на primary».

**Обоснование:** primary — эталон при наличии тайтла на сервисе; physically missing → secondary.

## 2026-07-24 (sync: recovery когда Shikimori недоступен)

**Файлы:** `apps/web/src/lib/integrations/provider-types.ts`, `apps/web/src/lib/integrations/providers.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/services/library-service.ts`, `apps/web/src/components/anime-card.tsx`, `apps/web/src/components/anime-detail-modal.tsx`, `apps/web/messages/*`, `apps/web/tests/provider-http-error.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** `ProviderHttpError` + probe каталога Shiki; при 404/422 write и отсутствующем anime — DELETE rate, rebind на secondary, push на остальные; null-safe rates; бейдж «Недоступно на Shikimori».

**Обоснование:** после цензуры/удаления тайтла с Shiki user_rate остаётся, PATCH падает и блокирует sync на MAL/AL.

## 2026-07-24 (fix: secondary не затирает локальные правки)

**Файлы:** `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/services/library-service.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** schedule refresh с secondary/MAL только **добавляет** gap-тайтлы; уже локальные записи не перезаписываются. При `outOfSync` — повторный outbound sync. `upsertLibraryEntry(..., onExistingLibrary: 'keep')`.

**Обоснование:** правки статуса/серий на тайтле только с MAL откатывались inbound refresh с secondary.

## 2026-07-24 (deploy: один image для web/worker/scheduler)

**Файлы:** `docker-compose.yml`, `apps/web/Dockerfile`, `docs/COOLIFY_DEPLOY.md`.

**Изменения:** общий `anisync-runtime:local`; `build` только у `web`. Worker/scheduler берут тот же image.

**Обоснование:** Coolify трижды экспортировал один тяжёлый образ → деплой зависал на unpack/provenance.

## 2026-07-24 (fix: dropped не в расписании)

**Файлы:** `apps/web/src/app/api/user/anime/route.ts`, `apps/web/src/lib/services/library-types.ts`, `apps/web/src/lib/services/library-service.ts`, `apps/web/src/components/schedule-view.tsx`, `apps/web/tests/library-schedule-import.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** `/api/user/anime` по умолчанию отдаёт только schedule-статусы; UI недели/catching-up отсекает `dropped`/`completed`/`on_hold`.

**Обоснование:** тайтлы «Брошено» с датой серии попадали в календарь расписания.

## 2026-07-24 (fix: Shiki badge → AniList URL)

**Файлы:** `apps/web/src/lib/integrations/provider-links.ts`, `apps/web/tests/provider-links.test.ts`.

**Изменения:** `catalog.url` применяется только к бейджу того сервиса, чей хост в URL; чужой URL (например AniList при source=Shikimori) больше не подменяет ссылку Shiki.

**Обоснование:** общий catalog.url с другого провайдера ломал бейдж «Shiki».

## 2026-07-24 (ui: sync badge layout in detail modal)

**Файлы:** `apps/web/src/components/anime-detail-modal.tsx`, `apps/web/src/components/anime-card.tsx`.

**Изменения:** кнопка «Повторить синхронизацию» не показывается при pending/processing; в detail modal блок статуса + кнопка переведены на колонку с переносом, без обрезки текста.

**Обоснование:** при статусе «в очереди» кнопка перекрывала бейдж и обрезалась справа.

## 2026-07-24 (deploy: авто-миграции при старте web)

**Файлы:** `apps/web/src/lib/db/migrate.ts`, `docs/COOLIFY_DEPLOY.md`, `docs/DB_ARCHITECTURE.md`.

**Изменения:** путь к `drizzle/` в migrate резолвится от файла (не от cwd); в Coolify/DB docs зафиксировано, что `0007` и последующие SQL применяются entrypoint `web` при деплое.

**Обоснование:** миграции на проде должны идти автоматически, без ручного шага после deploy.

## 2026-07-24 (integrations: primary/secondary + full catalog sync)

**Файлы:** `apps/web/src/lib/db/schema.ts`, `apps/web/drizzle/0007_secondary_service.sql`, `apps/web/src/lib/types.ts`, `apps/web/src/lib/services/user-service.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/app/api/user/settings/route.ts`, `apps/web/src/app/api/user/integrations/sync/catalog/route.ts`, `apps/web/src/app/[locale]/settings/integrations/page.tsx`, `apps/web/messages/*`, `docs/modules/ANIME_ARCHITECTURE.md`, `docs/COOLIFY_DEPLOY.md`, `docs/DB_ARCHITECTURE.md`.

**Изменения:**
- Поле `secondary_service` + выбор Primary/Secondary на экране интеграций.
- Кнопка и job `primary_catalog_push`: полный membership primary → local → push на остальные сервисы; тайтлы вне primary не трогаем.
- Schedule refresh заполняет gaps сначала с explicit secondary.
- `0007_secondary_service.sql` подхватывается entrypoint `web` при деплое (`RUN_MIGRATIONS=true`); ручной migrate на проде не нужен. Документация Coolify/DB уточнена.

**Обоснование:** явная модель эталона и отдельная операция выравнивания всех connected под каталог primary.

## 2026-07-24 (sync: primary всегда authoritative)

**Файлы:** `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/integrations/library-schedule-import.ts`, `apps/web/tests/library-schedule-import.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** refresh берёт primary membership → upsert (schedule + выравнивание локальных, в т.ч. completed) → **push всех primary entries** на остальные сервисы; secondary только если тайтла нет на primary. «Продолжаю смотреть» тоже идёт из primary.

**Обоснование:** статус/прогресс с primary должен побеждать (пример: primary=просмотрено, MAL=смотрю → везде просмотрено).

## 2026-07-24 (fix: ложный cascade delete с secondary)

**Файлы:** `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/integrations/providers.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** external delete детектится **только по primary membership**; secondary больше не триггерят wipe; защита от пустого/урезанного ответа API; Shikimori `externalAnimeId` нормализуется в `String`.

**Обоснование:** AniList id enrichment + cascade «с любого сервиса» удаляли тайтлы с primary (ложный массовый wipe в истории Shikimori). Primary всегда authoritative.

## 2026-07-24 (ui: ссылки на сервисы + бейдж источника)

**Файлы:** `apps/web/src/lib/integrations/provider-links.ts`, `apps/web/src/lib/services/library-service.ts`, `apps/web/src/lib/services/library-types.ts`, `apps/web/src/lib/types.ts`, `apps/web/src/components/provider-service-links.tsx`, `apps/web/src/components/anime-card.tsx`, `apps/web/src/components/anime-detail-modal.tsx`, `apps/web/src/components/schedule-view.tsx`, `apps/web/messages/*`, `docs/CHANGELOG.md`.

**Изменения:** в API библиотеки отдаются `serviceLinks` по всем известным `anime_service_ids` (+ MAL по `mal_id`); на карточке — бейдж источника и компактные ссылки; в модалке — полный блок «На сервисах».

**Обоснование:** удобный переход на Shikimori/MAL/AniList и понимание, откуда взят тайтл в смешанном каталоге.

## 2026-07-24 (ui: индикатор фонового schedule refresh)

**Файлы:** `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/app/api/user/anime/route.ts`, `apps/web/src/components/schedule-view.tsx`, `docs/CHANGELOG.md`.

**Изменения:** статус фонового `schedule_refresh` пишется в `sync_jobs` (видно между запросами); API отдаёт live status; на расписании — заметный бейдж со спиннером «Обновление списка…».

**Обоснование:** in-memory Set не переживал poll/другие инстансы, индикатор сразу пропадал.

## 2026-07-24 (anime: catching-up import вне окна 14 дней)

**Файлы:** `apps/web/src/lib/integrations/library-schedule-import.ts`, `apps/web/tests/library-schedule-import.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** schedule-import всегда тянет **watching/rewatching** (даже без даты или с эфиром за пределами 14 дней) для блока «Продолжаю смотреть»; окно 14 дней остаётся только для **planned**.

**Обоснование:** иначе тайтлы в статусе «смотрю» вне окна не попадали в локальную библиотеку и секция catching-up была пустой.

## 2026-07-24 (ci: pnpm version из packageManager)

**Файлы:** `.github/workflows/ci.yml`.

**Изменения:** убран дублирующий `version: 9` у `pnpm/action-setup` (используется `packageManager: pnpm@9.15.0`); checkout/setup-node обновлены до v5.

**Обоснование:** CI падал с `ERR_PNPM_BAD_PM_VERSION` из‑за конфликта version в Action и package.json.

## 2026-07-24 (anime: outbound upsert-all, cascade delete, search/add)

**Файлы:** `apps/web/src/lib/integrations/provider-types.ts`, `apps/web/src/lib/integrations/providers.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/services/library-service.ts`, `apps/web/src/app/api/user/anime/search/route.ts`, `apps/web/src/app/api/user/library/route.ts`, `apps/web/src/components/add-anime-dialog.tsx`, `apps/web/src/components/schedule-view.tsx`, `apps/web/messages/ru.json`, `apps/web/messages/en.json`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:**
- Outbound sync на все connected: create missing (Shikimori POST `user_rates`), порядок primary → MAL → rest.
- Cascade delete: UI DELETE и детект external delete через `membership` на refresh; soft prune (не удалять по окну 14 дней).
- После primary refresh — push изменившихся entries на остальные сервисы.
- `searchAnime` + `GET /api/user/anime/search` + `POST /api/user/library`; UI-диалог добавления на расписании.

**Обоснование:** единая модель sync действий и возможность добавлять тайтлы без ручного импорта всего списка.

## 2026-07-24 (anime: primary владеет метаданными каталога)

**Файлы:** `apps/web/src/lib/services/library-service.ts`, `apps/web/src/lib/services/sync-service.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** secondary (MAL/AniList) больше не перезаписывают обложку/описание тайтлов с primary; порядок fallback для «нет на primary»: MAL → остальные. Режим каталога `fill-gaps` / `link-only`.

**Обоснование:** при primary=Shikimori обложки ошибочно подменялись AniList CDN после mixed import.

## 2026-07-24 (fix: обложки MAL/AniList CDN)

**Файлы:** `apps/web/next.config.ts`.

**Изменения:** в `images.remotePatterns` добавлены `cdn.myanimelist.net`, `api-cdn.myanimelist.net`, `*.anilist.co` и `*.shikimori…` — реальные хосты постеров, которые отдаёт API.

**Обоснование:** Next/Image блокировал обложки (битая картинка), т.к. были разрешены только `myanimelist.net` / `anilist.co`, а CDN — `cdn.myanimelist.net` и `s4.anilist.co`.

## 2026-07-24 (anime: мгновенная загрузка + смешанный каталог)

**Файлы:** `apps/web/src/app/api/user/anime/route.ts`, `apps/web/src/app/api/internal/schedule-refresh/process/route.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/services/library-service.ts`, `apps/web/src/lib/services/catalog-match.ts`, `apps/web/src/lib/integrations/providers.ts`, `apps/web/src/lib/queue/*`, `apps/web/src/modules/anime/jobs.ts`, `apps/web/src/components/schedule-view.tsx`, `apps/web/messages/ru.json`, `apps/web/messages/en.json`, `apps/web/src/lib/config.ts`, `docs/modules/ANIME_ARCHITECTURE.md`, `docs/PLATFORM_ARCHITECTURE.md`, `apps/web/tests/catalog-match.test.ts`.

**Изменения:** `/api/user/anime` отдаёт БД сразу, фоновый `anime.schedule.refresh` (TTL 15м); import со всех подключённых провайдеров с матчем по `mal_id` / AniList `idMal` и title-fallback; outbound sync с per-service ID и primary-first.

**Обоснование:** F5 больше не ждёт внешний fetch; цензурные/отсутствующие на Shikimori тайтлы подтягиваются из MAL/AniList и синкаются туда, где они есть.

## 2026-07-22 (anime: удаление статуса из списка)

**Файлы:** `apps/web/src/app/api/user/library/[id]/route.ts`, `apps/web/src/lib/services/library-service.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/src/lib/integrations/provider-types.ts`, `apps/web/src/lib/integrations/providers.ts`, `apps/web/src/components/anime-card.tsx`, `apps/web/src/components/anime-detail-modal.tsx`, `apps/web/src/components/schedule-view.tsx`, `apps/web/messages/ru.json`, `apps/web/messages/en.json`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** добавлен `DELETE /api/user/library/[id]` — удаляет запись библиотеки локально и best-effort на primary/auto-sync провайдерах (Shikimori / MAL / AniList). В карточке и модалке — действие «Удалить из списка».

**Обоснование:** раньше можно было только менять статус, но не убирать аниме из списка AniSync.

## 2026-07-22 (anime: точечный import расписания)

**Файлы:** `apps/web/src/lib/integrations/library-schedule-import.ts`, `apps/web/src/lib/integrations/providers.ts`, `apps/web/src/lib/integrations/provider-types.ts`, `apps/web/src/lib/services/sync-service.ts`, `apps/web/tests/library-schedule-import.test.ts`, `docs/modules/ANIME_ARCHITECTURE.md`.

**Изменения:** primary import больше не тянет всю библиотеку (completed/dropped/…). Скачиваются только `watching` / `planned` / `rewatching`, затем оставляются тайтлы с эфиром/стартом в ближайшие 14 дней (текущая + следующая неделя).

**Обоснование:** полный импорт (~тысячи записей) раздувает БД и тормозит sync; для расписания нужны только активные тайтлы на ближайшие недели.

## 2026-07-21 (torrents: удаление раздачи из БД при откреплении)


**Файлы:** `apps/web/src/lib/services/torrent-local-store.ts`, `docs/modules/TORRENTS_ARCHITECTURE.md`.

**Изменения:** `unpin` удаляет соответствующую запись из `torrent_releases` (по `info_hash` / aliases); при смене pin предыдущая раздача тоже удаляется из БД.

**Обоснование:** откреплённый релиз не должен оставаться в истории и мешать повторному уведомлению/охоте.

## 2026-07-21 (fix: login 500 через PgBouncer)


**Файлы:** `apps/web/src/lib/db/index.ts`, `apps/web/src/lib/db/migrate.ts`, `apps/web/src/app/api/auth/login/route.ts`, `docs/COOLIFY_DEPLOY.md`.

**Изменения:** для postgres.js включён `prepare: false` (совместимость с PgBouncer `:6432`); ошибки логина пишутся в лог (`Login failed`).

**Обоснование:** миграции проходили, а `POST /api/auth/login` отдавал 500 — типичный симптом prepared statements за transaction-mode pooler.

## 2026-07-21 (torrents: год в поиске + фильтр СТ/субтитров)


**Файлы:** `apps/web/src/lib/torrents/watcher/filters.ts`, `apps/web/src/lib/services/torrent-watcher-service.ts`, `apps/web/tests/torrent-watcher.test.ts`, `docs/modules/TORRENTS_ARCHITECTURE.md`.

**Изменения:** для фильмов с годом текстовый поиск только с годом (без fallback `Carrie` → 1976); год проверяется даже при IMDb-совпадении, если в названии другой год; `russian` требует маркеры озвучки (AVO/DVO/дубляж/RUS) и отсекает `СТ`/субтитры.

**Обоснование:** ложные срабатывания на ремейки без года и на раздачи только с субтитрами при фильтре «русский».

## 2026-07-21 (torrents: junk-фильтр + pin search по клику)


**Файлы:** `apps/web/src/lib/torrents/watcher/filters.ts`, `apps/web/src/components/torrents/torrent-preferences-dialog.tsx`, `apps/web/messages/ru.json`, `apps/web/messages/en.json`, `apps/web/tests/torrent-watcher.test.ts`, `docs/modules/TORRENTS_ARCHITECTURE.md`.

**Изменения:** расширен фильтр низкокачественных раздач (HDTS / TS / CAM / Telesync / Screener и др.); поиск кандидатов для закрепления только по кнопке (без автозапроса при открытии диалога); открепление и замена закреплённой раздачи.

**Обоснование:** не показывать/не уведомлять о CAM/TS; не дёргать Prowlarr при каждом открытии настроек.

## 2026-07-21 (torrents: формат TG NightWatcher + ручная отправка)


**Файлы:** `apps/web/src/lib/integrations/telegram/bot.ts`, `apps/web/src/lib/torrents/watcher/release-links.ts`, `apps/web/src/lib/services/torrent-watcher-service.ts`, `apps/web/src/lib/services/torrent-facade.ts`, `apps/web/src/app/api/torrents/watchlist/[id]/notify/route.ts`, `apps/web/src/lib/torrents/types.ts`, `apps/web/src/modules/torrents/api.ts`, `apps/web/src/modules/torrents/hooks.ts`, `apps/web/src/components/torrents/torrent-preferences-dialog.tsx`, `apps/web/messages/ru.json`, `apps/web/messages/en.json`, `apps/web/src/lib/config.ts`, `docker-compose.yml`, `.env.example`, `apps/web/.env.example`, `docs/modules/TORRENTS_ARCHITECTURE.md`, `docs/API_MAPPING.md`, `docs/ENV_INVENTORY.md`.

**Изменения:** уведомления о торрентах в формате NightWatcher (постер + HTML: title/year/IMDb/genre, релиз, размер, magnet / Prowlarr / страница раздачи); кнопка ручной отправки в Telegram у кандидатов; `POST /api/torrents/watchlist/[id]/notify`; опциональный `PROWLARR_PUBLIC_URL` для кликабельных download-ссылок вне Docker-сети.

**Обоснование:** нужен привычный формат NW и возможность вручную продублировать уведомление без ожидания watcher.

## 2026-07-21 (fix: web unhealthy → deploy fail)


**Файлы:** `docker-compose.yml`.

**Изменения:** healthcheck web/worker/scheduler на чистом `node -e` (без `tsx`); `depends_on` снова `service_started`.

**Обоснование:** Coolify — build OK, но `web is unhealthy` блокировал `compose up` (worker/scheduler ждут healthy).

## 2026-07-21 (Releases: статус «Просмотрено» в watchlist)

**Файлы:** `apps/web/src/lib/db/schema.ts`, `apps/web/src/lib/services/release-watchlist-service.ts`, `apps/web/src/app/api/releases/watchlist/route.ts`, `apps/web/src/app/api/releases/watchlist/[id]/route.ts`, `apps/web/src/modules/releases/types.ts`, `apps/web/src/modules/releases/api.ts`, `apps/web/src/modules/releases/hooks.ts`, `apps/web/src/modules/releases/utils.ts`, `apps/web/src/components/releases/release-detail-modal.tsx`, `apps/web/src/components/releases/release-content-card.tsx`, `apps/web/src/components/releases/releases-watchlist-view.tsx`, `apps/web/src/components/releases/releases-discover-view.tsx`, `apps/web/src/components/releases/release-schedule-item.tsx`, `apps/web/messages/ru.json`, `apps/web/messages/en.json`, `docs/openapi/releases.yaml`, `docs/modules/RELEASES_ARCHITECTURE.md`.

**Изменения:** добавлен статус watchlist `watched` («Просмотрено»); быстрая смена статуса через сегментированные кнопки на карточках списка; фильтр и счётчик по просмотренным; цикл статусов в каталоге расширен до `plan → watching → watched`.

**Обоснование:** пользователям нужно отмечать просмотренные релизы и быстро переключать статус без открытия модалки.

## 2026-07-21 (torrents: настройки quality/audio и редактирование метаданных)

**Файлы:** `apps/web/src/components/torrents/torrent-preferences-dialog.tsx`, `apps/web/src/lib/torrents/types.ts`, `apps/web/src/lib/services/torrent-local-store.ts`, `apps/web/src/app/api/torrents/watchlist/[id]/route.ts`, `apps/web/src/modules/torrents/api.ts`, `apps/web/src/modules/torrents/hooks.ts`, `apps/web/messages/ru.json`, `apps/web/messages/en.json`.

**Изменения:** в диалоге настроек торрента поля Quality и Audio заменены на combobox с пресетами и свободным вводом; добавлена секция редактирования метаданных карточки (title, originalTitle, year, genre, posterUrl). PATCH API и local store принимают новые поля.

**Обоснование:** пользователю нужны пресеты фильтров из watcher и возможность править метаданные без повторного добавления из TMDB.

## 2026-07-21 (compose: health checks для web/worker/scheduler)

**Файлы:** `docker-compose.yml`, `apps/web/scripts/healthcheck-web.ts`, `apps/web/scripts/healthcheck-queue.ts`, `docs/COOLIFY_DEPLOY.md`.

**Изменения:** единые health checks в compose — `web` проверяет `/api/health`, `worker`/`scheduler` — ping Redis; `depends_on` с `service_healthy`.

**Обоснование:** Coolify показывал Running (unknown); Traefik нужен корректный Docker health status.

## 2026-07-21 (fix: OAuth redirect на 0.0.0.0:3000)

**Файлы:** `apps/web/src/lib/integrations/oauth.ts`.

**Изменения:** после callback интеграции редирект идёт на `APP_BASE_URL`, а не на `request.url` (в Docker за прокси это `http://0.0.0.0:3000`).

**Обоснование:** после OAuth пользователь попадал на неверный URL.

## 2026-07-21 (fix: client crash — env validation in browser)

**Файлы:** `apps/web/src/lib/config.ts`, `apps/web/src/lib/feature-flags.ts`, `apps/web/src/lib/feature-flags.server.ts`, `apps/web/package.json`.

**Изменения:** серверная валидация env (`DATABASE_URL`, `JWT_SECRET` и т.д.) больше не выполняется в клиентском бандле. `feature-flags` разделён на client/server; `env` загружается лениво только на сервере.

**Обоснование:** на anisync.ru падал клиент с `Invalid environment configuration: APP_BASE_URL: Required; …`.

## 2026-07-20 (compose: внешний Redis через REDIS_URL)

**Файлы:** `docker-compose.yml`, `.env.example`, `apps/web/docker/entrypoint.sh`, `docs/COOLIFY_DEPLOY.md`, `docs/PLATFORM_ARCHITECTURE.md`, `docs/ENV_INVENTORY.md`.

**Изменения:** сервис `redis` снова убран из compose. Redis — отдельный Coolify Database; приложение подключается только через `REDIS_URL`. Entrypoint требует непустой `REDIS_URL`.

**Обоснование:** Redis деплоится отдельно в Coolify, не в стеке приложения.

## 2026-07-20 (compose: вернули сервис redis)

**Файлы:** `docker-compose.yml`, `.env.example`, `apps/web/docker/entrypoint.sh`, `docs/COOLIFY_DEPLOY.md`.

**Изменения:** снова поднимается `redis:7-alpine` в стеке; `REDIS_URL` по умолчанию `redis://redis:6379`; web/worker/scheduler ждут healthy redis.

**Обоснование:** без сервиса redis в compose Redis не деплоился вместе с приложением.

## 2026-07-20 (fix: scheduler exit 0 → restart loop)

**Файлы:** `apps/web/src/lib/queue/scheduler.ts`, `apps/web/scripts/scheduler.ts`, `docker-compose.yml`.

**Изменения:** после регистрации repeatable jobs scheduler больше не закрывает все Queue (и добавлен явный keep-alive). Раньше Node сразу делал exit 0 → Docker restart loop. В compose задан `ANISYNC_PROCESS` для логов.

**Обоснование:** логи показали многократный «Scheduler is running» каждые ~1–2 с при живом web/worker.

## 2026-07-20 (Coolify: внешний Redis через predefined network)

**Файлы:** `docker-compose.yml`, `.env.example`, `apps/web/docker/entrypoint.sh`, `docs/COOLIFY_DEPLOY.md`.

**Изменения:** убран встроенный сервис `redis` из compose. `REDIS_URL` снова берётся из Coolify env (internal hostname + Connect To Predefined Network). Стек: только `web` / `worker` / `scheduler`.

**Обоснование:** при Connect To Predefined Network Coolify Redis резолвится; дублирующий redis в compose не нужен.

## 2026-07-20 (fix: restart loop web/worker)

**Файлы:** `apps/web/docker/entrypoint.sh`, `apps/web/src/lib/db/migrate.ts`, `apps/web/src/lib/db/index.ts`, `docker-compose.yml`, `docs/COOLIFY_DEPLOY.md`.

**Изменения:** entrypoint подставляет `REDIS_URL` если пустой и проверяет `DATABASE_URL`/`JWT_SECRET`; миграции с SSL и корректным exit; `REDIS_URL` в compose зафиксирован на `redis://redis:6379`; безопасный разбор sslmode при спецсимволах в пароле.

**Обоснование:** пустой `REDIS_URL` из Coolify UI ронял worker/scheduler (`exit 1` → 10 restarts); падение migrate не давало стартовать web.

## 2026-07-20 (Coolify: только DATABASE_URL, без POSTGRES_*)

**Файлы:** `docker-compose.yml`, `.env.example`, `docs/COOLIFY_DEPLOY.md`, `docs/PLATFORM_ARCHITECTURE.md`, `docs/ENV_INVENTORY.md`.

**Изменения:** сервис `postgres` убран из compose. БД — внешняя через единственную переменную `DATABASE_URL`. `POSTGRES_USER` / `PASSWORD` / `DB` больше не используются. В стеке остаются `web` / `worker` / `scheduler` + `redis`.

**Обоснование:** в Coolify уже есть готовый Postgres connection string; дублировать креды в отдельных env не нужно.

## 2026-07-20 (fix: Coolify postgres unhealthy)

**Файлы:** `docker-compose.yml`, `docs/COOLIFY_DEPLOY.md`

**Изменения:** дефолт для `POSTGRES_PASSWORD`, более терпимый healthcheck (`start_period`, shell-дефолты пользователя/БД), в гайде — диагностика `postgres unhealthy`.

**Обоснование:** официальный образ Postgres без пароля сразу выходит; Coolify-деплой останавливался на `depends_on`.

## 2026-07-20 (fix: Docker build — zod hoist + profile schema)

**Файлы:** `apps/web/Dockerfile`, `apps/web/src/app/[locale]/settings/profile/page.tsx`, `apps/web/src/lib/config.ts`

**Изменения:**
- Dockerfile копирует `apps/web/node_modules` (zod@3), а не только корневой hoist (там zod@4 от Serwist) — иначе `next build` падает на typecheck.
- Убран `z.string({ required_error })` в profile form (несовместимо с zod 4 API, если резолвится неверный пакет).
- Пустые строки env из Coolify трактуются как unset; в builder — placeholder secrets для import `config.ts`.

**Обоснование:** Coolify падал на `RUN pnpm run build` из‑за type error Zod при резолве zod@4 из root `node_modules`.

## 2026-07-20 (fix: pnpm-lock для Docker/Coolify build)

**Файлы:** `pnpm-lock.yaml`

**Изменения:** синхронизирован lockfile с `apps/web/package.json` (убраны устаревшие записи `firebase`, `jsonwebtoken`, `@types/jsonwebtoken`). `pnpm install --frozen-lockfile` в Dockerfile снова проходит.

**Обоснование:** Coolify build падал на `RUN pnpm install --filter @anisync/web... --frozen-lockfile` с `ERR_PNPM_OUTDATED_LOCKFILE`.

## 2026-07-20 (Coolify + docker-compose.yml)

### Деплой через Coolify Docker Compose

**Файлы:** `docker-compose.yml`, `docs/COOLIFY_DEPLOY.md`, `.env.example`, `docs/PLATFORM_ARCHITECTURE.md`.

**Изменения:**
- `docker-compose.yml` адаптирован под Coolify: полный стек `postgres` + `redis` + `web` + `worker` + `scheduler`; порт `web` = `3000` для Proxy; env через явный `environment:` + `${VAR}` (без `env_file`); убран profile `bundled-data`.
- `docs/COOLIFY_DEPLOY.md` снова про Coolify UI (создание Compose-ресурса, env, домен, rebuild, admin).
- `.env.example` — шаблон ключей для Coolify Environment Variables с URL на хосты `postgres`/`redis`.

**Обоснование:** прод на сервере идёт через Coolify Compose, а не ручной `docker compose` на хосте.

## 2026-07-20 (README — продуктовое описание)

**Файлы:** `README.md`

**Изменения:** README сведён к описанию продукта (модули, функционал, стек, ссылка на anisync.ru). Убраны быстрый старт, env, команды, деплой, troubleshooting и прочие инструкции по локальному запуску — продукт позиционируется как веб-сервис с регистрацией на сайте.

**Обоснование:** пользователи настраивают AniSync через UI, а не через клон репозитория.

## 2026-07-20 (деплой: Docker Compose + корневой `.env`)

### Серверный деплой через compose; гайд переписан

**Файлы:** `docker-compose.yml`, `.env.example`, `docs/COOLIFY_DEPLOY.md`, `README.md`, `docs/GREENFIELD.md`, `docs/ENV_INVENTORY.md`, `docs/PLATFORM_ARCHITECTURE.md`.

**Изменения:**
- `docker-compose.yml` — runtime из корневого `.env` (`env_file` + `${VAR}`); по умолчанию только `web`/`worker`/`scheduler`; Postgres/Redis — профиль `bundled-data`; healthcheck web через Node `fetch`; `restart: unless-stopped`; порт `WEB_PORT`.
- Корневой `.env.example` восстановлен как канон для compose-деплоя.
- `docs/COOLIFY_DEPLOY.md` переписан под Docker Compose на сервере (больше не Coolify UI resources).
- README / ENV_INVENTORY / GREENFIELD синхронизированы.

**Обоснование:** единый путь «клонировал → заполнил `.env` → `docker compose up`» без отдельных Coolify application resources.

## 2026-07-20 (репозиторий: cleanup + переписан README)

### Очистка исторических planning/parity-документов и обновление верхнеуровневой документации

**Удалены файлы:**
- Планы объединения сервисов: `docs/SERVICE_CONSOLIDATION_PLAN.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`, `docs/REPO_DECOMMISSION.md`.
- Legacy parity/cutover-аудиты: `docs/LEGACY_PARITY_AUDIT.md`, `docs/POST_AUDIT_CLOSURE_PLAN.md`, `docs/SCHEMA_PARITY.md`, `docs/DUAL_WRITE_CUTOVER.md`, `docs/RELEASES_BETA_CUTOVER.md`, `docs/RELEASES_PARITY_CHECKLIST.md`, `docs/AUTH_SESSION_MAPPING.md`, `docs/SECURITY_NOTES.md`.
- Legacy миграционные скрипты (OnTrash/NightWatcher): `scripts/migrate-ontrash-users.ts`, `scripts/migrate-ontrash-watchlist.ts`, `scripts/migrate-nightwatcher-watchlist.ts`, `scripts/migrate-verify-counts.ts`, `scripts/apply-nw-tables-on-anisync.ts`.
- Устаревшие схема-снимки: `docs/schemas/nightwatcher.sql`, `docs/schemas/ontrash.sql`.
- Разовые setup/миграционные заметки в корне: `DATABASE_SETUP.md`, `MIGRATION_GUIDE.md`, `MIGRATION_SUMMARY.md`, `MIGRATION_USER_SESSIONS.md`, `VERCEL_SETUP.md`, `VPS_POSTGRES_SETUP.md`, корневой `.env.example` (канон — `apps/web/.env.example`), `apps/web/apphosting.yaml`.

**Обновлены файлы:**
- `README.md` — полностью переписан на русском по структуре readme-skill: обзор, стек, быстрый старт (Windows/PowerShell + bash), архитектура (дерево каталогов, жизненный цикл запроса, поток данных Torrents watcher, модули, очереди BullMQ), переменные окружения (обязательные/опциональные из `apps/web/.env.example`), доступные команды, тестирование, деплой (Coolify), диагностика проблем, карта документации, лицензия.
- `scripts/README.md` — сокращён до актуальных ops-скриптов (`probe-anisync-db`, `probe-integrations`, `inspect-prod-dbs`, `seed-bootstrap-admin`, `promote-admin`); убраны разделы миграции OnTrash/NightWatcher.
- `docs/schemas/README.md` — оставлены только `anisync.sql` и `anisync-live.sql`.
- `.gitignore` — убраны игноры `services/**/.env`, `services/**/__pycache__/`, `services/**/.venv/` (Python-сайдкар удалён) и `scripts/.ontrash-user-map.json` (артефакт удалённого миграционного скрипта).
- `docs/MODULE_CONTRACT.md`, `docs/PLATFORM_ARCHITECTURE.md` — ссылки на удалённые `SERVICE_CONSOLIDATION_PLAN.md`/`SERVICE_CONSOLIDATION_IMPLEMENTATION.md` в заголовках заменены на `GREENFIELD.md`/`MODULE_CONTRACT.md`/`PLATFORM_ARCHITECTURE.md`.
- `docs/GREENFIELD.md`, `docs/API_MAPPING.md`, `docs/DB_ARCHITECTURE.md`, `docs/modules/TORRENTS_ARCHITECTURE.md`, `docs/modules/RELEASES_ARCHITECTURE.md` — мёртвые ссылки на `SERVICE_CONSOLIDATION_*` заменены на `PLATFORM_ARCHITECTURE.md` / `MODULE_CONTRACT.md` / `GREENFIELD.md` / `CHANGELOG.md`; в `modules/RELEASES_ARCHITECTURE.md` исправлены относительные пути (`../`).
- `.dockerignore` — удалена строка `services/nightwatcher` (сайдкар снят).

**Обоснование:**
AniSync — однопродуктовый greenfield-репозиторий: временные планы консолидации сервисов, parity-аудиты legacy-систем (OnTrash/NextScene, NightWatcher) и разовые миграционные скрипты выполнили свою роль и больше не отражают актуальную архитектуру. Их сохранение вводит в заблуждение новых читателей и создаёт риск устаревших ссылок. Оставшаяся документация консолидирована вокруг единого runtime (`apps/web`) и текущего набора скриптов.

## 2026-07-20 (финальный parity-аудит и единый runtime)

**Файлы:** `docs/{LEGACY_PARITY_AUDIT,POST_AUDIT_CLOSURE_PLAN,API_MAPPING,SCHEMA_PARITY,SERVICE_CONSOLIDATION_IMPLEMENTATION}.md`.
Также: `docker-compose.yml`, `apps/web/Dockerfile`, torrent API/store/watcher/UI,
Releases views, TMDB tests, CI и deployment docs.

**Изменения:** опубликована доказательная матрица NextScene/NightWatcher → AniSync;
зафиксирован новый P0–P2 план закрытия; remote NightWatcher исключён из целевой API/DB
архитектуры. Python sidecar и bridge endpoint удалены. Добавлены TMDB metadata on add,
preferences, bencode magnet, pin/hunting/adopt, Releases list/grid + sort/pagination,
portable admin bootstrap и clean-Postgres CI migration. DB SSL теперь определяется
явным `sslmode`, а health checks имеют ограниченный timeout.

**Обоснование:** архив legacy допустим только после классификации каждой runtime-функции.

## 2026-07-20 (TS torrent watcher — unified stack)

### Порт NightWatcher scan-loop на TypeScript внутри AniSync

**Файлы:**
- `apps/web/src/lib/services/torrent-watcher-service.ts`
- `apps/web/src/lib/torrents/watcher/{identity,parsers,filters}.ts`
- `apps/web/src/lib/integrations/prowlarr/client.ts`
- `apps/web/src/lib/integrations/telegram/bot.ts`
- `apps/web/src/lib/queue/{names,scheduler,workers,queues}.ts`
- `apps/web/src/app/api/internal/torrents/watch/route.ts`
- `apps/web/src/modules/torrents/jobs.ts`
- `apps/web/tests/torrent-watcher.test.ts`
- `docs/modules/TORRENTS_ARCHITECTURE.md`, `SERVICE_CONSOLIDATION_IMPLEMENTATION.md`, `GREENFIELD.md`

**Изменения:**
- Единый watcher на `torrent_*`: Prowlarr → фильтры → DB → Telegram + in-app.
- BullMQ `torrents.watcher` каждые 30 мин; cron fallback без Redis.
- Python NW sidecar больше не обязателен для greenfield.

**Обоснование:**
- Продукт работает как одно целое на TypeScript (фаза 5.3).

## 2026-07-20 (integrations live + NW tables on AniSync PG)

### TMDB Bearer health; Prowlarr health; shared PG for NW sidecar

**Файлы:**
- `apps/web/src/lib/integrations/tmdb/health.ts`
- `apps/web/src/lib/integrations/prowlarr/health.ts`
- `apps/web/src/lib/config.ts`, `torrent-local-store.ts`
- `scripts/probe-integrations.ts`, `scripts/apply-nw-tables-on-anisync.ts`
- `services/nightwatcher/.env.example`
- `docs/GREENFIELD.md`, `docs/modules/TORRENTS_ARCHITECTURE.md`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- TMDB health: Bearer JWT (как client) + fallback `api_key`.
- Local torrents health зондирует Prowlarr / Telegram env.
- На AniSync PG добавлены `imdb_watchlist` + `notifications_history` для greenfield sidecar.
- Probe-скрипт интеграций; NW `.env.example`.

**Обоснование:**
- Releases готов к live TMDB; Torrents готов к sidecar без отдельной БД.

## 2026-07-20 (greenfield: skip data migration)

### Режим с нуля; миграции/cutover → N/A; registration gate

**Файлы:**
- `docs/GREENFIELD.md`, `docs/PRODUCT_DEFAULTS.md`
- `docs/SERVICE_CONSOLIDATION_PLAN.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`
- `apps/web/src/app/api/auth/register/route.ts`, `app/[locale]/register/page.tsx`
- `apps/web/src/lib/feature-flags.ts`, `settings/layout.tsx`
- `apps/web/.env.example`, `apps/web/messages/{en,ru}.json`

**Изменения:**
- Принят greenfield: нет ETL OnTrash/NW, parallel/dual-write/DNS legacy → `[n/a]`.
- Product defaults закрыты (§11).
- `REGISTRATION_OPEN` enforced в API и на странице регистрации.
- Admin OnTrash import скрыт без `LEGACY_ONTRASH_IMPORT_ENABLED`.
- Defaults модулей Releases/Torrents = on в `.env.example`.

**Обоснование:**
- Пустые БД; фокус на product-ready AniSync без strangler cutover.

## 2026-07-20 (torrents local store + parity docs)

### Local `torrent_*` facade; закрытие code-complete пунктов

**Файлы:**
- `apps/web/src/lib/services/torrent-local-store.ts`, `torrent-facade.ts`
- `apps/web/src/lib/api/torrents-module.ts`, `api/torrents/**`, `user-service.ts`
- `docs/PRODUCT_DEFAULTS.md`, `docs/RELEASES_PARITY_CHECKLIST.md`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`, `docs/modules/TORRENTS_ARCHITECTURE.md`

**Изменения:**
- Без NightWatcher: CRUD watchlist/releases/health на AniSync `torrent_*`.
- С NW URL — прежний remote mode.
- Product defaults + Releases parity checklist из кода.
- Трекер: 0.6.3/0.6.4, 1.6, 3.3.2 → `[x]`.

**Обоснование:**
- Dev/cutover prep без sidecar; модуль Torrents usable на одной AniSync DB.

## 2026-07-20 (torrent_* schema + bootstrap admin + parity docs)

### Целевые torrent-таблицы в AniSync; seed admin; parity без чужих БД

**Файлы:**
- `apps/web/src/lib/db/schema.ts`, `drizzle/0006_torrent_tables.sql`, `drizzle/meta/_journal.json`
- `scripts/seed-bootstrap-admin.ts`, `scripts/probe-anisync-db.ts` (migrate)
- `docs/SCHEMA_PARITY.md`, `docs/DUAL_WRITE_CUTOVER.md`
- `docs/DB_ARCHITECTURE.md`, `docs/modules/TORRENTS_ARCHITECTURE.md`
- `apps/web/.env.example`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Additive `torrent_watchlist` / `torrent_releases` / `torrent_notification_log` на prod AniSync (19 tables).
- Bootstrap admin при пустой `users` (`seed-bootstrap-admin.ts`).
- Документация parity схем из кода; runbook dual-write.
- Миграции OnTrash отмечены code-complete без source DB.

**Обоснование:**
- Prep фазы 4.2/4.3 без доступа к NW/OnTrash Postgres.

## 2026-07-20 (prod DB migrate + Admin OnTrash import)

### Применены Drizzle-миграции на prod AniSync; Admin UI импорта

**Файлы:**
- `scripts/probe-anisync-db.ts`, `inspect-prod-dbs.ts`, `promote-admin.ts`
- `docs/schemas/anisync-live.sql`, `docs/schemas/README.md`
- `apps/web/src/lib/api/auth.ts` (`requireAdminUser`)
- `apps/web/src/app/api/admin/migrations/ontrash/route.ts`
- `apps/web/src/app/[locale]/settings/admin/import/page.tsx`, `settings/layout.tsx`
- `apps/web/messages/en.json`, `ru.json`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Prod БД `anisync` была **пустой** → применено 16 таблиц (foundation + releases).
- Live schema snapshot `anisync-live.sql`.
- Admin UI `/settings/admin/import` (dry-run/apply при `ONTRASH_DATABASE_URL`).
- CLI `promote-admin.ts` для выдачи `role=admin`.
- NW prod с этой сети: CONNECT_TIMEOUT (миграции NW не применены удалённо).

**Обоснование:**
- Разблокирует foundation/Releases на целевой Postgres; закрывает 0.2 live и 2.3.3.

## 2026-07-20 (фаза 0.2 / 1.2 / verify / NW check_interval)

### Schema snapshots, session docs, verify-counts, check_interval

**Файлы:**
- `docs/schemas/{anisync,nightwatcher,ontrash}.sql`, `docs/schemas/README.md`
- `docs/AUTH_SESSION_MAPPING.md`
- `scripts/migrate-verify-counts.ts`, `scripts/README.md`
- `services/nightwatcher/app/watcher.py` — SQL-фильтр по `check_interval`/`last_checked`
- `services/nightwatcher/tests/test_check_interval_due.py`
- `apps/web/package.json` — удалены неиспользуемые `firebase`, `jsonwebtoken`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`, `services/nightwatcher/docs/DB_ARCHITECTURE.md`

**Изменения:**
- Снимки схем из репо (замена blocked live `pg_dump` до доступа к prod).
- Документация cutover сессий OnTrash/NW → AniSync.
- Скрипт сверки counts после миграций.
- Per-item `check_interval` в watcher; unit-тесты правила due.
- Cleanup мёртвых npm-зависимостей.

**Обоснование:**
- Закрывает незаблокированные пункты §8.4 / 0.2 / 1.2 и техдолг NW из inventory.

## 2026-07-20 (фаза 0.6.5 / 1.3 UI / 4.2 prep)

### In-app notifications, SKIP LOCKED, NW migrate script

**Файлы:**
- `apps/web/src/components/notifications-bell.tsx`, `header.tsx`, `platform-shell.tsx`
- `apps/web/src/app/api/user/notifications/route.ts`
- `apps/web/src/lib/services/notification-hub-service.ts`, `sync-service.ts`
- `apps/web/messages/en.json`, `ru.json`
- `scripts/migrate-nightwatcher-watchlist.ts`, `scripts/README.md`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Колокольчик уведомлений в header / module top bar (touch ≥44px, unread badge, mark all read).
- Claim sync jobs / entry changes через `FOR UPDATE SKIP LOCKED`.
- CLI миграция legacy NW `imdb_watchlist` → текущая NW БД (`--dry-run` / `--apply`).

**Обоснование:**
- Закрывает UX notification hub, безопасный multi-worker claim и prep к фазе 4.2 без prod cutover.

## 2026-07-20 (фаза 0.4 / 2.3 — security + migration scripts)

### Санитизация секретов и скрипты OnTrash

**Файлы:**
- `VERCEL_SETUP.md`, `VPS_POSTGRES_SETUP.md` — убраны реальные пароль/IP
- `scripts/migrate-ontrash-users.ts`, `scripts/migrate-ontrash-watchlist.ts`, `scripts/README.md`
- `services/nightwatcher/tests/test_telegram_per_user.py`
- `.github/workflows/ci.yml` (pytest)
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Docs больше не содержат live credentials (требуется **ротация** пароля PostgreSQL вне репо).
- CLI миграция OnTrash users/watchlist с `--dry-run` / `--apply`.
- NW unit-тесты на telegram per-user surface.

**Обоснование:**
- Закрывает незаблокированные пункты плана без доступа к prod DNS/Coolify UI.

## 2026-07-20 (фаза 3.1.5 / 3.3.3 — per-user Telegram + in-app)

### Telegram chat_id на пользователя

**Файлы (AniSync):**
- `apps/web/src/app/[locale]/settings/notifications/page.tsx`
- `apps/web/src/app/api/user/settings` (merge prefs + sync NW)
- `apps/web/src/app/api/torrents/watchlist/route.ts`
- `apps/web/src/app/api/internal/torrents/notify/route.ts`
- `apps/web/src/lib/integrations/nightwatcher/client.ts`
- `apps/web/messages/en.json`, `ru.json`
- `docs/API_MAPPING.md`, `docs/modules/TORRENTS_ARCHITECTURE.md`

**Файлы (NightWatcher):**
- `migrations/007_add_telegram_chat_id.sql`, `migrations/init.sql`, `app/db.py`
- `app/notifier.py`, `app/watcher.py`, `app/api.py`, `app/internal_routes.py`
- `app/anisync_notify.py`, `app/config.py` (`ANISYNC_INTERNAL_URL`)

**Изменения:**
- Settings → Notifications: `telegramChatId` + каналы.
- При add watchlist / update settings chat_id пишется в `imdb_watchlist.telegram_chat_id`.
- Notifier шлёт в per-user chat (fallback `TELEGRAM_CHAT_ID`).
- Dual-write in-app: NW → `POST /api/internal/torrents/notify`.

**Обоснование:**
- Закрывает 3.1.5 и 3.3.3 плана консолидации.

## 2026-07-20 (monorepo R0–R5 — единый репозиторий)

### Modular monorepo layout

**Файлы:**
- `docs/MODULE_CONTRACT.md`
- `docs/modules/*_ARCHITECTURE.md`
- `docs/PLATFORM_ARCHITECTURE.md`, `docs/SERVICE_CONSOLIDATION_PLAN.md` (§5.2)
- `docs/REPO_DECOMMISSION.md`
- `pnpm-workspace.yaml`, root `package.json`
- `apps/web/` (бывший корень Next.js)
- `services/nightwatcher/` (бывший отдельный репозиторий)
- `packages/README.md`

**Изменения:**
- Один репозиторий: Next.js BFF в `apps/web`, Python sidecar в `services/nightwatcher`.
- Контракт модулей (manifest + registry + feature flags).
- pnpm workspace; Docker/CI обновлены под `apps/web`.

**Обоснование:**
- Масштабирование модулей без трёх репозиториев и без выноса API в Express.

## 2026-06-16 (фаза 3.1.2 — multi-user NightWatcher)

### User-scoped torrent watchlist

**Файлы (AniSync):**
- `src/lib/integrations/nightwatcher/client.ts`
- `src/app/api/torrents/watchlist/route.ts`
- `src/app/api/torrents/watchlist/[id]/route.ts`
- `src/app/api/torrents/watchlist/[id]/toggle/route.ts`
- `src/app/api/torrents/releases/[imdbId]/route.ts`
- `tests/nightwatcher-client.test.ts`, `tests/setup-env.mjs`
- `docs/TORRENTS_ARCHITECTURE.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Файлы (NightWatcher):**
- `migrations/006_add_user_id.sql`, `migrations/init.sql`
- `app/db.py`, `app/internal_auth.py`, `app/internal_routes.py`, `app/api.py`

**Изменения:**
- Колонка `imdb_watchlist.user_id`, unique `(user_id, imdb_id)`.
- Internal API требует `X-AniSync-User-Id`; CRUD scoped per user.
- AniSync facade проксирует `users.id` в NightWatcher.

**Обоснование:**
- Устраняет IDOR: каждый пользователь видит только свой torrent watchlist.

## 2026-06-16 (фаза 3.1.4 — Torrents UI)

### React UI watchlist NightWatcher

**Файлы:**
- `src/lib/torrents/api.ts`, `hooks.ts`, `query-keys.ts`
- `src/components/torrents/torrents-watchlist-view.tsx`
- `src/components/torrents/torrent-watchlist-card.tsx`
- `src/components/torrents/torrent-add-form.tsx`
- `src/components/torrents/torrents-health-banner.tsx`
- `src/app/[locale]/torrents/layout.tsx`, `page.tsx`
- `messages/en.json`, `messages/ru.json`
- `docs/TORRENTS_ARCHITECTURE.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Watchlist: карточки, toggle, удаление, lazy-load релизов по IMDb.
- Форма добавления по IMDb id, баннер health NW.
- Адаптивная сетка карточек (без таблиц на mobile), touch targets `min-h-11`.
- Layout с feature flag `NEXT_PUBLIC_TORRENTS_MODULE_ENABLED`.

**Обоснование:**
- Закрывает 3.1.4: пользовательский UI поверх готового facade API.

## 2026-06-16 (фаза 3.2.1–3.2.2 — Releases ↔ Torrents)

### IMDb lookup + кнопка «Следить за торрентом»

**Файлы:**
- `src/lib/integrations/tmdb/client.ts`
- `src/lib/releases/types.ts`
- `src/components/releases/release-detail-modal.tsx`
- `messages/en.json`, `messages/ru.json`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- TMDB detail расширен `imdbId` через `external_ids`, с сохранением в `media_external_ids`.
- В detail modal добавлена кнопка «Следить за торрентом» (добавляет IMDb id в NightWatcher watchlist).

**Обоснование:**
- Связывает модуль Releases с Torrents без отдельного ручного ввода IMDb id.

## 2026-06-16 (фаза 3.1.1 / 3.1.3 — Torrents facade)

### HTTP facade к NightWatcher

**Файлы (AniSync):**
- `src/lib/integrations/nightwatcher/client.ts`, `types.ts`
- `src/lib/api/torrents-module.ts`
- `src/app/api/torrents/health/route.ts`
- `src/app/api/torrents/watchlist/route.ts`
- `src/app/api/torrents/watchlist/[id]/route.ts`
- `src/app/api/torrents/watchlist/[id]/toggle/route.ts`
- `src/app/api/torrents/releases/[imdbId]/route.ts`
- `src/lib/config.ts`, `.env.example`
- `tests/nightwatcher-client.test.ts`
- `docs/TORRENTS_ARCHITECTURE.md`, `docs/RELEASES_BETA_CUTOVER.md`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`, `docs/ENV_INVENTORY.md`

**Файлы (NightWatcher):**
- `app/internal_auth.py`, `app/internal_routes.py`
- `app/config.py`, `app/api.py`

**Изменения:**
- Service token `X-Internal-Service-Token` для `/api/internal/*` в NW.
- AniSync проксирует watchlist CRUD, toggle, releases, health.
- Чеклист beta cutover Releases (`RELEASES_BETA_CUTOVER.md`).

**Обоснование:**
- Strangler Fig: не переписывать watcher, дать единую точку входа из AniSync.

## 2026-06-16 (фаза 1.5.2 — адаптив Releases)

### Mobile-first UI модуля Releases

**Файлы:**
- `src/components/releases/releases-subnav.tsx`
- `src/components/releases/releases-discover-view.tsx`
- `src/components/releases/releases-watchlist-view.tsx`
- `src/components/releases/release-content-card.tsx`
- `messages/en.json`, `messages/ru.json`
- `docs/RELEASES_ARCHITECTURE.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Discover: bottom sheet с фильтрами на mobile/tablet, inline-фильтры на desktop.
- Subnav: sticky + горизонтальный scroll табов.
- Touch targets `min-h-11` на интерактивных элементах.
- Parity-чеклист фазы 2 обновлён (кроме сверки upcoming с OnTrash prod).

**Обоснование:**
- Соответствие PLATFORM_ARCHITECTURE: карточки вместо таблиц, удобство на телефонах.

## 2026-06-16 (фаза 1.5.1 / 2.2.4 — PWA Serwist)

### Service worker и иконки платформы

**Файлы:**
- `@serwist/next`, `serwist`, `src/app/sw.ts`, `next.config.ts`
- `src/components/providers/serwist-provider.tsx`
- `src/components/pwa/install-prompt.tsx`
- `public/offline.html`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- `src/app/manifest.ts`, `src/app/[locale]/layout.tsx`, `src/middleware.ts`
- `tsconfig.json`, `.gitignore`
- `docs/PLATFORM_ARCHITECTURE.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Serwist: precache, `defaultCache`, offline fallback на `/offline.html`.
- SW регистрируется в production (`SerwistProvider`); в dev отключён.
- PNG-иконки 192/512 в manifest и metadata.
- Install prompt: `src/components/pwa/install-prompt.tsx` (после 2-й авторизованной сессии).

**Обоснование:**
- Паритет с OnTrash PWA и единый installable experience для AniSync.

## 2026-06-16 (фаза 2.2.3 + PWA manifest)

### Releases React Query + платформенный manifest

**Файлы:**
- `@tanstack/react-query`, `src/components/providers/query-provider.tsx`
- `src/lib/releases/hooks.ts`, `src/lib/releases/query-keys.ts`
- `src/components/releases/*.tsx` — переход с `useEffect`+fetch на hooks
- `src/app/manifest.ts`, `src/app/[locale]/layout.tsx`
- `docs/RELEASES_ARCHITECTURE.md`, `docs/PLATFORM_ARCHITECTURE.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- React Query: кэш каталога, watchlist, деталей; мутации с автоматической invalidation.
- Удалён счётчик `watchlistRevision` — синхронизация через query cache.
- Единый PWA manifest для платформы (service worker — отдельно, фаза 1.5.1).

**Обоснование:**
- Меньше дублирования запросов, проще синхронизация UI между экранами Releases.

## 2026-06-16 (фаза 2.1.4–2.1.5 — OpenAPI + SLO)

### API observability и спецификация Releases

**Файлы:**
- `src/lib/observability/slo-metrics.ts`, `src/lib/api/with-slo.ts`
- `src/app/api/health/slo/route.ts`
- `src/app/api/releases/**/route.ts`, `src/app/api/auth/login/route.ts`
- `docs/openapi/releases.yaml`, `docs/API_ARCHITECTURE.md`
- `tests/slo-metrics.test.ts`
- `docs/RELEASES_ARCHITECTURE.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- In-memory SLO (p50/p95/p99, error rate) для ключевых API-маршрутов.
- `withSloRoute` — обёртка route handlers; медленные запросы (>1.5s) в pino.
- `GET /api/health/slo` — снимок метрик (с health secret в production).
- OpenAPI 3.1 для модуля Releases.

**Обоснование:**
- Паритет с OnTrash observability и контракт API для клиентов/Orval.

## 2026-06-16 (фаза 2.3 — Redis cache + watchlist refresh)

### Releases performance

**Файлы:**
- `src/lib/cache/redis-client.ts`, `src/lib/cache/store.ts`
- `src/lib/integrations/tmdb/cache-keys.ts`, `src/lib/integrations/tmdb/client.ts`
- `src/lib/services/releases-precompute-service.ts`
- `src/lib/services/release-watchlist-refresh-service.ts`
- `src/lib/services/release-watchlist-service.ts`
- `src/lib/queue/names.ts`, `queues.ts`, `workers.ts`, `scheduler.ts`
- `drizzle/0005_release_watchlist_schedule_updated.sql`, `src/lib/db/schema.ts`
- `tests/releases-cache.test.ts`, `.env.example`
- `docs/RELEASES_ARCHITECTURE.md`, `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Redis-кэш TMDB (upcoming, detail, release dates, schedule) с in-memory fallback.
- Worker: precompute upcoming каждые 30 мин, batch refresh watchlist каждый час.
- `GET watchlist` без N×TMDB; данные обновляются фоновой очередью.
- Колонка `schedule_updated_at` в `release_watchlist_entries`.

**Обоснование:**
- Снижение нагрузки на TMDB и ускорение API при нескольких инстансах app.

## 2026-06-16 (фаза 2.2 — Dashboard + detail modal)

### Releases UI

**Файлы:**
- `src/app/[locale]/releases/dashboard/page.tsx`
- `src/components/releases/release-detail-modal.tsx`
- `src/components/releases/releases-dashboard-view.tsx`
- `src/components/releases/release-schedule-item.tsx`
- `src/components/releases/releases-module-context.tsx`
- `src/lib/releases/utils.ts`, `src/lib/releases/api.ts`, `src/lib/releases/types.ts`
- `src/components/releases/release-content-card.tsx` — клик по карточке
- `src/navigation.ts`, `messages/en.json`, `messages/ru.json`
- `tests/release-schedule-utils.test.ts`
- `docs/RELEASES_ARCHITECTURE.md`

**Изменения:**
- Dashboard: блок «Сегодня» + сетка на 7 дней по watchlist (фильмы по `releaseDate`, сериалы по `nextEpisodeDate`).
- Модалка деталей: overview, cast, trailer, статусы plan/watching, удаление из списка.
- Общий `ReleasesModuleProvider` в layout; синхронизация watchlist между экранами.
- `/releases` и platform nav ведут на dashboard.

**Обоснование:**
- Паритет с OnTrash Dashboard и DetailModal — ключевой UX модуля Releases.

## 2026-06-16 (фаза 2 — Releases MVP, старт)

### Releases backend + UI

**Файлы:**
- `drizzle/0004_release_watchlist.sql`, `src/lib/db/schema.ts`
- `src/lib/integrations/tmdb/client.ts` (порт из OnTrash)
- `src/lib/services/release-watchlist-service.ts`
- `src/app/api/releases/content/*`, `src/app/api/releases/watchlist/*`
- `src/app/[locale]/releases/layout.tsx`, `discover/page.tsx`, `watchlist/page.tsx`
- `src/components/releases/*`, `src/lib/releases/*`
- `tests/tmdb-pagination.test.ts`
- `docs/RELEASES_ARCHITECTURE.md`
- `next.config.ts` — `image.tmdb.org`

**Изменения:**
- TMDB client с логикой upcoming/digital releases.
- API content + watchlist под `/api/releases/*`.
- Таблица `release_watchlist_entries`.
- UI: Discover (каталог + поиск) и Watchlist (статистика + фильтры).

**Обоснование:**
- Первый рабочий срез модуля Releases перед cutover OnTrash.

## 2026-06-16 (фаза 1 — Foundation)

### Платформа / UI / Схема БД

**Файлы:**
- `drizzle/0003_platform_foundation.sql`, `src/lib/db/schema.ts`
- `src/lib/services/notification-hub-service.ts`, `src/lib/services/media-external-ids-service.ts`
- `src/lib/maintenance/retention.ts`, `src/lib/queue/workers.ts`
- `src/components/platform-shell.tsx`, `src/components/platform-nav.tsx`
- `src/app/[locale]/releases/page.tsx`, `src/app/[locale]/torrents/page.tsx`
- `src/app/api/releases/health/route.ts`, `src/app/api/user/settings/route.ts` (GET)
- `messages/en.json`, `messages/ru.json`, `src/navigation.ts`
- `docs/DB_ARCHITECTURE.md`

**Изменения:**
- Расширены `users` (role, display_name), `user_settings` (enabled_modules, notification_preferences), `notifications` (module, channel, payload).
- Таблица `media_external_ids` для кросс-модульного ID mapping.
- Platform navigation shell: sidebar (desktop) + bottom nav (mobile); заглушки Releases/Torrents.
- Notification hub v1; retention cleanup подключён к worker.
- TMDB health endpoint; client-safe feature flags через `NEXT_PUBLIC_*`.

**Обоснование:**
- Фундамент единой платформы перед портированием OnTrash (Releases) и NightWatcher (Torrents).

## 2026-06-16 (реализация фазы 0.5–0.7)

### Инфраструктура / Очереди / Observability

**Файлы:**
- `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker/entrypoint.sh`
- `next.config.ts` — `output: 'standalone'`
- `src/lib/queue/*` — BullMQ scaffold
- `src/lib/observability/*` — pino + DEBUG flags
- `src/lib/feature-flags.ts`
- `src/app/api/health/route.ts`, `src/app/api/health/ready/route.ts`
- `scripts/worker.ts`, `scripts/scheduler.ts`
- `docs/COOLIFY_DEPLOY.md`
- `tests/feature-flags.test.ts`
- `package.json`, `.env.example`

**Изменения:**
- Docker multi-stage + compose (web/worker/scheduler/postgres:18/redis) для local dev.
- BullMQ: очереди `anime.sync.primary`, `anime.sync.entry`, `maintenance.cleanup`.
- При наличии `REDIS_URL` sync dispatch идёт в очередь; без Redis — HTTP fallback (обратная совместимость).
- Публичные health endpoints; feature flags; pino logging.

**Обоснование:**
- Фундамент для Coolify-deploy и масштабирования без рефакторинга при росте нагрузки.

## 2026-06-16 (инфраструктура)

### Документация

**Файлы:**
- `docs/PLATFORM_ARCHITECTURE.md`
- `docs/SERVICE_CONSOLIDATION_PLAN.md`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Зафиксировано: **PostgreSQL 18** и **Redis 7** — отдельные Coolify Database resources (`anisync-postgres`, `anisync-redis`), не часть образа приложения.
- App-сервисы (`web`, `worker`, `scheduler`) подключаются по internal `DATABASE_URL` / `REDIS_URL`.
- `docker-compose` с PG/Redis — только для локальной разработки.

**Обоснование:**
- Независимое масштабирование, бэкапы и перезапуск data layer без редеплоя приложения.

## 2026-06-16

### Документация

**Файлы:**
- `docs/PLATFORM_ARCHITECTURE.md`
- `docs/SERVICE_CONSOLIDATION_PLAN.md`
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md`

**Изменения:**
- Зафиксирована целевая версия СУБД: **PostgreSQL 18** (образ `postgres:18-alpine`, Coolify/VPS).

**Обоснование:**
- Единая версия для всех трёх доменов после слияния; избегаем downgrade при миграции существующих данных.

## 2026-06-15 (вечер)

### Документация / Архитектура

**Файлы:**
- `docs/PLATFORM_ARCHITECTURE.md` (новый)
- `docs/SERVICE_CONSOLIDATION_PLAN.md` (обновление v1.2)
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md` (обновление)

**Изменения:**
- Повторный глубокий анализ трёх codebases подтвердил корректность стратегии Strangler Fig и bounded contexts.
- Зафиксировано расхождение: план изначально ориентирован на Vercel — **целевой деплой переведён на Coolify** (web + worker + scheduler как отдельные процессы).
- Добавлена целевая продакшен-архитектура: **BullMQ + Redis** (очереди, кэш TMDB, rate limits), pino + DEBUG flags, retention jobs, PWA, отказоустойчивость.
- В трекер добавлены фазы 0.5 (Docker), 0.6 (очереди), 0.7 (observability).

**Обоснование:**
- Текущий DB-as-queue + HTTP self-dispatch не выдержит нагрузку и большие библиотеки; TMDB/OnTrash и NightWatcher имеют критические bottlenecks, которые нужно закладывать до переноса UI.

## 2026-06-15

### Документация

**Файлы:**
- `docs/SERVICE_CONSOLIDATION_IMPLEMENTATION.md` (новый)
- `docs/SERVICE_CONSOLIDATION_PLAN.md` (восстановлен)
- `docs/CHANGELOG.md` (обновление)

**Изменения:**
- Проведена верификация плана объединения сервисов по фактическому коду трёх репозиториев (`anisync`, `NextScene`, `nightwatcher`): ключевые утверждения подтверждены.
- Создан трекер реализации `SERVICE_CONSOLIDATION_IMPLEMENTATION.md` с легендой статусов (`[x]`/`[~]`/`[ ]`/`[blocked]`), сводкой верификации, чеклистом по фазам 0–5, критериями готовности и сводным прогрессом.
- Восстановлен и исправлен план `SERVICE_CONSOLIDATION_PLAN.md` (версия 1.1): `app/watcher.py` ~1745 строк (было ~1280); NightWatcher single-tenant + обязательный `SESSION_SECRET`; OnTrash `lib/integrations` отсутствует (только glob), `app_sessions` вне Drizzle-схемы; AniSync cron — programmatic fetch (нет `vercel.json` schedule); таблица `notifications` AniSync рабочая (не «заготовка»).

**Обоснование:**
- Восстановить удалённые планы и привести документацию в соответствие с реальным состоянием кода (правило проекта о синхронности кода и документации).

## 2026-05-25

### Документация

**Файлы:**
- `docs/SERVICE_CONSOLIDATION_PLAN.md` (новый)
- `docs/CHANGELOG.md` (новый)

**Изменения:**
- Добавлен подробный план объединения трёх сервисов (AniSync, OnTrash/NextScene, NightWatcher) в единую платформу с AniSync как хостом.
- Описаны: сравнительный анализ, целевая архитектура (modular monolith + Python worker для торрентов), 6 фаз миграции со стратегией Strangler Fig, схема БД, унификация auth, риски и критерии готовности.

**Обоснование:**
- Зафиксировать стратегию плавного перехода до начала реализации; избежать big-bang и регрессий в prod AniSync.
