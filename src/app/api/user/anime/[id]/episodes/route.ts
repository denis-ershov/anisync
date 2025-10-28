import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user-service';
import { IntegrationService } from '@/lib/services/integration-service';
import { ShikimoriService } from '@/lib/services/shikimori-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
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

    const { id } = await context.params;
    const body = await request.json();
    const { episodes, status: watchStatus } = body;

    // Validate that at least one parameter is provided
    if (episodes === undefined && watchStatus === undefined) {
      return NextResponse.json(
        { error: 'Either episodes or status must be provided' },
        { status: 400 }
      );
    }

    // Validate episodes if provided
    if (episodes !== undefined && (typeof episodes !== 'number' || episodes < 0)) {
      return NextResponse.json(
        { error: 'Invalid episodes value' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (watchStatus !== undefined && typeof watchStatus !== 'string') {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
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

    // Build update object
    const updates: { episodes?: number; status?: string } = {};
    if (episodes !== undefined) updates.episodes = episodes;
    if (watchStatus !== undefined) updates.status = watchStatus;

    // Update data based on primary service
    let result;
    switch (primaryService) {
      case 'shikimori':
        result = await ShikimoriService.updateUserRate(integration, id, updates);
        break;

      case 'myanimelist':
        return NextResponse.json(
          { error: 'MyAnimeList not implemented yet' },
          { status: 501 }
        );

      case 'anilist':
        return NextResponse.json(
          { error: 'AniList not implemented yet' },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { error: 'Unsupported service' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      episodes: result.episodes,
      status: result.status,
    });

  } catch (error) {
    console.error('Update episodes error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
