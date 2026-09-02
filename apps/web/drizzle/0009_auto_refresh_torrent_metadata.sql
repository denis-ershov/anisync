ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "auto_refresh_torrent_metadata" boolean NOT NULL DEFAULT false;
