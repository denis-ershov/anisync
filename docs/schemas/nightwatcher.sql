-- NightWatcher schema snapshot from services/nightwatcher/migrations/init.sql
-- Date: 2026-07-20 (repo migration, not live pg_dump)

CREATE TABLE IF NOT EXISTS imdb_watchlist (
    -- Основные поля
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    imdb_id TEXT NOT NULL,
    title TEXT,
    original_title TEXT,
    type TEXT CHECK (type IN ('movie', 'tv')),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),

    -- Метаданные (основные)
    poster_url TEXT,
    year TEXT,
    genre TEXT,
    plot TEXT,
    rating TEXT,
    runtime TEXT,

    -- Отслеживание
    last_checked TIMESTAMP,
    total_seasons INTEGER,
    total_episodes INTEGER,
    last_notified_season INTEGER DEFAULT 0,
    last_notified_episode INTEGER DEFAULT 0,
    target_season INTEGER,  -- Конкретный сезон для отслеживания (опционально)
    preferred_quality TEXT,  -- Предпочтительное качество видео (например: 1080p, 2160p SDR, 2160p HDR, UHD, 4K)
    preferred_audio TEXT,  -- Предпочтительная озвучка (например: русская, русский, dub, озвучка)
    max_releases_count INTEGER DEFAULT NULL,  -- Максимальное количество раздач для отслеживания
    check_interval INTEGER DEFAULT NULL,  -- Интервал проверки в минутах (NULL = использовать значение по умолчанию)
    notify_once BOOLEAN DEFAULT FALSE,  -- Уведомить один раз и отключить (для фильмов)
    pinned_release_key TEXT DEFAULT NULL,  -- Идентификатор закреплённого релиза (отслеживать только его / в приоритете)
    pinned_release_aliases TEXT DEFAULT NULL,  -- JSON-массив идентификаторов закреплённого релиза
    pinned_release_title TEXT DEFAULT NULL,  -- Название закреплённого релиза (для UI)
    tmdb_id INTEGER DEFAULT NULL,  -- TMDB ID сериала для получения информации о сезонах
    season_episode_count INTEGER DEFAULT NULL,  -- Количество серий в отслеживаемом сезоне
    telegram_chat_id TEXT DEFAULT NULL,  -- Per-user Telegram chat from AniSync settings

    -- Метаданные (расширенные - для сериалов)
    status TEXT,
    network TEXT,
    country TEXT,
    language TEXT,
    official_site TEXT,
    schedule TEXT,
    last_air_date TEXT,
    in_production BOOLEAN,

    -- Метаданные (расширенные - для фильмов/сериалов)
    actors TEXT,
    director TEXT,
    creators TEXT,
    tagline TEXT,
    original_language TEXT,
    budget TEXT,
    revenue TEXT
);

ALTER TABLE imdb_watchlist DROP CONSTRAINT IF EXISTS imdb_watchlist_imdb_id_key;
DO $$
BEGIN
    ALTER TABLE imdb_watchlist
        ADD CONSTRAINT imdb_watchlist_user_imdb_unique UNIQUE (user_id, imdb_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS torrent_releases (
    id SERIAL PRIMARY KEY,
    imdb_id TEXT NOT NULL,
    title TEXT,
    info_hash TEXT NOT NULL,
    quality TEXT,
    size BIGINT,
    seeders INT,
    tracker TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    last_update TIMESTAMP DEFAULT now(),
    last_notified_at TIMESTAMP DEFAULT NULL,  -- Время последнего отправленного уведомления об этой раздаче
    notification_count INTEGER DEFAULT 0,  -- Количество отправленных уведомлений об этой раздаче
    content_hash TEXT DEFAULT NULL,  -- Хеш содержимого раздачи (размер + название) для отслеживания изменений
    current_episode INTEGER DEFAULT NULL,  -- Текущая серия из названия раздачи (например, 5 из "E01-05 of 10")
    total_episodes INTEGER DEFAULT NULL,  -- Общее количество серий из названия раздачи (например, 10 из "E01-05 of 10")
    UNIQUE (imdb_id, info_hash)
);

-- Таблица истории уведомлений
CREATE TABLE IF NOT EXISTS notifications_history (
    id SERIAL PRIMARY KEY,
    imdb_id TEXT NOT NULL,
    release_title TEXT,
    notification_text TEXT,
    sent_at TIMESTAMP DEFAULT now(),
    success BOOLEAN DEFAULT TRUE
);

-- Индексы для оптимизации производительности
CREATE INDEX IF NOT EXISTS idx_watchlist_enabled ON imdb_watchlist(enabled);
CREATE INDEX IF NOT EXISTS idx_watchlist_imdb_id ON imdb_watchlist(imdb_id);
CREATE INDEX IF NOT EXISTS idx_imdb_watchlist_user_id ON imdb_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_imdb_watchlist_user_enabled ON imdb_watchlist(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_watchlist_type ON imdb_watchlist(type);
CREATE INDEX IF NOT EXISTS idx_watchlist_created_at ON imdb_watchlist(created_at);
CREATE INDEX IF NOT EXISTS idx_watchlist_tmdb_id ON imdb_watchlist(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_releases_imdb_created ON torrent_releases(imdb_id, created_at);
CREATE INDEX IF NOT EXISTS idx_releases_tracker ON torrent_releases(tracker);
CREATE INDEX IF NOT EXISTS idx_releases_created_at ON torrent_releases(created_at);
CREATE INDEX IF NOT EXISTS idx_releases_last_notified ON torrent_releases(imdb_id, last_notified_at);
CREATE INDEX IF NOT EXISTS idx_releases_episodes ON torrent_releases(imdb_id, current_episode);
CREATE INDEX IF NOT EXISTS idx_notifications_imdb ON notifications_history(imdb_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications_history(sent_at);

-- Комментарии к полям
COMMENT ON COLUMN imdb_watchlist.max_releases_count IS 'Максимальное количество раздач для отслеживания (NULL = отслеживать все раздачи)';
COMMENT ON COLUMN imdb_watchlist.check_interval IS 'Интервал проверки в минутах (NULL = использовать значение по умолчанию)';
COMMENT ON COLUMN imdb_watchlist.notify_once IS 'Уведомить один раз и отключить (для фильмов)';
COMMENT ON COLUMN imdb_watchlist.tmdb_id IS 'TMDB ID сериала для получения информации о сезонах';
COMMENT ON COLUMN imdb_watchlist.season_episode_count IS 'Количество серий в отслеживаемом сезоне';
COMMENT ON COLUMN torrent_releases.last_notified_at IS 'Время последнего отправленного уведомления об этой раздаче';
COMMENT ON COLUMN torrent_releases.notification_count IS 'Количество отправленных уведомлений об этой раздаче';
COMMENT ON COLUMN torrent_releases.content_hash IS 'Хеш содержимого раздачи (размер + название) для отслеживания изменений';
COMMENT ON COLUMN torrent_releases.current_episode IS 'Текущая серия из названия раздачи (например, 5 из "E01-05 of 10")';
COMMENT ON COLUMN torrent_releases.total_episodes IS 'Общее количество серий из названия раздачи (например, 10 из "E01-05 of 10")';
