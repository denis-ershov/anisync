-- AniSync schema snapshot from apps/web/drizzle (repo migrations, not live pg_dump)
-- Generated: 2026-07-20

-- ===== 0000_crazy_proteus.sql =====
CREATE TABLE "user_anime_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"anime_id" integer NOT NULL,
	"status" text DEFAULT 'Not Added' NOT NULL,
	"rating" integer,
	"progress" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"service_name" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"username" text,
	"user_id_external" text,
	"automatic_sync" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"primary_service" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user_anime_list" ADD CONSTRAINT "user_anime_list_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_anime_list_user_id_idx" ON "user_anime_list" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_anime_list_anime_id_idx" ON "user_anime_list" USING btree ("anime_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_anime_list_user_anime_idx" ON "user_anime_list" USING btree ("user_id","anime_id");--> statement-breakpoint
CREATE INDEX "user_integrations_user_id_idx" ON "user_integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_integrations_service_idx" ON "user_integrations" USING btree ("service_name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_integrations_user_service_idx" ON "user_integrations" USING btree ("user_id","service_name");--> statement-breakpoint
CREATE INDEX "user_settings_user_id_idx" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");

-- ===== 0001_add_user_sessions.sql =====
CREATE TABLE "user_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");


-- ===== 0002_local_library_and_sync.sql =====
CREATE TABLE "anime_catalog" (
  "id" serial PRIMARY KEY NOT NULL,
  "mal_id" integer,
  "title_default" text NOT NULL,
  "title_english" text,
  "title_japanese" text,
  "title_russian" text,
  "license_name_ru" text,
  "synonyms" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "kind" text,
  "rating" text,
  "score" double precision,
  "status" text,
  "episodes" integer,
  "episodes_aired" integer,
  "duration" integer,
  "aired_on" text,
  "released_on" text,
  "season" text,
  "url" text,
  "cover_image" text,
  "next_episode_date" text,
  "is_censored" boolean DEFAULT false NOT NULL,
  "genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "studios" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "description" text,
  "description_html" text,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anime_service_ids" (
  "id" serial PRIMARY KEY NOT NULL,
  "anime_id" integer NOT NULL,
  "service_name" text NOT NULL,
  "external_anime_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_library_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "anime_id" integer NOT NULL,
  "source_service" text NOT NULL,
  "source_entry_id" text,
  "watch_status" text DEFAULT 'planned' NOT NULL,
  "watched_episodes" integer DEFAULT 0 NOT NULL,
  "total_episodes_snapshot" integer,
  "personal_rating" double precision,
  "notes" text,
  "notes_sync_status" text DEFAULT 'local_only' NOT NULL,
  "out_of_sync" boolean DEFAULT false NOT NULL,
  "is_favorite" boolean DEFAULT false NOT NULL,
  "is_not_interested" boolean DEFAULT false NOT NULL,
  "last_provider_update_at" timestamp,
  "last_synced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_entry_changes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "library_entry_id" integer NOT NULL,
  "change_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "synced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "primary_service" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "direction" text DEFAULT 'primary_import' NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "started_at" timestamp,
  "finished_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_job_attempts" (
  "id" serial PRIMARY KEY NOT NULL,
  "sync_job_id" integer NOT NULL,
  "service_name" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "request_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "response_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "started_at" timestamp,
  "finished_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "anime_id" integer NOT NULL,
  "watched_episodes" integer DEFAULT 0 NOT NULL,
  "watch_status" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_lists" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "anime_id" integer NOT NULL,
  "list_type" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "anime_id" integer,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anime_service_ids" ADD CONSTRAINT "anime_service_ids_anime_id_anime_catalog_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime_catalog"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_library_entries" ADD CONSTRAINT "user_library_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_library_entries" ADD CONSTRAINT "user_library_entries_anime_id_anime_catalog_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime_catalog"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_entry_changes" ADD CONSTRAINT "user_entry_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_entry_changes" ADD CONSTRAINT "user_entry_changes_library_entry_id_user_library_entries_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."user_library_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sync_job_attempts" ADD CONSTRAINT "sync_job_attempts_sync_job_id_sync_jobs_id_fk" FOREIGN KEY ("sync_job_id") REFERENCES "public"."sync_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_anime_id_anime_catalog_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime_catalog"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_lists" ADD CONSTRAINT "user_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_lists" ADD CONSTRAINT "user_lists_anime_id_anime_catalog_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime_catalog"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_anime_id_anime_catalog_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime_catalog"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "anime_catalog_mal_id_idx" ON "anime_catalog" USING btree ("mal_id");
--> statement-breakpoint
CREATE INDEX "anime_catalog_title_idx" ON "anime_catalog" USING btree ("title_default");
--> statement-breakpoint
CREATE UNIQUE INDEX "anime_service_ids_service_external_idx" ON "anime_service_ids" USING btree ("service_name","external_anime_id");
--> statement-breakpoint
CREATE INDEX "anime_service_ids_anime_idx" ON "anime_service_ids" USING btree ("anime_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_library_entries_user_anime_idx" ON "user_library_entries" USING btree ("user_id","anime_id");
--> statement-breakpoint
CREATE INDEX "user_library_entries_user_source_idx" ON "user_library_entries" USING btree ("user_id","source_service");
--> statement-breakpoint
CREATE INDEX "user_library_entries_status_idx" ON "user_library_entries" USING btree ("watch_status");
--> statement-breakpoint
CREATE INDEX "user_entry_changes_entry_idx" ON "user_entry_changes" USING btree ("library_entry_id");
--> statement-breakpoint
CREATE INDEX "user_entry_changes_status_idx" ON "user_entry_changes" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sync_jobs_user_idx" ON "sync_jobs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sync_job_attempts_sync_job_idx" ON "sync_job_attempts" USING btree ("sync_job_id");
--> statement-breakpoint
CREATE INDEX "watch_history_user_idx" ON "watch_history" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "watch_history_anime_idx" ON "watch_history" USING btree ("anime_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_lists_user_anime_type_idx" ON "user_lists" USING btree ("user_id","anime_id","list_type");
--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("read_at");

-- ===== 0003_platform_foundation.sql =====
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

-- ===== 0004_release_watchlist.sql =====
CREATE TABLE IF NOT EXISTS "release_watchlist_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tmdb_id" integer NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"title_ru" text,
	"rating" double precision,
	"popularity" double precision,
	"poster_path" text,
	"genre" text,
	"genre_ru" text,
	"year" integer,
	"release_date" text,
	"next_episode_season" integer,
	"next_episode_number" integer,
	"next_episode_date" text,
	"added_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "release_watchlist_entries" ADD CONSTRAINT "release_watchlist_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "release_watchlist_user_id_idx" ON "release_watchlist_entries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "release_watchlist_user_tmdb_type_idx" ON "release_watchlist_entries" USING btree ("user_id","tmdb_id","type");

-- ===== 0005_release_watchlist_schedule_updated.sql =====
ALTER TABLE "release_watchlist_entries" ADD COLUMN IF NOT EXISTS "schedule_updated_at" timestamp;

