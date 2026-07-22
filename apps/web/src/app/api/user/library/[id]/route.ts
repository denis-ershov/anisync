import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUserId } from '@/lib/api/auth';
import { LibraryService } from '@/lib/services/library-service';
import { SyncService } from '@/lib/services/sync-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { id } = await params;
  const entry = await LibraryService.getEntryById(userId, Number(id));
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const entryView = await LibraryService.mapLibraryEntry(entry);
  return NextResponse.json({ entry: entryView });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const entryId = Number(id);
    const body = await request.json();
    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const mappedEntry = await LibraryService.mapLibraryEntry(entry);
    if (!mappedEntry?.externalAnimeId) {
      return NextResponse.json({ error: 'Missing provider anime id' }, { status: 400 });
    }

    const payload = {
      externalAnimeId: mappedEntry.externalAnimeId,
      watchedEpisodes: body.watchedEpisodes,
      watchStatus: body.watchStatus,
      personalRating: body.personalRating,
      notes: body.notes,
      isFavorite: body.isFavorite,
      isNotInterested: body.isNotInterested,
    };

    const updatedEntry = await LibraryService.updateLocalEntry(userId, entryId, payload);
    if (!updatedEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const dispatched = await SyncService.dispatchEntrySync(entryId, request.nextUrl.origin);
    return NextResponse.json({
      entry: await LibraryService.mapLibraryEntry(updatedEntry),
      queued: true,
      dispatched,
    }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const entryId = Number(id);
    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    await LibraryService.requeueEntrySync(userId, entryId);
    const dispatched = await SyncService.dispatchEntrySync(entryId, request.nextUrl.origin);
    const refreshedEntry = await LibraryService.getEntryById(userId, entryId);

    return NextResponse.json({
      entry: refreshedEntry ? await LibraryService.mapLibraryEntry(refreshedEntry) : null,
      queued: true,
      dispatched,
    }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const entryId = Number(id);
    const entry = await LibraryService.getEntryById(userId, entryId);
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const providers = await SyncService.deleteEntryFromProviders(userId, entryId);
    const deleted = await LibraryService.deleteEntry(userId, entryId);
    if (!deleted) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, providers });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
