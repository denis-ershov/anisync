import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user-service';
import { IntegrationService } from '@/lib/services/integration-service';
import { ShikimoriService } from '@/lib/services/shikimori-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token' },
        { status: 401 }
      );
    }

    const decoded = UserService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get user settings to find primary service
    const user = UserService.getUserWithSettings(decoded.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const primaryService = user.settings.primary_service;
    if (!primaryService) {
      return NextResponse.json(
        { error: 'No primary service configured' },
        { status: 400 }
      );
    }

    // Get integration for the primary service
    const integration = IntegrationService.getIntegrationByUserAndService(
      decoded.userId,
      primaryService
    );

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    let animeDetails: any;

    // Fetch anime details based on primary service
    switch (primaryService) {
      case 'shikimori':
        const shikimoriDetails = await ShikimoriService.getAnimeDetails(
          [id],
          integration.access_token || undefined
        );

        if (shikimoriDetails.length === 0) {
          return NextResponse.json(
            { error: 'Anime not found' },
            { status: 404 }
          );
        }

        const anime = shikimoriDetails[0];
        animeDetails = {
          id: anime.id,
          malId: anime.malId,
          title: anime.russian || anime.name,
          title_en: anime.name,
          title_jp: anime.japanese?.[0],
          synonyms: anime.synonyms,
          kind: anime.kind,
          rating: anime.rating,
          score: parseFloat(anime.score || '0'),
          status: anime.status,
          episodes: anime.episodes,
          episodes_aired: anime.episodesAired,
          duration: anime.duration,
          aired_on: anime.airedOn?.date,
          released_on: anime.releasedOn?.date,
          season: anime.season,
          cover_image: anime.poster?.originalUrl || anime.poster?.mainUrl || '',
          next_episode_at: anime.nextEpisodeAt,
          is_censored: anime.isCensored,
          genres: anime.genres?.map(g => ({
            id: g.id,
            name: g.russian || g.name,
            kind: g.kind,
          })),
          studios: anime.studios?.map(s => ({
            id: s.id,
            name: s.name,
            image: s.imageUrl,
          })),
          description: anime.description,
          description_html: anime.descriptionHtml,
          url: anime.url,
          source: 'shikimori',
        };
        break;

      case 'myanimelist':
        return NextResponse.json(
          { error: 'Not implemented', message: 'MyAnimeList support coming soon' },
          { status: 501 }
        );

      case 'anilist':
        return NextResponse.json(
          { error: 'Not implemented', message: 'AniList support coming soon' },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { error: 'Unsupported service' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      service: primaryService,
      anime: animeDetails,
    });

  } catch (error) {
    console.error('Get anime details error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
