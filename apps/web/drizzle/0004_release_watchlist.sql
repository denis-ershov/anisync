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
