import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/api/auth';
import { LibraryService } from '@/lib/services/library-service';
import { SyncService } from '@/lib/services/sync-service';

function parseNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseList(value: string | null) {
  if (!value) {
    return undefined;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!user.settings.primaryService) {
      return NextResponse.json(
        { error: 'No primary service configured', message: 'Please set a primary service in your settings' },
        { status: 400 }
      );
    }

    const force = request.nextUrl.searchParams.get('force') === '1';

    // Cold start: empty library must wait for first import.
    const existingIds = await LibraryService.getAnimeIdsForUserLibrary(user.id);
    if (!existingIds.length) {
      await SyncService.ensurePrimaryLibraryLoaded(user.id);
    } else {
      await SyncService.requestScheduleRefresh(user.id, {
        force,
        origin: request.nextUrl.origin,
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const anime = await LibraryService.listUserLibrary(user.id, {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      studio: searchParams.get('studio') || undefined,
      minRating: parseNumber(searchParams.get('minRating')),
      maxRating: parseNumber(searchParams.get('maxRating')),
      minYear: parseNumber(searchParams.get('minYear')),
      maxYear: parseNumber(searchParams.get('maxYear')),
      minEpisodes: parseNumber(searchParams.get('minEpisodes')),
      maxEpisodes: parseNumber(searchParams.get('maxEpisodes')),
      genres: parseList(searchParams.get('genres')),
      types: parseList(searchParams.get('types')),
    });

    const stale = await SyncService.isScheduleSliceStale(user.id);
    const syncStatus = await SyncService.getScheduleSyncStatus(user.id);

    return NextResponse.json({
      service: user.settings.primaryService,
      anime,
      count: anime.length,
      sync: {
        status: syncStatus,
        stale,
      },
    });
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
