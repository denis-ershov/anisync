import { NextRequest, NextResponse } from 'next/server';
import { IntegrationService } from '@/lib/services/integration-service';
import { UserService } from '@/lib/services/user-service';
import { cookies } from 'next/headers';

const INTEGRATION_CONFIGS = {
  shikimori: {
    clientId: process.env.SHIKIMORI_CLIENT_ID || '3XSvmaMpajLEUtlYh5ldVc-Rronfz86DBUBypPx01j4',
    clientSecret: process.env.SHIKIMORI_CLIENT_SECRET || '3kTUO082PD04yFZ9Fs1KsGgRGzjuFHXq-E36eZ3CEH0',
    tokenUrl: 'https://shikimori.one/oauth/token',
    apiUrl: 'https://shikimori.one/api',
  }
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    const baseUrl = new URL('/', request.url).origin;
    
    if (error) {
      return NextResponse.redirect(`${baseUrl}/ru/settings/integrations?error=authorization_denied`);
    }
    
    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/ru/settings/integrations?error=invalid_request`);
    }
    
    // Verify state
    const cookieStore = await cookies();
    const storedState = cookieStore.get('shikimori-oauth-state')?.value;
    
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${baseUrl}/ru/settings/integrations?error=state_mismatch`);
    }
    
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/ru/auth/shikimori/callback`;
    
    // Get auth token
    const tokenResponse = await fetch(INTEGRATION_CONFIGS.shikimori.tokenUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'AniSync',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: INTEGRATION_CONFIGS.shikimori.clientId,
        client_secret: INTEGRATION_CONFIGS.shikimori.clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${baseUrl}/ru/settings/integrations?error=token_exchange_failed`);
    }
    
    const tokenData = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch(`${INTEGRATION_CONFIGS.shikimori.apiUrl}/users/whoami`, {
      headers: {
        'User-Agent': 'AniSync',
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    if (!userResponse.ok) {
      console.error('User info fetch failed:', await userResponse.text());
      return NextResponse.redirect(`${baseUrl}/ru/settings/integrations?error=user_info_failed`);
    }
    
    const userData = await userResponse.json();
    
    // Get authenticated user
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.redirect(`${baseUrl}/ru/login`);
    }
    
    const decoded = UserService.verifyToken(token);
    if (!decoded) {
      return NextResponse.redirect(`${baseUrl}/ru/login`);
    }
    
    // Save or update integration
    const existingIntegration = IntegrationService.getIntegrationByUserAndService(
      decoded.userId,
      'shikimori'
    );
    
    const integrationData = {
      service_name: 'shikimori' as const,
      access_token: tokenData.access_token ?? null,
      refresh_token: tokenData.refresh_token ?? null,
      token_expires_at: tokenData.expires_in ? 
        new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : 
        null,
      username: userData.nickname ?? null,
      user_id_external: userData.id?.toString() ?? null,
      automatic_sync: false,
    };
    
    if (existingIntegration) {
      IntegrationService.updateIntegration(existingIntegration.id, integrationData);
    } else {
      IntegrationService.createIntegration(decoded.userId, integrationData);
    }
    
    // Clear OAuth state cookie
    const response = NextResponse.redirect(`${baseUrl}/ru/settings/integrations?success=connected`);
    response.cookies.delete('shikimori-oauth-state');
    
    return response;
  } catch (error) {
    console.error('Callback error:', error);
    const baseUrl = new URL('/', request.url).origin;
    return NextResponse.redirect(`${baseUrl}/ru/settings/integrations?error=callback_failed`);
  }
}
