ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "torrent_metadata_refresh_fields" jsonb NOT NULL DEFAULT '["posters", "ratings", "genres", "plot", "details", "episodes"]'::jsonb;
