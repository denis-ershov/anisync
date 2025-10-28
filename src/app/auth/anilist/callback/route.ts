import { NextRequest, NextResponse } from 'next/server';
import { IntegrationService } from '@/lib/services/integration-service';
import { UserService } from '@/lib/services/user-service';
import { cookies } from 'next/headers';

const INTEGRATION_CONFIGS = {
  anilist: {
    clientId: process.env.ANILIST_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.ANILIST_CLIENT_SECRET || 'your-client-secret',
    tokenUrl: 'https://anilist.co/api/v2/oauth/token',
    graphqlUrl: 'https://graphql.anilist.co',
  }
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    const baseUrl = new URL('/', request.url).origin;
    // Get locale from cookie or default to 'en'
    const cookieStore = await cookies();
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en';

    if (error) {
      console.error('AniList authorization error:', error, errorDescription);
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=authorization_denied&details=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=invalid_request`);
    }

    // Verify state
    const storedState = cookieStore.get('anilist-oauth-state')?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=state_mismatch`);
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/auth/anilist/callback`;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(INTEGRATION_CONFIGS.anilist.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: INTEGRATION_CONFIGS.anilist.clientId,
        client_secret: INTEGRATION_CONFIGS.anilist.clientSecret,
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info via GraphQL API
    const userQuery = `
      query {
        Viewer {
          id
          name
        }
      }
    `;

    const userResponse = await fetch(INTEGRATION_CONFIGS.anilist.graphqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: userQuery,
      }),
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('User info fetch failed:', errorText);
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=user_info_failed`);
    }

    const userData = await userResponse.json();
    const viewer = userData.data?.Viewer;

    if (!viewer) {
      console.error('No viewer data in response:', userData);
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=user_info_failed`);
    }

    // Get authenticated user
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(`${baseUrl}/${locale}/login`);
    }

    const decoded = UserService.verifyToken(token);
    if (!decoded) {
      return NextResponse.redirect(`${baseUrl}/${locale}/login`);
    }

    // Save or update integration
    const existingIntegration = IntegrationService.getIntegrationByUserAndService(
      decoded.userId,
      'anilist'
    );

    const integrationData = {
      service_name: 'anilist' as const,
      access_token: tokenData.access_token ?? null,
      refresh_token: tokenData.refresh_token ?? null,
      token_expires_at: tokenData.expires_in ?
        new Date(Date.now() + tokenData.expires_in * 1000).toISOString() :
        null,
      username: viewer.name ?? null,
      user_id_external: viewer.id?.toString() ?? null,
      automatic_sync: false,
    };

    if (existingIntegration) {
      IntegrationService.updateIntegration(existingIntegration.id, integrationData);
    } else {
      IntegrationService.createIntegration(decoded.userId, integrationData);
    }

    // Clear OAuth state cookie
    const response = NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?success=connected`);
    response.cookies.delete('anilist-oauth-state');

    return response;
  } catch (error) {
    console.error('Callback error:', error);
    const baseUrl = new URL('/', request.url).origin;
    const cookieStore = await cookies();
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en';
    return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=callback_failed`);
  }
}
