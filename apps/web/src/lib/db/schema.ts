import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
  jsonb,
  doublePrecision,
  bigint,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

const integrationServices = ['shikimori', 'myanimelist', 'anilist'] as const;
const libraryStatuses = [
  'watching',
  'planned',
  'completed',
  'on_hold',
  'dropped',
  'rewatching',
  'not_interested',
] as const;
const syncStatuses = ['pending', 'running', 'completed', 'failed'] as const;
const entryChangeStatuses = ['pending', 'processing', 'synced', 'failed', 'local_only'] as const;
const notificationTypes = ['new_episode', 'sync_failed', 'sync_completed', 'system'] as const;
const notificationModules = ['anime', 'releases', 'torrents', 'platform'] as const;
const notificationChannels = ['in_app', 'telegram', 'email'] as const;
const userRoles = ['user', 'admin'] as const;
const platformModules = ['anime', 'releases', 'torrents'] as const;
const mediaTypes = ['anime', 'movie', 'show'] as const;
const releaseTypes = ['movie', 'show'] as const;
const releaseWatchlistStatuses = ['watching', 'plan'] as const;
const userListTypes = ['favorite', 'not_interested'] as const;
const torrentMediaTypes = ['movie', 'tv'] as const;

export type ReleaseContentType = (typeof releaseTypes)[number];
export type ReleaseWatchlistStatus = (typeof releaseWatchlistStatuses)[number];

export type NotificationModule = (typeof notificationModules)[number];
export type NotificationChannel = (typeof notificationChannels)[number];
export type UserRole = (typeof userRoles)[number];
export type PlatformModule = (typeof platformModules)[number];
export type MediaType = (typeof mediaTypes)[number];

export type NotificationPreferences = {
  inApp?: boolean;
  telegram?: boolean;
  email?: boolean;
  telegramChatId?: string | null;
};

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    role: text('role', { enum: userRoles }).default('user').notNull(),
    bio: text('bio'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    usernameIdx: uniqueIndex('users_username_idx').on(table.username),
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
);

export const userSettings = pgTable(
  'user_settings',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    theme: text('theme', { enum: ['light', 'dark'] }).default('dark').notNull(),
    language: text('language', { enum: ['en', 'ru'] }).default('en').notNull(),
    primaryService: text('primary_service', {
      enum: integrationServices,
    }),
    enabledModules: jsonb('enabled_modules').$type<PlatformModule[]>().default(['anime']).notNull(),
    notificationPreferences: jsonb('notification_preferences')
      .$type<NotificationPreferences>()
      .default({ inApp: true, telegram: false, email: false })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('user_settings_user_id_idx').on(table.userId),
  })
);

export const userAnimeList = pgTable(
  'user_anime_list',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    animeId: integer('anime_id').notNull(),
    status: text('status', {
      enum: ['Watching', 'Planned', 'Completed', 'On Hold', 'Dropped', 'Not Added'],
    })
      .default('Not Added')
      .notNull(),
    rating: integer('rating'),
    progress: integer('progress').default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('user_anime_list_user_id_idx').on(table.userId),
    animeIdIdx: index('user_anime_list_anime_id_idx').on(table.animeId),
    userAnimeIdx: uniqueIndex('user_anime_list_user_anime_idx').on(table.userId, table.animeId),
  })
);

export const userIntegrations = pgTable(
  'user_integrations',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serviceName: text('service_name', {
      enum: integrationServices,
    }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    username: text('username'),
    userIdExternal: text('user_id_external'),
    automaticSync: boolean('automatic_sync').default(false).notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('user_integrations_user_id_idx').on(table.userId),
    serviceIdx: index('user_integrations_service_idx').on(table.serviceName),
    userServiceIdx: uniqueIndex('user_integrations_user_service_idx').on(table.userId, table.serviceName),
  })
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('user_sessions_expires_at_idx').on(table.expiresAt),
  })
);

