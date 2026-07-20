import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCanonicalCallbackUrl, getProvider } from '@/lib/integrations/providers';
import { generatePkce } from '@/lib/integrations/oauth';
import type { IntegrationServiceName } from '@/lib/integrations/provider-types';

function isService(value: string): value is IntegrationServiceName {
  return value === 'shikimori' || value === 'myanimelist' || value === 'anilist';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  try {
    const { service } = await params;
    if (!isService(service)) {
      return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
    }

    const locale = request.nextUrl.searchParams.get('locale') || 'en';
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = getCanonicalCallbackUrl(service);
    const provider = getProvider(service);

    let codeChallenge: string | undefined;
    let codeVerifier: string | undefined;
    if (service === 'myanimelist') {
      const pkce = generatePkce();
      codeChallenge = pkce.codeChallenge;
      codeVerifier = pkce.codeVerifier;
    }

    const authUrl = provider.getAuthorizationUrl({
      redirectUri,
      state,
      codeChallenge,
    });

    const response = NextResponse.json({ authUrl, state });

    if (service === 'myanimelist' && codeVerifier) {
      response.cookies.set(`${service}-code-verifier`, codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
      });
    }

    response.cookies.set(`${service}-oauth-state`, state, {
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

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
