import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Generate PKCE code verifier and challenge
// code_verifier must be between 43 and 128 characters
function generatePKCE() {
  // Generate 64 random bytes to ensure at least 85 characters after base64url encoding
  const codeVerifier = crypto.randomBytes(64).toString('base64url').slice(0, 128);
  const codeChallenge = codeVerifier; // Plain method for MyAnimeList
  return { codeVerifier, codeChallenge };
}

function getIntegrationConfig(service: string, locale: string = 'en') {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

  const configs = {
    myanimelist: {
      clientId: process.env.MYANIMELIST_CLIENT_ID || 'your-client-id',
      clientSecret: process.env.MYANIMELIST_CLIENT_SECRET || 'your-client-secret',
      // MyAnimeList doesn't support multiple redirect URIs, so we use without locale
      redirectUri: `${baseUrl}/auth/myanimelist/callback`,
      authUrl: 'https://myanimelist.net/v1/oauth2/authorize',
      tokenUrl: 'https://myanimelist.net/v1/oauth2/token',
      scope: 'read write'
    },
    anilist: {
      clientId: process.env.ANILIST_CLIENT_ID || 'your-client-id',
      clientSecret: process.env.ANILIST_CLIENT_SECRET || 'your-client-secret',
      // AniList doesn't support multiple redirect URIs, so we use without locale
      redirectUri: `${baseUrl}/auth/anilist/callback`,
      authUrl: 'https://anilist.co/api/v2/oauth/authorize',
      tokenUrl: 'https://anilist.co/api/v2/oauth/token',
      // AniList doesn't use scope parameter
      scope: '' as string | undefined
    },
    shikimori: {
      clientId: process.env.SHIKIMORI_CLIENT_ID || '3XSvmaMpajLEUtlYh5ldVc-Rronfz86DBUBypPx01j4',
      clientSecret: process.env.SHIKIMORI_CLIENT_SECRET || '3kTUO082PD04yFZ9Fs1KsGgRGzjuFHXq-E36eZ3CEH0',
      // Shikimori doesn't support multiple redirect URIs, so we use without locale
      redirectUri: `${baseUrl}/auth/shikimori/callback`,
      authUrl: 'https://shikimori.one/oauth/authorize',
      tokenUrl: 'https://shikimori.one/oauth/token',
      scope: 'user_rates'
    }
  };

  return configs[service as keyof typeof configs];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  try {
    const { service } = await params;

    // Get locale from query parameter or default to 'en'
    const locale = request.nextUrl.searchParams.get('locale') || 'en';

    // Get the configuration for the service with the locale
    const config = getIntegrationConfig(service, locale);

    if (!config) {
      return NextResponse.json(
        { error: 'Invalid service' },
        { status: 400 }
      );
    }
    
    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('state', state);

    // Only add scope if it's defined (AniList doesn't use scope parameter)
    if (config.scope) {
      authUrl.searchParams.set('scope', config.scope);
    }
    
    // For MyAnimeList, add PKCE parameters
    if (service === 'myanimelist') {
      const { codeVerifier, codeChallenge } = generatePKCE();
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'plain');
      
      // Store code verifier in cookie for later use in callback
      const response = NextResponse.json({
        authUrl: authUrl.toString(),
        state
      });
      
      response.cookies.set(`${service}-oauth-state`, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600 // 10 minutes
      });
      
      response.cookies.set(`${service}-code-verifier`, codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600 // 10 minutes
      });
      
      return response;
    }
    
    // For other services (AniList, Shikimori), use regular flow
    const response = NextResponse.json({
      authUrl: authUrl.toString(),
      state
    });
    
    response.cookies.set(`${service}-oauth-state`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    });
    
    return response;
  } catch (error) {
    console.error('Get auth URL error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
