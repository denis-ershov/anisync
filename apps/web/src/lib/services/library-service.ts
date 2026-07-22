import { and, desc, eq, ilike, inArray, notInArray, or, sql } from 'drizzle-orm';
import {
  animeCatalog,
  animeServiceIds,
  db,
  notifications,
  userEntryChanges,
  userLibraryEntries,
  userLists,
  watchHistory,
  type AnimeCatalog,
  type UserLibraryEntry,
} from '@/lib/db';
import { SCHEDULE_IMPORT_STATUSES } from '@/lib/integrations/library-schedule-import';
import type { IntegrationServiceName, ProviderAnimeDetails, ProviderLibraryEntry, ProviderUpdatePayload } from '@/lib/integrations/provider-types';
import { applyLibraryFilters } from '@/lib/services/library-filters';
import type { LibraryEntryView, LibraryFilters } from '@/lib/services/library-types';
import { removeHtmlTags } from '@/lib/utils/text';

async function getLatestChangeStatusMap(entryIds: number[]) {
  if (!entryIds.length) {
    return new Map<number, 'pending' | 'processing' | 'synced' | 'failed' | 'local_only'>();
  }

  const changes = await db
    .select({
      libraryEntryId: userEntryChanges.libraryEntryId,
      status: userEntryChanges.status,
    })
    .from(userEntryChanges)
    .where(inArray(userEntryChanges.libraryEntryId, entryIds))
    .orderBy(desc(userEntryChanges.createdAt));

  const latestStatusMap = new Map<number, 'pending' | 'processing' | 'synced' | 'failed' | 'local_only'>();
  for (const change of changes) {
    if (!latestStatusMap.has(change.libraryEntryId)) {
      latestStatusMap.set(change.libraryEntryId, change.status);
    }
  }

  return latestStatusMap;
}

function toCatalogPayload(details: ProviderAnimeDetails) {
  return {
    malId: details.malId ?? null,
    titleDefault: details.titleDefault,
    titleEnglish: details.titleEnglish ?? null,
    titleJapanese: details.titleJapanese ?? null,
    titleRussian: details.titleRussian ?? null,
    licenseNameRu: details.licenseNameRu ?? null,
    synonyms: details.synonyms || [],
    kind: details.kind ?? null,
    rating: details.rating ?? null,
    score: details.score ?? null,
    status: details.status ?? null,
    episodes: details.episodes ?? null,
    episodesAired: details.episodesAired ?? null,
    duration: details.duration ?? null,
    airedOn: details.airedOn ?? null,
    releasedOn: details.releasedOn ?? null,
    season: details.season ?? null,
    url: details.url ?? null,
    coverImage: details.coverImage ?? null,
    nextEpisodeDate: details.nextEpisodeDate ?? null,
    isCensored: Boolean(details.isCensored),
    genres: details.genres || [],
    studios: details.studios || [],
    description: details.description ?? null,
    descriptionHtml: details.descriptionHtml ?? null,
    updatedAt: new Date(),
  };
}

async function findCatalogByServiceId(serviceName: IntegrationServiceName, externalAnimeId: string) {
  const [record] = await db
    .select({
      anime: animeCatalog,
    })
    .from(animeServiceIds)
    .innerJoin(animeCatalog, eq(animeServiceIds.animeId, animeCatalog.id))
    .where(and(eq(animeServiceIds.serviceName, serviceName), eq(animeServiceIds.externalAnimeId, externalAnimeId)));

  return record?.anime || null;
}

async function ensureServiceId(animeId: number, serviceName: IntegrationServiceName, externalAnimeId: string) {
  const [existing] = await db
    .select()
    .from(animeServiceIds)
    .where(and(eq(animeServiceIds.serviceName, serviceName), eq(animeServiceIds.externalAnimeId, externalAnimeId)));

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(animeServiceIds)
    .values({
      animeId,
      serviceName,
      externalAnimeId,
    })
    .returning();

  return created;
}

