const TMDB_CONFIGURATION_URL = 'https://api.themoviedb.org/3/configuration';

export type TmdbHealthResult = {
  ok: boolean;
  configured: boolean;
  status: 'ok' | 'not_configured' | 'unreachable' | 'error';
  message?: string;
};

/** TMDB v4 Read Access Token (JWT) vs classic v3 api_key. */
function isTmdbBearerToken(apiKey: string) {
  return apiKey.startsWith('eyJ') || apiKey.split('.').length >= 3;
}

export async function checkTmdbHealth(apiKey?: string): Promise<TmdbHealthResult> {
  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      status: 'not_configured',
      message: 'TMDB_API_KEY is not set',
    };
  }

  try {
    const useBearer = isTmdbBearerToken(apiKey);
    const response = await fetch(
      useBearer
        ? TMDB_CONFIGURATION_URL
        : `${TMDB_CONFIGURATION_URL}?api_key=${encodeURIComponent(apiKey)}`,
      {
        headers: useBearer ? { Authorization: `Bearer ${apiKey}` } : undefined,
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        status: 'error',
        message: `TMDB responded with ${response.status}`,
      };
    }

    return {
      ok: true,
      configured: true,
      status: 'ok',
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      status: 'unreachable',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
