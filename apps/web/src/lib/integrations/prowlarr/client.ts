import type { ProwlarrRelease } from '@/lib/torrents/watcher/identity';

export type ProwlarrDownloadArtifact = {
  magnet: string | null;
  torrentBytes: Uint8Array | null;
};

function rootUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, '');
}

export class ProwlarrClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  static fromEnv() {
    const baseUrl = process.env.PROWLARR_URL;
    const apiKey = process.env.PROWLARR_API_KEY;
    if (!baseUrl || !apiKey) {
      return null;
    }
    return new ProwlarrClient(baseUrl, apiKey);
  }

  async searchByImdb(imdbId: string): Promise<ProwlarrRelease[]> {
    const url = new URL(`${rootUrl(this.baseUrl)}/api/v1/search`);
    url.searchParams.set('imdbId', imdbId);
    url.searchParams.set('apikey', this.apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Prowlarr searchByImdb failed: ${response.status}`);
    }
    return (await response.json()) as ProwlarrRelease[];
  }

  async searchByQuery(query: string): Promise<ProwlarrRelease[]> {
    if (!query.trim()) {
      return [];
    }
    const url = new URL(`${rootUrl(this.baseUrl)}/api/v1/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('apikey', this.apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Prowlarr searchByQuery failed: ${response.status}`);
    }
    return (await response.json()) as ProwlarrRelease[];
  }

  async getDownloadLink(indexerId: number, guid: string): Promise<string | null> {
    const artifact = await this.getDownloadArtifact(indexerId, guid);
    return artifact.magnet;
  }

  async getDownloadArtifact(
    indexerId: number,
    guid: string
  ): Promise<ProwlarrDownloadArtifact> {
    const url = new URL(`${rootUrl(this.baseUrl)}/${indexerId}/download`);
    url.searchParams.set('guid', guid);
    url.searchParams.set('apikey', this.apiKey);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location');
      if (!location) return { magnet: null, torrentBytes: null };
      if (location.startsWith('magnet:')) {
        return { magnet: location, torrentBytes: null };
      }
      if (/^https?:\/\//i.test(location)) {
        const downloaded = await fetch(location, {
          signal: AbortSignal.timeout(30_000),
        });
        return this.readDownloadResponse(downloaded);
      }
      return { magnet: null, torrentBytes: null };
    }

    return this.readDownloadResponse(response);
  }

  private async readDownloadResponse(response: Response): Promise<ProwlarrDownloadArtifact> {
    if (!response.ok) return { magnet: null, torrentBytes: null };
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > 10 * 1024 * 1024) {
      throw new Error('Torrent download exceeds 10 MiB limit');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024) {
      throw new Error('Torrent download exceeds 10 MiB limit');
    }
    const text = new TextDecoder().decode(bytes);
    const magnetMatch = /magnet:\?[^\s<>"]+/i.exec(text);
    if (magnetMatch) {
      return { magnet: magnetMatch[0].trim(), torrentBytes: null };
    }
    return {
      magnet: null,
      torrentBytes: bytes[0] === 0x64 ? bytes : null,
    };
  }
}
