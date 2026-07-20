export type ProwlarrHealthResult = {
  ok: boolean;
  configured: boolean;
  status: 'ok' | 'not_configured' | 'unreachable' | 'error';
  url: string | null;
  message?: string;
};

export async function checkProwlarrHealth(
  baseUrl?: string,
  apiKey?: string
): Promise<ProwlarrHealthResult> {
  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      configured: false,
      status: 'not_configured',
      url: baseUrl ?? null,
      message: 'PROWLARR_URL / PROWLARR_API_KEY not set',
    };
  }

  const root = baseUrl.replace(/\/$/, '');

  try {
    const response = await fetch(
      `${root}/api/v1/system/status?apikey=${encodeURIComponent(apiKey)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5_000) }
    );

    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        status: 'error',
        url: root,
        message: `Prowlarr responded with ${response.status}`,
      };
    }

    return {
      ok: true,
      configured: true,
      status: 'ok',
      url: root,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      status: 'unreachable',
      url: root,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
