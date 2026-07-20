import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { LibraryService } from '@/lib/services/library-service';
import { SyncService } from '@/lib/services/sync-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const entryId = Number(id);
    if (Number.isNaN(entryId)) {
      return NextResponse.json({ error: 'Invalid entry id' }, { status: 400 });
    }

    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const mappedEntry = await LibraryService.mapLibraryEntry(entry);
    if (!mappedEntry?.externalAnimeId) {
      return NextResponse.json({ error: 'Missing provider anime id' }, { status: 400 });
    }

    const updates = {
      externalAnimeId: mappedEntry.externalAnimeId,
      watchedEpisodes: body.episodes,
      watchStatus: body.status,
      personalRating: body.rating,
      notes: body.notes,
      isFavorite: body.isFavorite,
      isNotInterested: body.isNotInterested,
    };

    const updatedEntry = await LibraryService.updateLocalEntry(userId, entryId, updates);
    if (!updatedEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const dispatched = await SyncService.dispatchEntrySync(entryId, request.nextUrl.origin);
    const entryView = await LibraryService.mapLibraryEntry(updatedEntry);

    return NextResponse.json({
      success: true,
      entry: entryView,
      queued: true,
      dispatched,
    }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
