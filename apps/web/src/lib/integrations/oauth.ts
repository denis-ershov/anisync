import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { appConfig } from '@/lib/config';
import { getCanonicalCallbackUrl, getProvider } from '@/lib/integrations/providers';
import type { IntegrationServiceName } from '@/lib/integrations/provider-types';
import { IntegrationService } from '@/lib/services/integration-service';
import { SyncService } from '@/lib/services/sync-service';
import { UserSettingsService, UserService } from '@/lib/services/user-service';

export function generatePkce() {
  const codeVerifier = crypto.randomBytes(64).toString('base64url').slice(0, 128);
  return {
    codeVerifier,
    codeChallenge: codeVerifier,
  };
}

export async function buildAuthorizationUrl(serviceName: IntegrationServiceName, locale: string) {
  const provider = getProvider(serviceName);
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = getCanonicalCallbackUrl(serviceName);
  const response = NextResponse.json({
    authUrl: provider.getAuthorizationUrl({
      redirectUri,
      state,
      codeChallenge: serviceName === 'myanimelist' ? generatePkce().codeChallenge : undefined,
    }),
    state,
  });

  response.cookies.set(`${serviceName}-oauth-state`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
  });
  response.cookies.set('oauth-locale', locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
  });

  if (serviceName === 'myanimelist') {
    const { codeVerifier, codeChallenge } = generatePkce();
    response.cookies.set(`${serviceName}-code-verifier`, codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    });

    response.headers.set(
      'x-oauth-auth-url',
      provider.getAuthorizationUrl({
        redirectUri,
        state,
        codeChallenge,
      })
    );
  }

  return response;
}

export async function handleOAuthCallback(request: NextRequest, serviceName: IntegrationServiceName) {
  const provider = getProvider(serviceName);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const baseUrl = appConfig.appBaseUrl;
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || cookieStore.get('oauth-locale')?.value || 'en';

  if (error) {
    return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=authorization_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=invalid_request`);
  }

  const storedState = cookieStore.get(`${serviceName}-oauth-state`)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?error=state_mismatch`);
  }

  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    return NextResponse.redirect(`${baseUrl}/${locale}/login`);
  }

  const decoded = await UserService.verifySessionToken(token);
  if (!decoded) {
    return NextResponse.redirect(`${baseUrl}/${locale}/login`);
  }

  const codeVerifier = serviceName === 'myanimelist' ? cookieStore.get(`${serviceName}-code-verifier`)?.value : undefined;
  const tokenData = await provider.exchangeCode({
    code,
    redirectUri: getCanonicalCallbackUrl(serviceName),
    codeVerifier,
  });
  const viewer = await provider.fetchViewer(tokenData.accessToken);

  const existingIntegration = await IntegrationService.getIntegrationByUserAndService(decoded.userId, serviceName);
  const integrationData = {
    serviceName,
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken || undefined,
    tokenExpiresAt: tokenData.expiresAt || undefined,
    username: viewer.username,
    userIdExternal: viewer.id,
    automaticSync: false,
  };

  if (existingIntegration) {
    await IntegrationService.updateIntegration(existingIntegration.id, integrationData);
  } else {
    await IntegrationService.createIntegration(decoded.userId, integrationData);
  }

  const settings = await UserSettingsService.getUserSettings(decoded.userId);
  if (settings && !settings.primaryService) {
    await UserSettingsService.updateUserSettings(decoded.userId, {
      primaryService: serviceName,
    });
  }

  await SyncService.runPrimaryImport(decoded.userId, (settings?.primaryService || serviceName) as IntegrationServiceName);

  const response = NextResponse.redirect(`${baseUrl}/${locale}/settings/integrations?success=connected`);
  response.cookies.delete(`${serviceName}-oauth-state`);
  response.cookies.delete(`${serviceName}-code-verifier`);
  response.cookies.delete('oauth-locale');
  return response;
}
