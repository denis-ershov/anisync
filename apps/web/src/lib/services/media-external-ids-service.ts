import { and, eq } from 'drizzle-orm';

import { db, mediaExternalIds, type MediaExternalId, type MediaType } from '@/lib/db';

export type MediaExternalIdLookup = {
  mediaType?: MediaType;
  tmdbId?: string;
  imdbId?: string;
  malId?: number;
  anilistId?: number;
  shikimoriId?: string;
};

export class MediaExternalIdsService {
  static async findOne(filters: MediaExternalIdLookup): Promise<MediaExternalId | null> {
    const conditions = [];

    if (filters.mediaType) {
      conditions.push(eq(mediaExternalIds.mediaType, filters.mediaType));
    }
    if (filters.tmdbId) {
      conditions.push(eq(mediaExternalIds.tmdbId, filters.tmdbId));
    }
    if (filters.imdbId) {
      conditions.push(eq(mediaExternalIds.imdbId, filters.imdbId));
    }
    if (filters.malId !== undefined) {
      conditions.push(eq(mediaExternalIds.malId, filters.malId));
    }
    if (filters.anilistId !== undefined) {
      conditions.push(eq(mediaExternalIds.anilistId, filters.anilistId));
    }
    if (filters.shikimoriId) {
      conditions.push(eq(mediaExternalIds.shikimoriId, filters.shikimoriId));
    }

    if (conditions.length === 0) {
      return null;
    }

    const [row] = await db
      .select()
      .from(mediaExternalIds)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .limit(1);

    return row ?? null;
  }

  static async upsert(input: MediaExternalIdLookup & { mediaType: MediaType }) {
    const existing = await this.findOne(input);

    if (existing) {
      const [updated] = await db
        .update(mediaExternalIds)
        .set({
          tmdbId: input.tmdbId ?? existing.tmdbId,
          imdbId: input.imdbId ?? existing.imdbId,
          malId: input.malId ?? existing.malId,
          anilistId: input.anilistId ?? existing.anilistId,
          shikimoriId: input.shikimoriId ?? existing.shikimoriId,
        })
        .where(eq(mediaExternalIds.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(mediaExternalIds)
      .values({
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        imdbId: input.imdbId,
        malId: input.malId,
        anilistId: input.anilistId,
        shikimoriId: input.shikimoriId,
        createdAt: new Date(),
      })
      .returning();

    return created;
  }
}
