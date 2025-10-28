import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user-service';
import { IntegrationService } from '@/lib/services/integration-service';
import { ShikimoriService } from '@/lib/services/shikimori-service';
import { removeHtmlTags } from '@/lib/utils/text';

export async function GET(request: NextRequest) {
  try {
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
        { error: 'No primary service configured', message: 'Please set a primary service in your settings' },
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
        { error: 'Integration not found', message: `Please connect your ${primaryService} account first` },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (integration.token_expires_at) {
      const expiresAt = new Date(integration.token_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Token expired', message: 'Please reconnect your account' },
          { status: 401 }
        );
      }
    }

    let animeList: any[] = [];

    // Fetch anime list based on primary service
    switch (primaryService) {
      case 'shikimori':
        const shikimoriAnime = await ShikimoriService.getWatchingAnime(integration);
        animeList = shikimoriAnime.map(rate => ({
          id: rate.anime.id,
          malId: rate.anime.malId,
          title: rate.anime.russian || rate.anime.name,
          title_en: rate.anime.name,
          title_jp: rate.anime.japanese?.[0],
          license_name_ru: rate.anime.licenseNameRu,
          synonyms: rate.anime.synonyms,
          kind: rate.anime.kind,
          rating: rate.anime.rating,
          score: parseFloat(rate.anime.score || '0'),
          status: rate.anime.status || 'ongoing',
          episodes: rate.anime.episodes || 0,
          episodes_aired: rate.anime.episodesAired || 0,
          duration: rate.anime.duration,
          aired_on: rate.anime.airedOn?.date,
          released_on: rate.anime.releasedOn?.date,
          season: rate.anime.season,
          url: rate.anime.url,
          cover_image: rate.anime.poster?.originalUrl || rate.anime.poster?.mainUrl || '',
          next_episode_date: rate.anime.nextEpisodeAt || null,
          is_censored: rate.anime.isCensored,
          genres: rate.anime.genres?.map(g => ({
            id: g.id,
            name: g.russian || g.name,
            kind: g.kind,
          })) || [],
          studios: rate.anime.studios?.map(s => ({
            id: s.id,
            name: s.name,
            image: s.imageUrl,
          })) || [],
          description: removeHtmlTags(rate.anime.descriptionHtml || rate.anime.description || ''),
          description_html: rate.anime.descriptionHtml,
          description_source: rate.anime.description, // Keep original for reference
          // User specific data
          watched_episodes: rate.episodes || 0,
          watch_status: rate.status || 'watching',
          personal_rating: (rate.score && rate.score > 0) ? rate.score : null,
          user_rate_id: rate.id,
          source: 'shikimori',
        }));
        break;

      case 'myanimelist':
        // TODO: Implement MyAnimeList API
        return NextResponse.json(
          { error: 'Not implemented', message: 'MyAnimeList support coming soon' },
          { status: 501 }
        );

      case 'anilist':
        // TODO: Implement AniList API
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
      anime: animeList,
      count: animeList.length,
    });

  } catch (error) {
    console.error('Get user anime error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
