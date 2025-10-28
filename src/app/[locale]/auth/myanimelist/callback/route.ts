import { NextRequest, NextResponse } from 'next/server';
import { IntegrationService } from '@/lib/services/integration-service';
import { UserService } from '@/lib/services/user-service';
import { cookies } from 'next/headers';

const INTEGRATION_CONFIGS = {
  myanimelist: {
    clientId: process.env.MYANIMELIST_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.MYANIMELIST_CLIENT_SECRET || 'your-client-secret',
    tokenUrl: 'https://myanimelist.net/v1/oauth2/token',
    apiUrl: 'https://api.myanimelist.net/v2',
  }
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const baseUrl = new URL('/', request.url).origin;
    // Extract locale from the current URL path
    const locale = request.nextUrl.pathname.split('/')[1] || 'en';

    if (error) {
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=authorization_denied`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=invalid_request`);
    }

    // Verify state
    const cookieStore = await cookies();
    const storedState = cookieStore.get('myanimelist-oauth-state')?.value;
    const codeVerifier = cookieStore.get('myanimelist-code-verifier')?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=state_mismatch`);
    }

    if (!codeVerifier) {
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=missing_code_verifier`);
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/${locale}/auth/myanimelist/callback`;
    
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(INTEGRATION_CONFIGS.myanimelist.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: INTEGRATION_CONFIGS.myanimelist.clientId,
        client_secret: INTEGRATION_CONFIGS.myanimelist.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch(`${INTEGRATION_CONFIGS.myanimelist.apiUrl}/users/@me?fields=id,name`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('User info fetch failed:', await userResponse.text());
      return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=user_info_failed`);
    }

    const userData = await userResponse.json();

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
      'myanimelist'
    );
    
    const integrationData = {
      service_name: 'myanimelist' as const,
      access_token: tokenData.access_token ?? null,
      refresh_token: tokenData.refresh_token ?? null,
      token_expires_at: tokenData.expires_in ? 
        new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : 
        null,
      username: userData.name ?? null,
      user_id_external: userData.id?.toString() ?? null,
      automatic_sync: false,
    };
    
    if (existingIntegration) {
      IntegrationService.updateIntegration(existingIntegration.id, integrationData);
    } else {
      IntegrationService.createIntegration(decoded.userId, integrationData);
    }
    
    // Clear OAuth state cookie
    const response = NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?success=connected`);
    response.cookies.delete('myanimelist-oauth-state');
    response.cookies.delete('myanimelist-code-verifier');

    return response;
  } catch (error) {
    console.error('Callback error:', error);
    const baseUrl = new URL('/', request.url).origin;
    const locale = request.nextUrl.pathname.split('/')[1] || 'en';
    return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=callback_failed`);
  }
}