export const animeCatalog = pgTable(
  'anime_catalog',
  {
    id: serial('id').primaryKey(),
    malId: integer('mal_id'),
    titleDefault: text('title_default').notNull(),
    titleEnglish: text('title_english'),
    titleJapanese: text('title_japanese'),
    titleRussian: text('title_russian'),
    licenseNameRu: text('license_name_ru'),
    synonyms: jsonb('synonyms').$type<string[]>().default([]).notNull(),
    kind: text('kind'),
    rating: text('rating'),
    score: doublePrecision('score'),
    status: text('status'),
    episodes: integer('episodes'),
    episodesAired: integer('episodes_aired'),
    duration: integer('duration'),
    airedOn: text('aired_on'),
    releasedOn: text('released_on'),
    season: text('season'),
    url: text('url'),
    coverImage: text('cover_image'),
    nextEpisodeDate: text('next_episode_date'),
    isCensored: boolean('is_censored').default(false).notNull(),
    genres: jsonb('genres').$type<Array<{ id: string; name: string; kind?: string }>>().default([]).notNull(),
    studios: jsonb('studios').$type<Array<{ id: string; name: string; image?: string }>>().default([]).notNull(),
    description: text('description'),
    descriptionHtml: text('description_html'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    malIdIdx: uniqueIndex('anime_catalog_mal_id_idx').on(table.malId),
    titleIdx: index('anime_catalog_title_idx').on(table.titleDefault),
  })
);

export const animeServiceIds = pgTable(
  'anime_service_ids',
  {
    id: serial('id').primaryKey(),
    animeId: integer('anime_id')
      .notNull()
      .references(() => animeCatalog.id, { onDelete: 'cascade' }),
    serviceName: text('service_name', { enum: integrationServices }).notNull(),
    externalAnimeId: text('external_anime_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    animeServiceUniqueIdx: uniqueIndex('anime_service_ids_service_external_idx').on(
      table.serviceName,
      table.externalAnimeId
    ),
    animeServiceAnimeIdx: index('anime_service_ids_anime_idx').on(table.animeId),
  })
);

export const userLibraryEntries = pgTable(
  'user_library_entries',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    animeId: integer('anime_id')
      .notNull()
      .references(() => animeCatalog.id, { onDelete: 'cascade' }),
    sourceService: text('source_service', { enum: integrationServices }).notNull(),
    sourceEntryId: text('source_entry_id'),
    watchStatus: text('watch_status', { enum: libraryStatuses }).default('planned').notNull(),
    watchedEpisodes: integer('watched_episodes').default(0).notNull(),
    totalEpisodesSnapshot: integer('total_episodes_snapshot'),
    personalRating: doublePrecision('personal_rating'),
    notes: text('notes'),
    notesSyncStatus: text('notes_sync_status', { enum: entryChangeStatuses }).default('local_only').notNull(),
    outOfSync: boolean('out_of_sync').default(false).notNull(),
    isFavorite: boolean('is_favorite').default(false).notNull(),
    isNotInterested: boolean('is_not_interested').default(false).notNull(),
    lastProviderUpdateAt: timestamp('last_provider_update_at'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userAnimeUniqueIdx: uniqueIndex('user_library_entries_user_anime_idx').on(table.userId, table.animeId),
    userSourceIdx: index('user_library_entries_user_source_idx').on(table.userId, table.sourceService),
    statusIdx: index('user_library_entries_status_idx').on(table.watchStatus),
  })
);

export const userEntryChanges = pgTable(
  'user_entry_changes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    libraryEntryId: integer('library_entry_id')
      .notNull()
      .references(() => userLibraryEntries.id, { onDelete: 'cascade' }),
    changeType: text('change_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    status: text('status', { enum: entryChangeStatuses }).default('pending').notNull(),
    syncedAt: timestamp('synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entryIdx: index('user_entry_changes_entry_idx').on(table.libraryEntryId),
    statusIdx: index('user_entry_changes_status_idx').on(table.status),
  })
);

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    primaryService: text('primary_service', { enum: integrationServices }).notNull(),
    status: text('status', { enum: syncStatuses }).default('pending').notNull(),
    direction: text('direction').default('primary_import').notNull(),
    summary: jsonb('summary').$type<Record<string, unknown>>().default({}).notNull(),
    error: text('error'),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('sync_jobs_user_idx').on(table.userId),
    statusIdx: index('sync_jobs_status_idx').on(table.status),
  })
);

