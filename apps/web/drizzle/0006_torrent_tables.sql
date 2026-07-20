CREATE TABLE IF NOT EXISTS "torrent_watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"imdb_id" text NOT NULL,
	"title" text,
	"original_title" text,
	"type" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"poster_url" text,
	"year" text,
	"genre" text,
	"plot" text,
	"rating" text,
	"runtime" text,
	"last_checked" timestamp,
	"total_seasons" integer,
	"total_episodes" integer,
	"last_notified_season" integer DEFAULT 0,
	"last_notified_episode" integer DEFAULT 0,
	"target_season" integer,
	"preferred_quality" text,
	"preferred_audio" text,
	"max_releases_count" integer,
	"check_interval" integer,
	"notify_once" boolean DEFAULT false NOT NULL,
	"pinned_release_key" text,
	"pinned_release_aliases" text,
	"pinned_release_title" text,
	"tmdb_id" integer,
	"season_episode_count" integer,
	"telegram_chat_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "torrent_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"imdb_id" text NOT NULL,
	"title" text,
	"info_hash" text NOT NULL,
	"quality" text,
	"size" bigint,
	"seeders" integer,
	"tracker" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_update" timestamp DEFAULT now() NOT NULL,
	"last_notified_at" timestamp,
	"notification_count" integer DEFAULT 0 NOT NULL,
	"content_hash" text,
	"current_episode" integer,
	"total_episodes" integer
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "torrent_notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"imdb_id" text NOT NULL,
	"release_title" text,
	"notification_text" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"success" boolean DEFAULT true NOT NULL
);--> statement-breakpoint
ALTER TABLE "torrent_watchlist" ADD CONSTRAINT "torrent_watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrent_notification_log" ADD CONSTRAINT "torrent_notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "torrent_watchlist_user_imdb_idx" ON "torrent_watchlist" USING btree ("user_id","imdb_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "torrent_watchlist_user_enabled_idx" ON "torrent_watchlist" USING btree ("user_id","enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "torrent_watchlist_imdb_idx" ON "torrent_watchlist" USING btree ("imdb_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "torrent_releases_imdb_hash_idx" ON "torrent_releases" USING btree ("imdb_id","info_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "torrent_releases_imdb_created_idx" ON "torrent_releases" USING btree ("imdb_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "torrent_notification_log_imdb_idx" ON "torrent_notification_log" USING btree ("imdb_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "torrent_notification_log_sent_at_idx" ON "torrent_notification_log" USING btree ("sent_at");
