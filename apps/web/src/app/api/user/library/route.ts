import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/api/auth';
import type { IntegrationServiceName, LibraryStatus } from '@/lib/integrations/provider-types';
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

const ALLOWED_SERVICES = new Set<IntegrationServiceName>(['shikimori', 'myanimelist', 'anilist']);
const ALLOWED_STATUSES = new Set<LibraryStatus>([
  'watching',
  'planned',
  'completed',
  'on_hold',
  'dropped',
  'rewatching',
  'not_interested',
]);

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await SyncService.ensurePrimaryLibraryLoaded(user.id);

    const searchParams = request.nextUrl.searchParams;
    const entries = await LibraryService.listUserLibrary(user.id, {
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

    return NextResponse.json({ entries, count: entries.length });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const service = body.service as IntegrationServiceName | undefined;
    const externalAnimeId = body.externalAnimeId != null ? String(body.externalAnimeId) : '';
    const watchStatus = (body.watchStatus as LibraryStatus | undefined) ?? 'planned';
    const watchedEpisodes =
      typeof body.watchedEpisodes === 'number' && Number.isFinite(body.watchedEpisodes)
        ? Math.max(0, Math.floor(body.watchedEpisodes))
        : 0;

    if (!service || !ALLOWED_SERVICES.has(service)) {
      return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
    }
    if (!externalAnimeId.trim()) {
      return NextResponse.json({ error: 'externalAnimeId is required' }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(watchStatus)) {
      return NextResponse.json({ error: 'Invalid watchStatus' }, { status: 400 });
    }

    const result = await SyncService.addAnimeToLibrary(
      user.id,
      {
        service,
        externalAnimeId: externalAnimeId.trim(),
        watchStatus,
        watchedEpisodes,
      },
      request.nextUrl.origin
    );

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message.includes('not connected') || message.includes('not found') ? 400 : 500;
    return NextResponse.json({ error: 'Failed to add anime', message }, { status });
  }
}
