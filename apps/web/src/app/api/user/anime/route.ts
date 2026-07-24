import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/api/auth';
import { SCHEDULE_IMPORT_STATUSES } from '@/lib/integrations/library-schedule-import';
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
    let refresh: { status: 'idle' | 'queued' | 'running'; stale: boolean; dispatched: boolean } = {
      status: 'idle',
      stale: false,
      dispatched: false,
    };

    if (!existingIds.length) {
      await SyncService.ensurePrimaryLibraryLoaded(user.id);
    } else {
      refresh = await SyncService.requestScheduleRefresh(user.id, {
        force,
        origin: request.nextUrl.origin,
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status') || undefined;
    const anime = await LibraryService.listUserLibrary(user.id, {
      search: searchParams.get('search') || undefined,
      status: statusFilter,
      // Расписание: только watching/planned/rewatching (не dropped/completed/on_hold).
      statuses: statusFilter ? undefined : [...SCHEDULE_IMPORT_STATUSES],
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

    const stale = refresh.stale || (await SyncService.isScheduleSliceStale(user.id));
    const liveStatus = await SyncService.getScheduleSyncStatus(user.id);
    const syncStatus =
      liveStatus !== 'idle' ? liveStatus : refresh.status !== 'idle' ? refresh.status : 'idle';

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