export const syncJobAttempts = pgTable(
  'sync_job_attempts',
  {
    id: serial('id').primaryKey(),
    syncJobId: integer('sync_job_id')
      .notNull()
      .references(() => syncJobs.id, { onDelete: 'cascade' }),
    serviceName: text('service_name', { enum: integrationServices }).notNull(),
    status: text('status', { enum: syncStatuses }).default('pending').notNull(),
    requestPayload: jsonb('request_payload').$type<Record<string, unknown>>().default({}).notNull(),
    responsePayload: jsonb('response_payload').$type<Record<string, unknown>>().default({}).notNull(),
    error: text('error'),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    syncJobIdx: index('sync_job_attempts_sync_job_idx').on(table.syncJobId),
  })
);

export const watchHistory = pgTable(
  'watch_history',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    animeId: integer('anime_id')
      .notNull()
      .references(() => animeCatalog.id, { onDelete: 'cascade' }),
    watchedEpisodes: integer('watched_episodes').default(0).notNull(),
    watchStatus: text('watch_status', { enum: libraryStatuses }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('watch_history_user_idx').on(table.userId),
    animeIdx: index('watch_history_anime_idx').on(table.animeId),
  })
);

export const userLists = pgTable(
  'user_lists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    animeId: integer('anime_id')
      .notNull()
      .references(() => animeCatalog.id, { onDelete: 'cascade' }),
    listType: text('list_type', { enum: userListTypes }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userListUniqueIdx: uniqueIndex('user_lists_user_anime_type_idx').on(table.userId, table.animeId, table.listType),
  })
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    animeId: integer('anime_id').references(() => animeCatalog.id, { onDelete: 'set null' }),
    type: text('type', { enum: notificationTypes }).notNull(),
    module: text('module', { enum: notificationModules }).default('anime').notNull(),
    channel: text('channel', { enum: notificationChannels }).default('in_app').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('notifications_user_idx').on(table.userId),
    unreadIdx: index('notifications_unread_idx').on(table.readAt),
    moduleIdx: index('notifications_module_idx').on(table.module),
  })
);

export const mediaExternalIds = pgTable(
  'media_external_ids',
  {
    id: serial('id').primaryKey(),
    mediaType: text('media_type', { enum: mediaTypes }).notNull(),
    tmdbId: text('tmdb_id'),
    imdbId: text('imdb_id'),
    malId: integer('mal_id'),
    anilistId: integer('anilist_id'),
    shikimoriId: text('shikimori_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tmdbTypeIdx: index('media_external_ids_tmdb_type_idx').on(table.tmdbId, table.mediaType),
    malIdIdx: uniqueIndex('media_external_ids_mal_id_idx').on(table.malId),
    imdbIdIdx: index('media_external_ids_imdb_id_idx').on(table.imdbId),
  })
);

export const releaseWatchlistEntries = pgTable(
  'release_watchlist_entries',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    type: text('type', { enum: releaseTypes }).notNull(),
    status: text('status', { enum: releaseWatchlistStatuses }).notNull(),
    title: text('title').notNull(),
    titleRu: text('title_ru'),
    rating: doublePrecision('rating'),
    popularity: doublePrecision('popularity'),
    posterPath: text('poster_path'),
    genre: text('genre'),
    genreRu: text('genre_ru'),
    year: integer('year'),
    releaseDate: text('release_date'),
    nextEpisodeSeason: integer('next_episode_season'),
    nextEpisodeNumber: integer('next_episode_number'),
    nextEpisodeDate: text('next_episode_date'),
    addedAt: timestamp('added_at').defaultNow().notNull(),
    scheduleUpdatedAt: timestamp('schedule_updated_at'),
  },
  (table) => ({
    userIdIdx: index('release_watchlist_user_id_idx').on(table.userId),
    userTmdbTypeIdx: uniqueIndex('release_watchlist_user_tmdb_type_idx').on(
      table.userId,
      table.tmdbId,
      table.type
    ),
  })
);

