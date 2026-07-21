import { and, asc, eq } from 'drizzle-orm';

import { db, releaseWatchlistEntries, type ReleaseContentType, type ReleaseWatchlistEntry, type ReleaseWatchlistStatus } from '@/lib/db';
import { isQueuesEnabled } from '@/lib/config';
import { enqueueReleaseWatchlistRefresh } from '@/lib/queue/queues';
import { ReleaseWatchlistRefreshService } from '@/lib/services/release-watchlist-refresh-service';

export type ReleaseWatchlistItemDto = {
  id: number;
  tmdbId: number;
  type: ReleaseContentType;
  title: string;
  titleRu: string | null;
  status: ReleaseWatchlistStatus;
  rating: number | null;
  popularity: number | null;
  posterPath: string | null;
  genre: string | null;
  genreRu: string | null;
  year: number | null;
  releaseDate: string | null;
  nextEpisodeSeason: number | null;
  nextEpisodeNumber: number | null;
  nextEpisodeDate: string | null;
  addedAt: string;
};

export type AddReleaseWatchlistInput = {
  tmdbId: number;
  type: ReleaseContentType;
  status: ReleaseWatchlistStatus;
  title: string;
  titleRu?: string | null;
  rating?: number | null;
  popularity?: number | null;
  posterPath?: string | null;
  genre?: string | null;
  genreRu?: string | null;
  year?: number | null;
  releaseDate?: string | null;
  nextEpisodeSeason?: number | null;
  nextEpisodeNumber?: number | null;
  nextEpisodeDate?: string | null;
};

function toDto(entry: ReleaseWatchlistEntry): ReleaseWatchlistItemDto {
  return {
    id: entry.id,
    tmdbId: entry.tmdbId,
    type: entry.type,
    title: entry.title,
    titleRu: entry.titleRu,
    status: entry.status,
    rating: entry.rating,
    popularity: entry.popularity,
    posterPath: entry.posterPath,
    genre: entry.genre,
    genreRu: entry.genreRu,
    year: entry.year,
    releaseDate: entry.releaseDate,
    nextEpisodeSeason: entry.nextEpisodeSeason,
    nextEpisodeNumber: entry.nextEpisodeNumber,
    nextEpisodeDate: entry.nextEpisodeDate,
    addedAt: entry.addedAt.toISOString(),
  };
}

export class ReleaseWatchlistService {
  static async listForUser(userId: number, _lang = 'en'): Promise<ReleaseWatchlistItemDto[]> {
    const items = await db
      .select()
      .from(releaseWatchlistEntries)
      .where(eq(releaseWatchlistEntries.userId, userId))
      .orderBy(asc(releaseWatchlistEntries.addedAt));

    void ReleaseWatchlistService.scheduleRefreshIfNeeded();

    return items.map(toDto);
  }

  static async scheduleRefreshIfNeeded() {
    if (!isQueuesEnabled()) {
      return;
    }

    const stale = await ReleaseWatchlistRefreshService.hasStaleShowSchedules();
    if (!stale) {
      return;
    }

    await enqueueReleaseWatchlistRefresh().catch(() => undefined);
  }

  static async getStats(userId: number) {
    const items = await db
      .select()
      .from(releaseWatchlistEntries)
      .where(eq(releaseWatchlistEntries.userId, userId));

    return {
      total: items.length,
      watching: items.filter((item) => item.status === 'watching').length,
      plan: items.filter((item) => item.status === 'plan').length,
      watched: items.filter((item) => item.status === 'watched').length,
      movies: items.filter((item) => item.type === 'movie').length,
      shows: items.filter((item) => item.type === 'show').length,
    };
  }

  static async add(userId: number, data: AddReleaseWatchlistInput) {
    const existing = await db
      .select()
      .from(releaseWatchlistEntries)
      .where(
        and(
          eq(releaseWatchlistEntries.userId, userId),
          eq(releaseWatchlistEntries.tmdbId, data.tmdbId),
          eq(releaseWatchlistEntries.type, data.type)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { conflict: true as const, item: null };
    }

    const [inserted] = await db
      .insert(releaseWatchlistEntries)
      .values({
        userId,
        tmdbId: data.tmdbId,
        type: data.type,
        status: data.status,
        title: data.title,
        titleRu: data.titleRu ?? null,
        rating: data.rating ?? null,
        popularity: data.popularity ?? null,
        posterPath: data.posterPath ?? null,
        genre: data.genre ?? null,
        genreRu: data.genreRu ?? null,
        year: data.year ?? null,
        releaseDate: data.releaseDate ?? null,
        nextEpisodeSeason: data.nextEpisodeSeason ?? null,
        nextEpisodeNumber: data.nextEpisodeNumber ?? null,
        nextEpisodeDate: data.nextEpisodeDate ?? null,
      })
      .returning();

    if (inserted?.type === 'show' && isQueuesEnabled()) {
      await enqueueReleaseWatchlistRefresh().catch(() => undefined);
    }

    return { conflict: false as const, item: inserted ? toDto(inserted) : null };
  }

  static async updateStatus(userId: number, id: number, status: ReleaseWatchlistStatus) {
    const [updated] = await db
      .update(releaseWatchlistEntries)
      .set({ status })
      .where(and(eq(releaseWatchlistEntries.id, id), eq(releaseWatchlistEntries.userId, userId)))
      .returning();

    return updated ? toDto(updated) : null;
  }

  static async remove(userId: number, id: number) {
    const deleted = await db
      .delete(releaseWatchlistEntries)
      .where(and(eq(releaseWatchlistEntries.id, id), eq(releaseWatchlistEntries.userId, userId)))
      .returning({ id: releaseWatchlistEntries.id });

    return deleted.length > 0;
  }
}
