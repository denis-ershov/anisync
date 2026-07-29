ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT 'Europe/Moscow';