/** Target tables for NightWatcher cutover (NW: imdb_watchlist → torrent_watchlist). */
export const torrentWatchlist = pgTable(
  'torrent_watchlist',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    imdbId: text('imdb_id').notNull(),
    title: text('title'),
    originalTitle: text('original_title'),
    type: text('type', { enum: torrentMediaTypes }),
    enabled: boolean('enabled').default(true).notNull(),
    posterUrl: text('poster_url'),
    year: text('year'),
    genre: text('genre'),
    plot: text('plot'),
    rating: text('rating'),
    runtime: text('runtime'),
    lastChecked: timestamp('last_checked'),
    totalSeasons: integer('total_seasons'),
    totalEpisodes: integer('total_episodes'),
    lastNotifiedSeason: integer('last_notified_season').default(0),
    lastNotifiedEpisode: integer('last_notified_episode').default(0),
    targetSeason: integer('target_season'),
    preferredQuality: text('preferred_quality'),
    preferredAudio: text('preferred_audio'),
    maxReleasesCount: integer('max_releases_count'),
    checkInterval: integer('check_interval'),
    notifyOnce: boolean('notify_once').default(false).notNull(),
    pinnedReleaseKey: text('pinned_release_key'),
    pinnedReleaseAliases: text('pinned_release_aliases'),
    pinnedReleaseTitle: text('pinned_release_title'),
    tmdbId: integer('tmdb_id'),
    seasonEpisodeCount: integer('season_episode_count'),
    telegramChatId: text('telegram_chat_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userImdbUnique: uniqueIndex('torrent_watchlist_user_imdb_idx').on(table.userId, table.imdbId),
    userEnabledIdx: index('torrent_watchlist_user_enabled_idx').on(table.userId, table.enabled),
    imdbIdx: index('torrent_watchlist_imdb_idx').on(table.imdbId),
  })
);

export const torrentReleases = pgTable(
  'torrent_releases',
  {
    id: serial('id').primaryKey(),
    imdbId: text('imdb_id').notNull(),
    title: text('title'),
    infoHash: text('info_hash').notNull(),
    quality: text('quality'),
    size: bigint('size', { mode: 'number' }),
    seeders: integer('seeders'),
    tracker: text('tracker'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUpdate: timestamp('last_update').defaultNow().notNull(),
    lastNotifiedAt: timestamp('last_notified_at'),
    notificationCount: integer('notification_count').default(0).notNull(),
    contentHash: text('content_hash'),
    currentEpisode: integer('current_episode'),
    totalEpisodes: integer('total_episodes'),
  },
  (table) => ({
    imdbHashUnique: uniqueIndex('torrent_releases_imdb_hash_idx').on(table.imdbId, table.infoHash),
    imdbCreatedIdx: index('torrent_releases_imdb_created_idx').on(table.imdbId, table.createdAt),
  })
);

export const torrentNotificationLog = pgTable(
  'torrent_notification_log',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    imdbId: text('imdb_id').notNull(),
    releaseTitle: text('release_title'),
    notificationText: text('notification_text'),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
    success: boolean('success').default(true).notNull(),
  },
  (table) => ({
    imdbIdx: index('torrent_notification_log_imdb_idx').on(table.imdbId),
    sentAtIdx: index('torrent_notification_log_sent_at_idx').on(table.sentAt),
  })
);

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  animeList: many(userAnimeList),
  integrations: many(userIntegrations),
  sessions: many(userSessions),
  libraryEntries: many(userLibraryEntries),
  notifications: many(notifications),
  syncJobs: many(syncJobs),
  releaseWatchlist: many(releaseWatchlistEntries),
  torrentWatchlist: many(torrentWatchlist),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const userAnimeListRelations = relations(userAnimeList, ({ one }) => ({
  user: one(users, {
    fields: [userAnimeList.userId],
    references: [users.id],
  }),
}));

export const userIntegrationsRelations = relations(userIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [userIntegrations.userId],
    references: [users.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const animeCatalogRelations = relations(animeCatalog, ({ many }) => ({
  serviceIds: many(animeServiceIds),
  libraryEntries: many(userLibraryEntries),
  notifications: many(notifications),
  watchHistory: many(watchHistory),
  userLists: many(userLists),
}));

export const animeServiceIdsRelations = relations(animeServiceIds, ({ one }) => ({
  anime: one(animeCatalog, {
    fields: [animeServiceIds.animeId],
    references: [animeCatalog.id],
  }),
}));

export const userLibraryEntriesRelations = relations(userLibraryEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [userLibraryEntries.userId],
    references: [users.id],
  }),
  anime: one(animeCatalog, {
    fields: [userLibraryEntries.animeId],
    references: [animeCatalog.id],
  }),
  changes: many(userEntryChanges),
}));

