import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/api/auth';
import type { IntegrationServiceName } from '@/lib/integrations/provider-types';
import { SyncService } from '@/lib/services/sync-service';

const ALLOWED_SERVICES = new Set<IntegrationServiceName>(['shikimori', 'myanimelist', 'anilist']);

function parseService(value: string | null): IntegrationServiceName | undefined {
  if (!value) {
    return undefined;
  }
  if (!ALLOWED_SERVICES.has(value as IntegrationServiceName)) {
    return undefined;
  }
  return value as IntegrationServiceName;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    const serviceParam = searchParams.get('service');
    const service = parseService(serviceParam);
    if (serviceParam && !service) {
      return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
    }

    const limitRaw = Number(searchParams.get('limit') || 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    const { service: resolvedService, results } = await SyncService.searchAnime(user.id, q, service, limit);

    return NextResponse.json({
      service: resolvedService,
      results: results.map((item) => ({
        externalAnimeId: item.externalAnimeId,
        malId: item.malId ?? null,
        titleDefault: item.titleDefault,
        titleEnglish: item.titleEnglish ?? null,
        titleJapanese: item.titleJapanese ?? null,
        titleRussian: item.titleRussian ?? null,
        kind: item.kind ?? null,
        score: item.score ?? null,
        status: item.status ?? null,
        episodes: item.episodes ?? null,
        coverImage: item.coverImage ?? null,
        season: item.season ?? null,
        airedOn: item.airedOn ?? null,
      })),
      count: results.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message.includes('not connected') || message.includes('not configured') ? 400 : 500;
    return NextResponse.json({ error: 'Search failed', message }, { status });
  }
}
