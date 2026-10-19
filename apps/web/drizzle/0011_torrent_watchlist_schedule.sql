ALTER TABLE "torrent_watchlist" ADD COLUMN IF NOT EXISTS "digital_release_date" text;
ALTER TABLE "torrent_watchlist" ADD COLUMN IF NOT EXISTS "next_episode_season" integer;
ALTER TABLE "torrent_watchlist" ADD COLUMN IF NOT EXISTS "next_episode_number" integer;
ALTER TABLE "torrent_watchlist" ADD COLUMN IF NOT EXISTS "next_episode_date" text;
ALTER TABLE "torrent_watchlist" ADD COLUMN IF NOT EXISTS "schedule_updated_at" timestamp;
