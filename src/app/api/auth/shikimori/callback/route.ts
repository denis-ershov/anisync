
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=No-code-provided', req.url));
  }

  const clientId = process.env.SHIKIMORI_CLIENT_ID;
  const clientSecret = process.env.SHIKIMORI_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_SHIKIMORI_REDIRECT_URI;
  const userAgent = 'AniSync'; // As per Shikimori API docs

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('Shikimori environment variables are not set.');
    return NextResponse.redirect(new URL('/?error=Server-configuration-error', req.url));
  }

  const tokenUrl = 'https://shikimori.one/oauth/token';

  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('code', code);
  params.append('redirect_uri', redirectUri);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
      },
      body: params,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to fetch access token:', data);
      return NextResponse.redirect(new URL(`/?error=${data.error_description || 'Token-exchange-failed'}`, req.url));
    }

    const { access_token, refresh_token, expires_in } = data;

    cookies().set('shikimori_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expires_in,
      path: '/',
    });

    cookies().set('shikimori_refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return NextResponse.redirect(new URL('/dashboard', req.url));

  } catch (error) {
    console.error('Error during token exchange:', error);
    return NextResponse.redirect(new URL('/?error=Internal-server-error', req.url));
  }
}