export const userEntryChangesRelations = relations(userEntryChanges, ({ one }) => ({
  entry: one(userLibraryEntries, {
    fields: [userEntryChanges.libraryEntryId],
    references: [userLibraryEntries.id],
  }),
  user: one(users, {
    fields: [userEntryChanges.userId],
    references: [users.id],
  }),
}));

export const syncJobsRelations = relations(syncJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [syncJobs.userId],
    references: [users.id],
  }),
  attempts: many(syncJobAttempts),
}));

export const syncJobAttemptsRelations = relations(syncJobAttempts, ({ one }) => ({
  syncJob: one(syncJobs, {
    fields: [syncJobAttempts.syncJobId],
    references: [syncJobs.id],
  }),
}));

export const watchHistoryRelations = relations(watchHistory, ({ one }) => ({
  user: one(users, {
    fields: [watchHistory.userId],
    references: [users.id],
  }),
  anime: one(animeCatalog, {
    fields: [watchHistory.animeId],
    references: [animeCatalog.id],
  }),
}));

export const userListsRelations = relations(userLists, ({ one }) => ({
  user: one(users, {
    fields: [userLists.userId],
    references: [users.id],
  }),
  anime: one(animeCatalog, {
    fields: [userLists.animeId],
    references: [animeCatalog.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  anime: one(animeCatalog, {
    fields: [notifications.animeId],
    references: [animeCatalog.id],
  }),
}));

export const releaseWatchlistEntriesRelations = relations(releaseWatchlistEntries, ({ one }) => ({
  user: one(users, {
    fields: [releaseWatchlistEntries.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

export type UserAnimeList = typeof userAnimeList.$inferSelect;
export type NewUserAnimeList = typeof userAnimeList.$inferInsert;

export type UserIntegration = typeof userIntegrations.$inferSelect;
export type NewUserIntegration = typeof userIntegrations.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

export type AnimeCatalog = typeof animeCatalog.$inferSelect;
export type NewAnimeCatalog = typeof animeCatalog.$inferInsert;

export type AnimeServiceId = typeof animeServiceIds.$inferSelect;
export type NewAnimeServiceId = typeof animeServiceIds.$inferInsert;

export type UserLibraryEntry = typeof userLibraryEntries.$inferSelect;
export type NewUserLibraryEntry = typeof userLibraryEntries.$inferInsert;

export type UserEntryChange = typeof userEntryChanges.$inferSelect;
export type NewUserEntryChange = typeof userEntryChanges.$inferInsert;

export type SyncJob = typeof syncJobs.$inferSelect;
export type NewSyncJob = typeof syncJobs.$inferInsert;

export type SyncJobAttempt = typeof syncJobAttempts.$inferSelect;
export type NewSyncJobAttempt = typeof syncJobAttempts.$inferInsert;

export type WatchHistory = typeof watchHistory.$inferSelect;
export type NewWatchHistory = typeof watchHistory.$inferInsert;

export type UserList = typeof userLists.$inferSelect;
export type NewUserList = typeof userLists.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type MediaExternalId = typeof mediaExternalIds.$inferSelect;
export type NewMediaExternalId = typeof mediaExternalIds.$inferInsert;

export type ReleaseWatchlistEntry = typeof releaseWatchlistEntries.$inferSelect;
export type NewReleaseWatchlistEntry = typeof releaseWatchlistEntries.$inferInsert;

export type TorrentWatchlistEntry = typeof torrentWatchlist.$inferSelect;
export type NewTorrentWatchlistEntry = typeof torrentWatchlist.$inferInsert;

export type TorrentRelease = typeof torrentReleases.$inferSelect;
export type NewTorrentRelease = typeof torrentReleases.$inferInsert;

export type TorrentNotificationLog = typeof torrentNotificationLog.$inferSelect;
export type NewTorrentNotificationLog = typeof torrentNotificationLog.$inferInsert;