export class LibraryService {
  static async upsertCatalogEntry(serviceName: IntegrationServiceName, details: ProviderAnimeDetails): Promise<AnimeCatalog> {
    let catalogEntry: AnimeCatalog | null = null;

    if (details.malId) {
      const [byMalId] = await db.select().from(animeCatalog).where(eq(animeCatalog.malId, details.malId)).limit(1);
      catalogEntry = byMalId || null;
    }

    if (!catalogEntry) {
      catalogEntry = await findCatalogByServiceId(serviceName, details.externalAnimeId);
    }

    if (catalogEntry) {
      const [updated] = await db
        .update(animeCatalog)
        .set(toCatalogPayload(details))
        .where(eq(animeCatalog.id, catalogEntry.id))
        .returning();
      await ensureServiceId(updated.id, serviceName, details.externalAnimeId);
      return updated;
    }

    const [created] = await db
      .insert(animeCatalog)
      .values({
        ...toCatalogPayload(details),
        createdAt: new Date(),
      })
      .returning();

    await ensureServiceId(created.id, serviceName, details.externalAnimeId);
    return created;
  }

  static async upsertLibraryEntry(userId: number, serviceName: IntegrationServiceName, entry: ProviderLibraryEntry) {
    const catalogEntry = await this.upsertCatalogEntry(serviceName, entry);
    const [existing] = await db
      .select()
      .from(userLibraryEntries)
      .where(and(eq(userLibraryEntries.userId, userId), eq(userLibraryEntries.animeId, catalogEntry.id)))
      .limit(1);

    const payload = {
      sourceService: serviceName,
      sourceEntryId: entry.externalEntryId,
      watchStatus: entry.watchStatus,
      watchedEpisodes: entry.watchedEpisodes,
      totalEpisodesSnapshot: entry.episodes ?? null,
      personalRating: entry.personalRating ?? null,
      notes: entry.notes ?? null,
      notesSyncStatus: entry.notes ? 'synced' : 'local_only',
      outOfSync: false,
      isFavorite: Boolean(entry.isFavorite),
      isNotInterested: Boolean(entry.isNotInterested),
      lastProviderUpdateAt: entry.lastProviderUpdateAt ? new Date(entry.lastProviderUpdateAt) : null,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    } as const;

    if (existing) {
      const [updated] = await db
        .update(userLibraryEntries)
        .set(payload)
        .where(eq(userLibraryEntries.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(userLibraryEntries)
      .values({
        userId,
        animeId: catalogEntry.id,
        ...payload,
        createdAt: new Date(),
      })
      .returning();

    return created;
  }

  static async upsertLibraryEntries(
    userId: number,
    serviceName: IntegrationServiceName,
    entries: ProviderLibraryEntry[],
    batchSize: number = 10
  ) {
    if (!entries.length) {
      return [];
    }

    const externalAnimeIds = Array.from(new Set(entries.map((entry) => entry.externalAnimeId)));
    const malIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.malId)
          .filter((malId): malId is number => typeof malId === 'number')
      )
    );
    const serviceRecords = await db
      .select({
        externalAnimeId: animeServiceIds.externalAnimeId,
        anime: animeCatalog,
      })
      .from(animeServiceIds)
      .innerJoin(animeCatalog, eq(animeServiceIds.animeId, animeCatalog.id))
      .where(and(eq(animeServiceIds.serviceName, serviceName), inArray(animeServiceIds.externalAnimeId, externalAnimeIds)));
    const catalogByExternalId = new Map(serviceRecords.map((record) => [record.externalAnimeId, record.anime]));
    const catalogByMalId = new Map<number, AnimeCatalog>();

    if (malIds.length) {
      const catalogRecords = await db.select().from(animeCatalog).where(inArray(animeCatalog.malId, malIds));
      for (const catalogEntry of catalogRecords) {
        if (catalogEntry.malId) {
          catalogByMalId.set(catalogEntry.malId, catalogEntry);
        }
      }
    }

    const results: UserLibraryEntry[] = [];
    const shouldUpdateCatalog = (entry: ProviderLibraryEntry, matchedByExternalId: boolean) =>
      !matchedByExternalId || entry.watchStatus === 'watching' || entry.watchStatus === 'planned' || entry.watchStatus === 'rewatching';

    for (let index = 0; index < entries.length; index += batchSize) {
      const batch = entries.slice(index, index + batchSize);
      const libraryValues = await Promise.all(
        batch.map(async (entry) => {
          const matchedByExternalId = catalogByExternalId.has(entry.externalAnimeId);
          let catalogEntry = catalogByExternalId.get(entry.externalAnimeId) || (entry.malId ? catalogByMalId.get(entry.malId) : null);

          if (catalogEntry) {
            if (shouldUpdateCatalog(entry, matchedByExternalId)) {
              await db.update(animeCatalog).set(toCatalogPayload(entry)).where(eq(animeCatalog.id, catalogEntry.id));
            }
            await db
              .insert(animeServiceIds)
              .values({
                animeId: catalogEntry.id,
                serviceName,
                externalAnimeId: entry.externalAnimeId,
              })
              .onConflictDoNothing();
          } else {
            const [createdCatalogEntry] = await db
              .insert(animeCatalog)
              .values({
                ...toCatalogPayload(entry),
                createdAt: new Date(),
              })
              .returning();
            await db
              .insert(animeServiceIds)
              .values({
                animeId: createdCatalogEntry.id,
                serviceName,
                externalAnimeId: entry.externalAnimeId,
              })
              .onConflictDoNothing();
            catalogEntry = createdCatalogEntry;
          }

          catalogByExternalId.set(entry.externalAnimeId, catalogEntry);
          if (entry.malId) {
            catalogByMalId.set(entry.malId, catalogEntry);
          }

          const payload = {
            sourceService: serviceName,
            sourceEntryId: entry.externalEntryId,
            watchStatus: entry.watchStatus,
            watchedEpisodes: entry.watchedEpisodes,
            totalEpisodesSnapshot: entry.episodes ?? null,
            personalRating: entry.personalRating ?? null,
            notes: entry.notes ?? null,
            notesSyncStatus: entry.notes ? 'synced' : 'local_only',
            outOfSync: false,
            isFavorite: Boolean(entry.isFavorite),
            isNotInterested: Boolean(entry.isNotInterested),
            lastProviderUpdateAt: entry.lastProviderUpdateAt ? new Date(entry.lastProviderUpdateAt) : null,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          } as const;

          return {
            userId,
            animeId: catalogEntry.id,
            ...payload,
            createdAt: new Date(),
          };
        })
      );

      const upserted = await db
        .insert(userLibraryEntries)
        .values(libraryValues)
        .onConflictDoUpdate({
          target: [userLibraryEntries.userId, userLibraryEntries.animeId],
          set: {
            sourceService: sql`excluded.source_service`,
            sourceEntryId: sql`excluded.source_entry_id`,
            watchStatus: sql`excluded.watch_status`,
            watchedEpisodes: sql`excluded.watched_episodes`,
            totalEpisodesSnapshot: sql`excluded.total_episodes_snapshot`,
            personalRating: sql`excluded.personal_rating`,
            notes: sql`excluded.notes`,
            notesSyncStatus: sql`excluded.notes_sync_status`,
            outOfSync: sql`excluded.out_of_sync`,
            isFavorite: sql`excluded.is_favorite`,
            isNotInterested: sql`excluded.is_not_interested`,
            lastProviderUpdateAt: sql`excluded.last_provider_update_at`,
            lastSyncedAt: sql`excluded.last_synced_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .returning();
      results.push(...upserted);
    }

    return results;
  }

  /**
   * Оставляет в библиотеке пользователя только срез расписания:
   * удаляет completed/dropped/… и watching/planned вне текущего import.
   */
  static async pruneLibraryToScheduleSlice(userId: number, keepAnimeIds: number[]) {
    const junkStatuses = ['completed', 'on_hold', 'dropped', 'not_interested'] as const;
    await db
      .delete(userLibraryEntries)
      .where(
        and(eq(userLibraryEntries.userId, userId), inArray(userLibraryEntries.watchStatus, [...junkStatuses]))
      );

    const scheduleStatuses = [...SCHEDULE_IMPORT_STATUSES];
    if (!keepAnimeIds.length) {
      await db
        .delete(userLibraryEntries)
        .where(
          and(
            eq(userLibraryEntries.userId, userId),
            inArray(userLibraryEntries.watchStatus, scheduleStatuses)
          )
        );
      return;
    }

    await db
      .delete(userLibraryEntries)
      .where(
        and(
          eq(userLibraryEntries.userId, userId),
          inArray(userLibraryEntries.watchStatus, scheduleStatuses),
          notInArray(userLibraryEntries.animeId, keepAnimeIds)
        )
      );
  }

  static async mapLibraryEntry(entry: UserLibraryEntry): Promise<LibraryEntryView | null> {
    const [record] = await db
      .select({
        entry: userLibraryEntries,
        anime: animeCatalog,
        serviceId: animeServiceIds,
      })
      .from(userLibraryEntries)
      .innerJoin(animeCatalog, eq(userLibraryEntries.animeId, animeCatalog.id))
      .leftJoin(
        animeServiceIds,
        and(eq(animeServiceIds.animeId, animeCatalog.id), eq(animeServiceIds.serviceName, entry.sourceService))
      )
      .where(eq(userLibraryEntries.id, entry.id))
      .limit(1);

    if (!record) {
      return null;
    }

    const latestChangeStatusMap = await getLatestChangeStatusMap([record.entry.id]);

    return {
      id: record.entry.id,
      animeId: record.anime.id,
      sourceService: record.entry.sourceService as IntegrationServiceName,
      sourceEntryId: record.entry.sourceEntryId,
      externalAnimeId: record.serviceId?.externalAnimeId || null,
      malId: record.anime.malId ?? null,
      title: record.anime.titleRussian || record.anime.titleDefault,
      title_en: record.anime.titleEnglish,
      title_jp: record.anime.titleJapanese,
      license_name_ru: record.anime.licenseNameRu,
      synonyms: record.anime.synonyms || [],
      kind: record.anime.kind,
      rating: record.anime.rating,
      score: record.anime.score || 0,
      status: record.anime.status,
      episodes: record.anime.episodes || 0,
      episodes_aired: record.anime.episodesAired || 0,
      duration: record.anime.duration,
      aired_on: record.anime.airedOn,
      released_on: record.anime.releasedOn,
      season: record.anime.season,
      url: record.anime.url,
      cover_image: record.anime.coverImage || '',
      next_episode_date: record.anime.nextEpisodeDate || null,
      is_censored: record.anime.isCensored,
      genres: record.anime.genres || [],
      studios: record.anime.studios || [],
      description: removeHtmlTags(record.anime.descriptionHtml || record.anime.description || ''),
      description_html: record.anime.descriptionHtml,
      watched_episodes: record.entry.watchedEpisodes,
      watch_status: record.entry.watchStatus,
      personal_rating: record.entry.personalRating ?? null,
      user_rate_id: String(record.entry.id),
      source: record.entry.sourceService as IntegrationServiceName,
      user_notes: record.entry.notes || '',
      is_favorite: record.entry.isFavorite,
      is_not_interested: record.entry.isNotInterested,
      out_of_sync: record.entry.outOfSync,
      sync_state:
        latestChangeStatusMap.get(record.entry.id) ||
        (record.entry.notesSyncStatus === 'local_only' ? 'local_only' : 'synced'),
    };
  }

  static async listUserLibrary(userId: number, filters?: LibraryFilters): Promise<LibraryEntryView[]> {
    const whereClauses = [eq(userLibraryEntries.userId, userId)];

    if (filters?.status) {
      whereClauses.push(eq(userLibraryEntries.watchStatus, filters.status as any));
    }

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      whereClauses.push(
        or(
          ilike(animeCatalog.titleDefault, pattern),
          ilike(animeCatalog.titleEnglish, pattern),
          ilike(animeCatalog.titleJapanese, pattern),
          ilike(animeCatalog.titleRussian, pattern)
        )!
      );
    }

    const records = await db
      .select({
        entry: userLibraryEntries,
        anime: animeCatalog,
        serviceId: animeServiceIds,
      })
      .from(userLibraryEntries)
      .innerJoin(animeCatalog, eq(userLibraryEntries.animeId, animeCatalog.id))
      .leftJoin(
        animeServiceIds,
        and(eq(animeServiceIds.animeId, animeCatalog.id), eq(animeServiceIds.serviceName, userLibraryEntries.sourceService))
      )
      .where(and(...whereClauses))
      .orderBy(desc(userLibraryEntries.updatedAt));

    const latestChangeStatusMap = await getLatestChangeStatusMap(records.map((record) => record.entry.id));

    let mapped = records.map((record) => ({
      id: record.entry.id,
      animeId: record.anime.id,
      sourceService: record.entry.sourceService as IntegrationServiceName,
      sourceEntryId: record.entry.sourceEntryId,
      externalAnimeId: record.serviceId?.externalAnimeId || null,
      malId: record.anime.malId ?? null,
      title: record.anime.titleRussian || record.anime.titleDefault,
      title_en: record.anime.titleEnglish,
      title_jp: record.anime.titleJapanese,
      license_name_ru: record.anime.licenseNameRu,
      synonyms: record.anime.synonyms || [],
      kind: record.anime.kind,
      rating: record.anime.rating,
      score: record.anime.score || 0,
      status: record.anime.status,
      episodes: record.anime.episodes || 0,
      episodes_aired: record.anime.episodesAired || 0,
      duration: record.anime.duration,
      aired_on: record.anime.airedOn,
      released_on: record.anime.releasedOn,
      season: record.anime.season,
      url: record.anime.url,
      cover_image: record.anime.coverImage || '',
      next_episode_date: record.anime.nextEpisodeDate || null,
      is_censored: record.anime.isCensored,
      genres: record.anime.genres || [],
      studios: record.anime.studios || [],
      description: removeHtmlTags(record.anime.descriptionHtml || record.anime.description || ''),
      description_html: record.anime.descriptionHtml,
      watched_episodes: record.entry.watchedEpisodes,
      watch_status: record.entry.watchStatus,
      personal_rating: record.entry.personalRating ?? null,
      user_rate_id: String(record.entry.id),
      source: record.entry.sourceService as IntegrationServiceName,
      user_notes: record.entry.notes || '',
      is_favorite: record.entry.isFavorite,
      is_not_interested: record.entry.isNotInterested,
      out_of_sync: record.entry.outOfSync,
      sync_state:
        latestChangeStatusMap.get(record.entry.id) ||
        (record.entry.notesSyncStatus === 'local_only' ? 'local_only' : 'synced'),
    }));

    return applyLibraryFilters(mapped, filters);
  }

  static async getEntryById(userId: number, entryId: number) {
    const [entry] = await db
      .select()
      .from(userLibraryEntries)
      .where(and(eq(userLibraryEntries.id, entryId), eq(userLibraryEntries.userId, userId)))
      .limit(1);

    return entry || null;
  }

  static async updateLocalEntry(
    userId: number,
    entryId: number,
    changes: ProviderUpdatePayload,
    changeType: string = 'manual_update'
  ) {
    const entry = await this.getEntryById(userId, entryId);
    if (!entry) {
      return null;
    }

    const [updated] = await db
      .update(userLibraryEntries)
      .set({
        watchStatus: changes.watchStatus ?? entry.watchStatus,
        watchedEpisodes: changes.watchedEpisodes ?? entry.watchedEpisodes,
        personalRating: changes.personalRating === undefined ? entry.personalRating : changes.personalRating,
        notes: changes.notes === undefined ? entry.notes : changes.notes,
        notesSyncStatus: changes.notes === undefined ? entry.notesSyncStatus : 'pending',
        isFavorite: changes.isFavorite === undefined ? entry.isFavorite : Boolean(changes.isFavorite),
        isNotInterested: changes.isNotInterested === undefined ? entry.isNotInterested : Boolean(changes.isNotInterested),
        outOfSync: true,
        updatedAt: new Date(),
      })
      .where(eq(userLibraryEntries.id, entry.id))
      .returning();

    await db.insert(userEntryChanges).values({
      userId,
      libraryEntryId: updated.id,
      changeType,
      payload: changes as unknown as Record<string, unknown>,
      status: 'pending',
      createdAt: new Date(),
    });

    await db.insert(watchHistory).values({
      userId,
      animeId: updated.animeId,
      watchedEpisodes: updated.watchedEpisodes,
      watchStatus: updated.watchStatus,
      createdAt: new Date(),
    });

    return updated;
  }

  static async markEntrySynced(
    entryId: number,
    changes: Partial<UserLibraryEntry>,
    changeStatus: 'synced' | 'local_only' = 'synced'
  ) {
    const [updated] = await db
      .update(userLibraryEntries)
      .set({
        ...changes,
        outOfSync: false,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userLibraryEntries.id, entryId))
      .returning();

    await db
      .update(userEntryChanges)
      .set({
        status: changeStatus,
        syncedAt: new Date(),
      })
      .where(
        and(
          eq(userEntryChanges.libraryEntryId, entryId),
          inArray(userEntryChanges.status, ['pending', 'processing'])
        )
      );

    return updated;
  }

  static async markEntrySyncFailed(entryId: number, notesLocalOnly: boolean = false) {
    await db
      .update(userLibraryEntries)
      .set({
        outOfSync: true,
        notesSyncStatus: notesLocalOnly ? 'local_only' : 'failed',
        updatedAt: new Date(),
      })
      .where(eq(userLibraryEntries.id, entryId));

    await db
      .update(userEntryChanges)
      .set({
        status: notesLocalOnly ? 'local_only' : 'failed',
      })
      .where(
        and(
          eq(userEntryChanges.libraryEntryId, entryId),
          inArray(userEntryChanges.status, ['pending', 'processing'])
        )
      );
  }

  static async getProfileStats(userId: number) {
    const [counts] = await db
      .select({
        watched: sql<number>`count(*) filter (where ${userLibraryEntries.watchStatus} = 'completed')`,
        watching: sql<number>`count(*) filter (where ${userLibraryEntries.watchStatus} = 'watching')`,
        planned: sql<number>`count(*) filter (where ${userLibraryEntries.watchStatus} = 'planned')`,
        meanScore: sql<number>`coalesce(avg(${userLibraryEntries.personalRating}), 0)`,
      })
      .from(userLibraryEntries)
      .where(eq(userLibraryEntries.userId, userId));

    return {
      animeWatched: Number(counts?.watched || 0),
      animeWatching: Number(counts?.watching || 0),
      animePlanned: Number(counts?.planned || 0),
      meanScore: counts?.meanScore ? Number(Number(counts.meanScore).toFixed(1)) : null,
    };
  }

  static async createNotification(
    userId: number,
    payload: {
      animeId?: number;
      type: 'new_episode' | 'sync_failed' | 'sync_completed' | 'system';
      title: string;
      message: string;
      module?: 'anime' | 'releases' | 'torrents' | 'platform';
      channel?: 'in_app' | 'telegram' | 'email';
      data?: Record<string, unknown>;
    }
  ) {
    const { NotificationHubService } = await import('@/lib/services/notification-hub-service');
    return NotificationHubService.create({
      userId,
      animeId: payload.animeId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      module: payload.module,
      channel: payload.channel,
      payload: payload.data,
    });
  }

  static async listNotifications(
    userId: number,
    options?: { limit?: number; unreadOnly?: boolean }
  ) {
    const { NotificationHubService } = await import('@/lib/services/notification-hub-service');
    return NotificationHubService.listForUser(userId, options);
  }

  static async markNotificationsRead(userId: number, notificationIds?: number[]) {
    const { NotificationHubService } = await import('@/lib/services/notification-hub-service');
    return NotificationHubService.markRead(userId, notificationIds);
  }

  static async requeueEntrySync(userId: number, entryId: number) {
    const entry = await this.getEntryById(userId, entryId);
    if (!entry) {
      return null;
    }

    const [latestChange] = await db
      .select()
      .from(userEntryChanges)
      .where(and(eq(userEntryChanges.userId, userId), eq(userEntryChanges.libraryEntryId, entryId)))
      .orderBy(desc(userEntryChanges.createdAt))
      .limit(1);

    if (latestChange?.status === 'pending' || latestChange?.status === 'processing') {
      return latestChange;
    }

    if (latestChange && (latestChange.status === 'failed' || latestChange.status === 'local_only')) {
      const [updatedChange] = await db
        .update(userEntryChanges)
        .set({
          status: 'pending',
          syncedAt: null,
        })
        .where(eq(userEntryChanges.id, latestChange.id))
        .returning();

      await db
        .update(userLibraryEntries)
        .set({
          outOfSync: true,
          updatedAt: new Date(),
        })
        .where(eq(userLibraryEntries.id, entry.id));

      return updatedChange;
    }

    const [createdChange] = await db
      .insert(userEntryChanges)
      .values({
        userId,
        libraryEntryId: entry.id,
        changeType: 'retry_sync',
        payload: {},
        status: 'pending',
        createdAt: new Date(),
      })
      .returning();

    await db
      .update(userLibraryEntries)
      .set({
        outOfSync: true,
        updatedAt: new Date(),
      })
      .where(eq(userLibraryEntries.id, entry.id));

    return createdChange;
  }

  static async setListMembership(userId: number, animeId: number, listType: 'favorite' | 'not_interested', enabled: boolean) {
    const [existing] = await db
      .select()
      .from(userLists)
      .where(and(eq(userLists.userId, userId), eq(userLists.animeId, animeId), eq(userLists.listType, listType)))
      .limit(1);

    if (enabled && !existing) {
      await db.insert(userLists).values({
        userId,
        animeId,
        listType,
        createdAt: new Date(),
      });
    }

    if (!enabled && existing) {
      await db.delete(userLists).where(eq(userLists.id, existing.id));
    }
  }
}
