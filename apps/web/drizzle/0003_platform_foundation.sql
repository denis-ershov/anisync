ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "enabled_modules" jsonb DEFAULT '["anime"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb DEFAULT '{"inApp":true,"telegram":false,"email":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "module" text DEFAULT 'anime' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'in_app' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "payload" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_module_idx" ON "notifications" USING btree ("module");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_external_ids" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_type" text NOT NULL,
	"tmdb_id" text,
	"imdb_id" text,
	"mal_id" integer,
	"anilist_id" integer,
	"shikimori_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_external_ids_tmdb_type_idx" ON "media_external_ids" USING btree ("tmdb_id","media_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_external_ids_mal_id_idx" ON "media_external_ids" USING btree ("mal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_external_ids_imdb_id_idx" ON "media_external_ids" USING btree ("imdb_id");
