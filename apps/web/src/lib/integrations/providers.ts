import { env, getProviderCallbackUrl, getShikimoriApiUrl, getShikimoriGraphqlUrl, providerBaseUrls } from '@/lib/config';
import type { UserIntegration } from '@/lib/db/schema';
import {
  filterLibraryForScheduleImport,
  type FetchLibraryOptions,
} from '@/lib/integrations/library-schedule-import';
import type {
  IntegrationServiceName,
  LibraryStatus,
  OAuthExchangeParams,
  ProviderAdapter,
  ProviderAnimeDetails,
  ProviderLibraryEntry,
  ProviderTokenResponse,
  ProviderDeletePayload,
  ProviderUpdatePayload,
  ProviderUpdateResult,
  ProviderViewer,
} from './provider-types';
import {
  mapLibraryStatusToAniList,
  mapLibraryStatusToMal,
  normalizeAniListStatus,
  normalizeMalStatus,
  normalizeShikimoriDate,
  toIsoOrNull,
} from './provider-utils';

function resolveLibraryScope(options?: FetchLibraryOptions) {
  return options?.scope === 'full' ? 'full' : 'schedule';
}
function requireIntegrationToken(integration: UserIntegration) {
  if (!integration.accessToken) {
    throw new Error(`Missing access token for ${integration.serviceName}`);
  }

  return integration.accessToken;
}

function buildShikimoriHeaders(accessToken?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'AniSync',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function getPrimaryLocalizedTitle(value?: string | string[] | null) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

type ShikimoriRateResponse = {
  data?: {
    userRates: Array<{
      id: string;
      status: ProviderLibraryEntry['watchStatus'];
      score?: number;
      episodes?: number;
      updatedAt?: string;
        anime: {
          id: string;
          malId?: number;
          name: string;
          russian?: string;
          licenseNameRu?: string;
          english?: string | string[];
          japanese?: string | string[];
        synonyms?: string[];
        kind?: string;
        rating?: string;
        score?: string;
        status?: string;
        episodes?: number;
        episodesAired?: number;
        duration?: number;
        airedOn?: { date?: string | null };
        releasedOn?: { date?: string | null };
        url?: string;
        season?: string;
        poster?: { originalUrl?: string; mainUrl?: string };
        nextEpisodeAt?: string;
        isCensored?: boolean;
        genres?: Array<{ id: string; name: string; russian?: string; kind?: string }>;
        studios?: Array<{ id: string; name: string; imageUrl?: string }>;
        description?: string;
        descriptionHtml?: string;
      };
    }>;
  };
};

type ShikimoriRate = NonNullable<ShikimoriRateResponse['data']>['userRates'][number];

function mapShikimoriRate(rate: ShikimoriRate): ProviderLibraryEntry {
  return {
    externalEntryId: rate.id,
    externalAnimeId: rate.anime.id,
    malId: rate.anime.malId ?? null,
    titleDefault: rate.anime.name,
    titleEnglish: getPrimaryLocalizedTitle(rate.anime.english) || rate.anime.name,
    titleJapanese: getPrimaryLocalizedTitle(rate.anime.japanese),
    titleRussian: rate.anime.russian || null,
    licenseNameRu: rate.anime.licenseNameRu || null,
    synonyms: rate.anime.synonyms || [],
    kind: rate.anime.kind || null,
    rating: rate.anime.rating || null,
    score: rate.anime.score ? Number(rate.anime.score) : null,
    status: rate.anime.status || null,
    episodes: rate.anime.episodes ?? null,
    episodesAired: rate.anime.episodesAired ?? null,
    duration: rate.anime.duration ?? null,
    airedOn: normalizeShikimoriDate(rate.anime.airedOn),
    releasedOn: normalizeShikimoriDate(rate.anime.releasedOn),
    season: rate.anime.season || null,
    url: rate.anime.url || null,
    coverImage: rate.anime.poster?.originalUrl || rate.anime.poster?.mainUrl || null,
    nextEpisodeDate: rate.anime.nextEpisodeAt || null,
    isCensored: Boolean(rate.anime.isCensored),
    genres: (rate.anime.genres || []).map((genre: NonNullable<ShikimoriRate['anime']['genres']>[number]) => ({
      id: genre.id,
      name: genre.russian || genre.name,
      kind: genre.kind,
    })),
    studios: (rate.anime.studios || []).map((studio: NonNullable<ShikimoriRate['anime']['studios']>[number]) => ({
      id: studio.id,
      name: studio.name,
      image: studio.imageUrl,
    })),
    description: rate.anime.description || null,
    descriptionHtml: rate.anime.descriptionHtml || null,
    watchStatus: rate.status,
    watchedEpisodes: rate.episodes || 0,
    personalRating: rate.score ?? null,
    notes: null,
    isFavorite: false,
    isNotInterested: false,
    lastProviderUpdateAt: rate.updatedAt || null,
  };
}

async function fetchShikimoriUserRates(accessToken: string, userId: string, status: ProviderLibraryEntry['watchStatus'], page: number, limit: number) {
  const query = `
    {
      userRates(userId: ${userId}, targetType: Anime, status: ${status}, page: ${page}, limit: ${limit}) {
        id
        status
        score
        episodes
        updatedAt
        anime {
          id
          malId
          name
          russian
          licenseNameRu
          english
          japanese
          synonyms
          kind
          rating
          score
          status
          episodes
          episodesAired
          duration
          airedOn { date }
          releasedOn { date }
          url
          season
          poster { originalUrl mainUrl }
          nextEpisodeAt
          isCensored
          genres { id name russian kind }
          studios { id name imageUrl }
          description
          descriptionHtml
        }
      }
    }
  `;

  const response = await fetchJson<ShikimoriRateResponse>(getShikimoriGraphqlUrl(), {
    method: 'POST',
    headers: buildShikimoriHeaders(accessToken),
    body: JSON.stringify({ query }),
  });

  return response.data?.userRates || [];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SHIKIMORI_PAGE_DELAY_MS = 100;
const SHIKIMORI_STATUS_DELAY_MS = 100;

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }

    const dateValue = Date.parse(retryAfter);
    if (Number.isFinite(dateValue)) {
      return Math.max(dateValue - Date.now(), 0);
    }
  }

  return Math.min(1500 * 2 ** attempt, 10000);
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(input, init);
    if (response.ok) {
      return response.json() as Promise<T>;
    }

    if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < maxRetries) {
      await delay(getRetryDelayMs(response, attempt));
      continue;
    }

    const errorText = await response.text();
    throw new Error(`Request failed ${response.status}: ${errorText}`);
  }

  throw new Error('Request failed after retries');
}

/** DELETE/empty-body responses; treats 404 as already deleted. */
async function fetchVoid(input: string, init?: RequestInit): Promise<void> {
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(input, init);
    if (response.ok || response.status === 404) {
      await response.text().catch(() => undefined);
      return;
    }

    if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < maxRetries) {
      await delay(getRetryDelayMs(response, attempt));
      continue;
    }

    const errorText = await response.text();
    throw new Error(`Request failed ${response.status}: ${errorText}`);
  }

  throw new Error('Request failed after retries');
}

const shikimoriProvider: ProviderAdapter = {
  serviceName: 'shikimori',
  capabilities: {
    supportsNotes: false,
    supportsRating: true,
    supportsRefresh: true,
  },
  getAuthorizationUrl({ redirectUri, state }) {
    const url = new URL('/oauth/authorize', providerBaseUrls.shikimori);
    url.searchParams.set('client_id', env.SHIKIMORI_CLIENT_ID || '');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'user_rates');
    url.searchParams.set('state', state);
    return url.toString();
  },
  async exchangeCode({ code, redirectUri }: OAuthExchangeParams): Promise<ProviderTokenResponse> {
    const formData = new FormData();
    formData.append('grant_type', 'authorization_code');
    formData.append('client_id', env.SHIKIMORI_CLIENT_ID || '');
    formData.append('client_secret', env.SHIKIMORI_CLIENT_SECRET || '');
    formData.append('code', code);
    formData.append('redirect_uri', redirectUri);

    const tokenData = await fetchJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>(getShikimoriApiUrl('/oauth/token'), {
      method: 'POST',
      headers: {
        'User-Agent': 'AniSync',
      },
      body: formData,
    });

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
    };
  },
  async refreshToken(integration: UserIntegration): Promise<ProviderTokenResponse> {
    if (!integration.refreshToken) {
      throw new Error('Missing Shikimori refresh token');
    }

    const formData = new FormData();
    formData.append('grant_type', 'refresh_token');
    formData.append('client_id', env.SHIKIMORI_CLIENT_ID || '');
    formData.append('client_secret', env.SHIKIMORI_CLIENT_SECRET || '');
    formData.append('refresh_token', integration.refreshToken);

    const tokenData = await fetchJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>(getShikimoriApiUrl('/oauth/token'), {
      method: 'POST',
      headers: {
        'User-Agent': 'AniSync',
      },
      body: formData,
    });

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
    };
  },
  async fetchViewer(accessToken: string): Promise<ProviderViewer> {
    const data = await fetchJson<{ id: number; nickname: string }>(getShikimoriApiUrl('/api/users/whoami'), {
      headers: {
        'User-Agent': 'AniSync',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return {
      id: String(data.id),
      username: data.nickname,
    };
  },
  async fetchLibrary(
    integration: UserIntegration,
    options?: FetchLibraryOptions
  ): Promise<ProviderLibraryEntry[]> {
    const accessToken = requireIntegrationToken(integration);
    const userId = integration.userIdExternal;

    if (!userId) {
      throw new Error('Missing Shikimori external user id');
    }

    const scope = resolveLibraryScope(options);
    const statuses: LibraryStatus[] =
      scope === 'schedule'
        ? ['watching', 'planned', 'rewatching']
        : ['watching', 'planned', 'rewatching', 'completed', 'on_hold', 'dropped'];
    const pageSize = 50;
    const entries: ProviderLibraryEntry[] = [];

    for (const status of statuses) {
      let page = 1;

      while (true) {
        const rates = await fetchShikimoriUserRates(accessToken, userId, status, page, pageSize);
        entries.push(...rates.map(mapShikimoriRate));

        if (rates.length < pageSize) {
          break;
        }

        page += 1;
        await delay(SHIKIMORI_PAGE_DELAY_MS);
      }

      await delay(SHIKIMORI_STATUS_DELAY_MS);
    }

    return scope === 'schedule' ? filterLibraryForScheduleImport(entries) : entries;
  },
  async fetchAnimeDetails(integration: UserIntegration, externalAnimeIds: string[]): Promise<ProviderAnimeDetails[]> {
    const accessToken = requireIntegrationToken(integration);
    const ids = externalAnimeIds.join(',');
    const query = `
      {
        animes(ids: "${ids}", limit: ${externalAnimeIds.length}) {
          id
          malId
          name
          russian
          licenseNameRu
          english
          japanese
          synonyms
          kind
          rating
          score
          status
          episodes
          episodesAired
          duration
          airedOn { date }
          releasedOn { date }
          url
          season
          poster { originalUrl mainUrl }
          nextEpisodeAt
          isCensored
          genres { id name russian kind }
          studios { id name imageUrl }
          description
          descriptionHtml
        }
      }
    `;

    const response = await fetchJson<{
      data?: {
        animes: Array<any>;
      };
    }>(getShikimoriGraphqlUrl(), {
      method: 'POST',
      headers: buildShikimoriHeaders(accessToken),
      body: JSON.stringify({ query }),
    });

    return (response.data?.animes || []).map((anime) => ({
      externalAnimeId: anime.id,
      malId: anime.malId ?? null,
      titleDefault: anime.name,
      titleEnglish: getPrimaryLocalizedTitle(anime.english) || anime.name,
      titleJapanese: getPrimaryLocalizedTitle(anime.japanese),
      titleRussian: anime.russian || null,
      licenseNameRu: anime.licenseNameRu || null,
      synonyms: anime.synonyms || [],
      kind: anime.kind || null,
      rating: anime.rating || null,
      score: anime.score ? Number(anime.score) : null,
      status: anime.status || null,
      episodes: anime.episodes ?? null,
      episodesAired: anime.episodesAired ?? null,
      duration: anime.duration ?? null,
      airedOn: normalizeShikimoriDate(anime.airedOn),
      releasedOn: normalizeShikimoriDate(anime.releasedOn),
      season: anime.season || null,
      url: anime.url || null,
      coverImage: anime.poster?.originalUrl || anime.poster?.mainUrl || null,
      nextEpisodeDate: anime.nextEpisodeAt || null,
      isCensored: Boolean(anime.isCensored),
      genres: (anime.genres || []).map((genre: any) => ({
        id: genre.id,
        name: genre.russian || genre.name,
        kind: genre.kind,
      })),
      studios: (anime.studios || []).map((studio: any) => ({
        id: studio.id,
        name: studio.name,
        image: studio.imageUrl,
      })),
      description: anime.description || null,
      descriptionHtml: anime.descriptionHtml || null,
    }));
  },
  async updateEntry(integration: UserIntegration, payload: ProviderUpdatePayload): Promise<ProviderUpdateResult> {
    if (!payload.externalEntryId) {
      throw new Error('Shikimori updates require external entry id');
    }

    const body: Record<string, unknown> = {};
    if (payload.watchedEpisodes !== undefined) body.episodes = payload.watchedEpisodes;
    if (payload.watchStatus) body.status = payload.watchStatus;
    if (payload.personalRating !== undefined && payload.personalRating !== null) body.score = payload.personalRating;

    const result = await fetchJson<{ id: string; status: ProviderUpdateResult['watchStatus']; episodes: number; score?: number }>(
      getShikimoriApiUrl(`/api/v2/user_rates/${payload.externalEntryId}`),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AniSync',
          Authorization: `Bearer ${requireIntegrationToken(integration)}`,
        },
        body: JSON.stringify({ user_rate: body }),
      }
    );

    return {
      externalEntryId: result.id,
      watchStatus: result.status,
      watchedEpisodes: result.episodes,
      personalRating: result.score ?? payload.personalRating ?? null,
      notes: payload.notes ?? null,
    };
  },
  async deleteEntry(integration: UserIntegration, payload: ProviderDeletePayload): Promise<void> {
    if (!payload.externalEntryId) {
      throw new Error('Shikimori delete requires external entry id');
    }

    await fetchVoid(getShikimoriApiUrl(`/api/v2/user_rates/${payload.externalEntryId}`), {
      method: 'DELETE',
      headers: {
        'User-Agent': 'AniSync',
        Authorization: `Bearer ${requireIntegrationToken(integration)}`,
      },
    });
  },
};

const myAnimeListProvider: ProviderAdapter = {
  serviceName: 'myanimelist',
  capabilities: {
    supportsNotes: false,
    supportsRating: true,
    supportsRefresh: true,
  },
  getAuthorizationUrl({ redirectUri, state, codeChallenge }) {
    const url = new URL('/v1/oauth2/authorize', providerBaseUrls.myanimelist);
    url.searchParams.set('client_id', env.MYANIMELIST_CLIENT_ID || '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'plain');
    }
    return url.toString();
  },
  async exchangeCode({ code, redirectUri, codeVerifier }: OAuthExchangeParams): Promise<ProviderTokenResponse> {
    const tokenData = await fetchJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>(new URL('/v1/oauth2/token', providerBaseUrls.myanimelist).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.MYANIMELIST_CLIENT_ID || '',
        client_secret: env.MYANIMELIST_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier || '',
      }),
    });

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
    };
  },
  async refreshToken(integration: UserIntegration): Promise<ProviderTokenResponse> {
    if (!integration.refreshToken) {
      throw new Error('Missing MyAnimeList refresh token');
    }

    const tokenData = await fetchJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>(new URL('/v1/oauth2/token', providerBaseUrls.myanimelist).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.MYANIMELIST_CLIENT_ID || '',
        client_secret: env.MYANIMELIST_CLIENT_SECRET || '',
        grant_type: 'refresh_token',
        refresh_token: integration.refreshToken,
      }),
    });

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
    };
  },
  async fetchViewer(accessToken: string): Promise<ProviderViewer> {
    const viewer = await fetchJson<{ id: number; name: string }>(
      new URL('/v2/users/@me?fields=id,name', providerBaseUrls.myanimelistApi).toString(),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return {
      id: String(viewer.id),
      username: viewer.name,
    };
  },
  async fetchLibrary(
    integration: UserIntegration,
    options?: FetchLibraryOptions
  ): Promise<ProviderLibraryEntry[]> {
    const accessToken = requireIntegrationToken(integration);
    const scope = resolveLibraryScope(options);
    const statusParams =
      scope === 'schedule' ? (['watching', 'plan_to_watch'] as const) : ([null] as const);
    const entries: ProviderLibraryEntry[] = [];

    for (const status of statusParams) {
      let nextUrl: URL | null = new URL(
        '/v2/users/@me/animelist?fields=list_status,alternative_titles,media_type,num_episodes,mean,status,start_season,start_date,main_picture,synopsis,studios,genres,my_list_status',
        providerBaseUrls.myanimelistApi
      );
      nextUrl.searchParams.set('limit', '100');
      if (status) {
        nextUrl.searchParams.set('status', status);
      }

      while (nextUrl) {
        const response: {
          data: Array<{
            node: any;
            list_status: any;
          }>;
          paging?: { next?: string };
        } = await fetchJson(nextUrl.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        entries.push(
          ...response.data.map((entry: { node: any; list_status: any }) => ({
            externalEntryId: String(entry.node.id),
            externalAnimeId: String(entry.node.id),
            malId: entry.node.id,
            titleDefault: entry.node.title,
            titleEnglish: entry.node.alternative_titles?.en || entry.node.title,
            titleJapanese: entry.node.alternative_titles?.ja || null,
            titleRussian: null,
            licenseNameRu: null,
            synonyms: entry.node.alternative_titles?.synonyms || [],
            kind: entry.node.media_type || null,
            rating: null,
            score: entry.node.mean ?? null,
            status: entry.node.status || null,
            episodes: entry.node.num_episodes ?? null,
            episodesAired: null,
            duration: null,
            airedOn: entry.node.start_date || null,
            releasedOn: entry.node.start_date || null,
            season: entry.node.start_season
              ? `${entry.node.start_season.season}_${entry.node.start_season.year}`
              : null,
            url: `https://myanimelist.net/anime/${entry.node.id}`,
            coverImage: entry.node.main_picture?.large || entry.node.main_picture?.medium || null,
            nextEpisodeDate: null,
            isCensored: false,
            genres: (entry.node.genres || []).map((genre: any) => ({
              id: String(genre.id),
              name: genre.name,
            })),
            studios: (entry.node.studios || []).map((studio: any) => ({
              id: String(studio.id),
              name: studio.name,
            })),
            description: entry.node.synopsis || null,
            descriptionHtml: null,
            watchStatus: normalizeMalStatus(entry.list_status?.status),
            watchedEpisodes: entry.list_status?.num_episodes_watched || 0,
            personalRating: entry.list_status?.score ? Number(entry.list_status.score) : null,
            notes: null,
            isFavorite: false,
            isNotInterested: false,
            lastProviderUpdateAt: null,
          }))
        );

        nextUrl = response.paging?.next ? new URL(response.paging.next) : null;
      }
    }

    return scope === 'schedule' ? filterLibraryForScheduleImport(entries) : entries;
  },
  async fetchAnimeDetails(integration: UserIntegration, externalAnimeIds: string[]): Promise<ProviderAnimeDetails[]> {
    const accessToken = requireIntegrationToken(integration);
    const details = await Promise.all(
      externalAnimeIds.map(async (id) => {
        const anime = await fetchJson<any>(
          new URL(
            `/v2/anime/${id}?fields=alternative_titles,media_type,num_episodes,mean,status,start_season,start_date,main_picture,synopsis,studios,genres`,
            providerBaseUrls.myanimelistApi
          ).toString(),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        return {
          externalAnimeId: String(anime.id),
          malId: anime.id,
          titleDefault: anime.title,
          titleEnglish: anime.alternative_titles?.en || anime.title,
          titleJapanese: anime.alternative_titles?.ja || null,
          titleRussian: null,
          licenseNameRu: null,
          synonyms: anime.alternative_titles?.synonyms || [],
          kind: anime.media_type || null,
          rating: null,
          score: anime.mean ?? null,
          status: anime.status || null,
          episodes: anime.num_episodes ?? null,
          episodesAired: null,
          duration: null,
          airedOn: anime.start_date || null,
          releasedOn: anime.start_date || null,
          season: anime.start_season ? `${anime.start_season.season}_${anime.start_season.year}` : null,
          url: `https://myanimelist.net/anime/${anime.id}`,
          coverImage: anime.main_picture?.large || anime.main_picture?.medium || null,
          nextEpisodeDate: null,
          isCensored: false,
          genres: (anime.genres || []).map((genre: any) => ({
            id: String(genre.id),
            name: genre.name,
          })),
          studios: (anime.studios || []).map((studio: any) => ({
            id: String(studio.id),
            name: studio.name,
          })),
          description: anime.synopsis || null,
          descriptionHtml: null,
        };
      })
    );

    return details;
  },
  async updateEntry(integration: UserIntegration, payload: ProviderUpdatePayload): Promise<ProviderUpdateResult> {
    const body = new URLSearchParams();
    if (payload.watchStatus) {
      const status = mapLibraryStatusToMal(payload.watchStatus);
      if (status) {
        body.append('status', status);
      }
    }
    if (payload.watchedEpisodes !== undefined) {
      body.append('num_watched_episodes', String(payload.watchedEpisodes));
    }
    if (payload.personalRating !== undefined && payload.personalRating !== null) {
      body.append('score', String(Math.round(payload.personalRating)));
    }

    await fetchJson<any>(
      new URL(`/v2/anime/${payload.externalAnimeId}/my_list_status`, providerBaseUrls.myanimelistApi).toString(),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${requireIntegrationToken(integration)}`,
        },
        body,
      }
    );

    return {
      externalEntryId: payload.externalAnimeId,
      watchStatus: payload.watchStatus,
      watchedEpisodes: payload.watchedEpisodes,
      personalRating: payload.personalRating ?? null,
      notes: payload.notes ?? null,
    };
  },
  async deleteEntry(integration: UserIntegration, payload: ProviderDeletePayload): Promise<void> {
    if (!payload.externalAnimeId) {
      throw new Error('MyAnimeList delete requires external anime id');
    }

    await fetchVoid(
      new URL(`/v2/anime/${payload.externalAnimeId}/my_list_status`, providerBaseUrls.myanimelistApi).toString(),
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${requireIntegrationToken(integration)}`,
        },
      }
    );
  },
};

const aniListViewerQuery = `
  query {
    Viewer {
      id
      name
    }
  }
`;

const aniListProvider: ProviderAdapter = {
  serviceName: 'anilist',
  capabilities: {
    supportsNotes: true,
    supportsRating: true,
    supportsRefresh: false,
  },
  getAuthorizationUrl({ redirectUri, state }) {
    const url = new URL('/api/v2/oauth/authorize', providerBaseUrls.anilist);
    url.searchParams.set('client_id', env.ANILIST_CLIENT_ID || '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  },
  async exchangeCode({ code, redirectUri }: OAuthExchangeParams): Promise<ProviderTokenResponse> {
    const tokenData = await fetchJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>(new URL('/api/v2/oauth/token', providerBaseUrls.anilist).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: env.ANILIST_CLIENT_ID || '',
        client_secret: env.ANILIST_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        code,
      }),
    });

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
    };
  },
  async fetchViewer(accessToken: string): Promise<ProviderViewer> {
    const viewerResponse = await fetchJson<{ data?: { Viewer?: { id: number; name: string } } }>(
      providerBaseUrls.anilistGraphql.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: aniListViewerQuery }),
      }
    );

    const viewer = viewerResponse.data?.Viewer;
    if (!viewer) {
      throw new Error('AniList viewer response is missing');
    }

    return {
      id: String(viewer.id),
      username: viewer.name,
    };
  },
  async fetchLibrary(
    integration: UserIntegration,
    options?: FetchLibraryOptions
  ): Promise<ProviderLibraryEntry[]> {
    const accessToken = requireIntegrationToken(integration);
    const scope = resolveLibraryScope(options);
    const query = `
      query ($userId: Int, $statusIn: [MediaListStatus]) {
        MediaListCollection(userId: $userId, type: ANIME, status_in: $statusIn) {
          lists {
            entries {
              id
              status
              progress
              score
              notes
              updatedAt
              media {
                id
                idMal
                title { romaji english native }
                synonyms
                format
                averageScore
                status
                episodes
                duration
                season
                seasonYear
                startDate { year month day }
                coverImage { extraLarge large medium }
                nextAiringEpisode { airingAt }
                genres
                studios(isMain: true) {
                  nodes { id name }
                }
                description(asHtml: false)
                descriptionHtml: description(asHtml: true)
                isAdult
              }
            }
          }
        }
      }
    `;

    const response = await fetchJson<{ data?: { MediaListCollection?: { lists?: Array<{ entries?: any[] }> } } }>(
      providerBaseUrls.anilistGraphql.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query,
          variables: {
            userId: integration.userIdExternal ? Number(integration.userIdExternal) : undefined,
            statusIn:
              scope === 'schedule'
                ? ['CURRENT', 'PLANNING', 'REPEATING']
                : ['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED', 'REPEATING'],
          },
        }),
      }
    );

    const entries = response.data?.MediaListCollection?.lists?.flatMap((list) => list.entries || []) || [];

    const mapped: ProviderLibraryEntry[] = entries.map((entry) => ({
      externalEntryId: String(entry.id),
      externalAnimeId: String(entry.media.id),
      malId: entry.media.idMal ?? null,
      titleDefault: entry.media.title?.romaji || entry.media.title?.english || entry.media.title?.native || String(entry.media.id),
      titleEnglish: entry.media.title?.english || entry.media.title?.romaji || null,
      titleJapanese: entry.media.title?.native || null,
      titleRussian: null,
      licenseNameRu: null,
      synonyms: entry.media.synonyms || [],
      kind: entry.media.format || null,
      rating: null,
      score: entry.media.averageScore ? Number(entry.media.averageScore) / 10 : null,
      status: entry.media.status || null,
      episodes: entry.media.episodes ?? null,
      episodesAired: null,
      duration: entry.media.duration ?? null,
      airedOn: entry.media.startDate?.year
        ? `${entry.media.startDate.year}-${String(entry.media.startDate.month || 1).padStart(2, '0')}-${String(entry.media.startDate.day || 1).padStart(2, '0')}`
        : null,
      releasedOn: entry.media.startDate?.year
        ? `${entry.media.startDate.year}-${String(entry.media.startDate.month || 1).padStart(2, '0')}-${String(entry.media.startDate.day || 1).padStart(2, '0')}`
        : null,
      season: entry.media.season && entry.media.seasonYear ? `${entry.media.season.toLowerCase()}_${entry.media.seasonYear}` : null,
      url: `https://anilist.co/anime/${entry.media.id}`,
      coverImage: entry.media.coverImage?.extraLarge || entry.media.coverImage?.large || entry.media.coverImage?.medium || null,
      nextEpisodeDate: toIsoOrNull(entry.media.nextAiringEpisode?.airingAt),
      isCensored: Boolean(entry.media.isAdult),
      genres: (entry.media.genres || []).map((genre: string, index: number) => ({
        id: String(index + 1),
        name: genre,
      })),
      studios: (entry.media.studios?.nodes || []).map((studio: any) => ({
        id: String(studio.id),
        name: studio.name,
      })),
      description: entry.media.description || null,
      descriptionHtml: entry.media.descriptionHtml || null,
      watchStatus: normalizeAniListStatus(entry.status),
      watchedEpisodes: entry.progress || 0,
      personalRating: entry.score ? Number(entry.score) / 10 : null,
      notes: entry.notes || null,
      isFavorite: false,
      isNotInterested: false,
      lastProviderUpdateAt: toIsoOrNull(entry.updatedAt),
    }));

    return scope === 'schedule' ? filterLibraryForScheduleImport(mapped) : mapped;
  },
  async fetchAnimeDetails(integration: UserIntegration, externalAnimeIds: string[]): Promise<ProviderAnimeDetails[]> {
    requireIntegrationToken(integration);
    const query = `
      query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id
            idMal
            title { romaji english native }
            synonyms
            format
            averageScore
            status
            episodes
            duration
            season
            seasonYear
            startDate { year month day }
            coverImage { extraLarge large medium }
            nextAiringEpisode { airingAt }
            genres
            studios(isMain: true) {
              nodes { id name }
            }
            description(asHtml: false)
            descriptionHtml: description(asHtml: true)
            isAdult
          }
        }
      }
    `;

    const response = await fetchJson<{ data?: { Page?: { media?: any[] } } }>(providerBaseUrls.anilistGraphql.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireIntegrationToken(integration)}`,
      },
      body: JSON.stringify({
        query,
        variables: {
          ids: externalAnimeIds.map((id) => Number(id)),
        },
      }),
    });

    return (response.data?.Page?.media || []).map((media) => ({
      externalAnimeId: String(media.id),
      malId: media.idMal ?? null,
      titleDefault: media.title?.romaji || media.title?.english || media.title?.native || String(media.id),
      titleEnglish: media.title?.english || media.title?.romaji || null,
      titleJapanese: media.title?.native || null,
      titleRussian: null,
      licenseNameRu: null,
      synonyms: media.synonyms || [],
      kind: media.format || null,
      rating: null,
      score: media.averageScore ? Number(media.averageScore) / 10 : null,
      status: media.status || null,
      episodes: media.episodes ?? null,
      episodesAired: null,
      duration: media.duration ?? null,
      airedOn: media.startDate?.year
        ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-${String(media.startDate.day || 1).padStart(2, '0')}`
        : null,
      releasedOn: media.startDate?.year
        ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-${String(media.startDate.day || 1).padStart(2, '0')}`
        : null,
      season: media.season && media.seasonYear ? `${media.season.toLowerCase()}_${media.seasonYear}` : null,
      url: `https://anilist.co/anime/${media.id}`,
      coverImage: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null,
      nextEpisodeDate: toIsoOrNull(media.nextAiringEpisode?.airingAt),
      isCensored: Boolean(media.isAdult),
      genres: (media.genres || []).map((genre: string, index: number) => ({
        id: String(index + 1),
        name: genre,
      })),
      studios: (media.studios?.nodes || []).map((studio: any) => ({
        id: String(studio.id),
        name: studio.name,
      })),
      description: media.description || null,
      descriptionHtml: media.descriptionHtml || null,
    }));
  },
  async updateEntry(integration: UserIntegration, payload: ProviderUpdatePayload): Promise<ProviderUpdateResult> {
    const mutation = `
      mutation ($id: Int, $mediaId: Int, $status: MediaListStatus, $progress: Int, $scoreRaw: Int, $notes: String) {
        SaveMediaListEntry(id: $id, mediaId: $mediaId, status: $status, progress: $progress, scoreRaw: $scoreRaw, notes: $notes) {
          id
          status
          progress
          score
          notes
        }
      }
    `;

    const response = await fetchJson<{ data?: { SaveMediaListEntry?: any } }>(providerBaseUrls.anilistGraphql.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireIntegrationToken(integration)}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          id: payload.externalEntryId ? Number(payload.externalEntryId) : undefined,
          mediaId: Number(payload.externalAnimeId),
          status: mapLibraryStatusToAniList(payload.watchStatus),
          progress: payload.watchedEpisodes,
          scoreRaw: payload.personalRating !== undefined && payload.personalRating !== null
            ? Math.round(payload.personalRating * 10)
            : undefined,
          notes: payload.notes,
        },
      }),
    });

    const result = response.data?.SaveMediaListEntry;
    if (!result) {
      throw new Error('AniList update failed');
    }

    return {
      externalEntryId: String(result.id),
      watchStatus: normalizeAniListStatus(result.status),
      watchedEpisodes: result.progress ?? payload.watchedEpisodes,
      personalRating: result.score ? Number(result.score) / 10 : payload.personalRating ?? null,
      notes: result.notes ?? payload.notes ?? null,
    };
  },
  async deleteEntry(integration: UserIntegration, payload: ProviderDeletePayload): Promise<void> {
    let entryId = payload.externalEntryId ? Number(payload.externalEntryId) : null;

    if (!entryId && payload.externalAnimeId) {
      if (!integration.userIdExternal) {
        throw new Error('AniList delete requires entry id or linked user id');
      }

      const lookup = await fetchJson<{ data?: { MediaList?: { id: number } | null } }>(
        providerBaseUrls.anilistGraphql.toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${requireIntegrationToken(integration)}`,
          },
          body: JSON.stringify({
            query: `
              query ($mediaId: Int, $userId: Int) {
                MediaList(mediaId: $mediaId, userId: $userId) {
                  id
                }
              }
            `,
            variables: {
              mediaId: Number(payload.externalAnimeId),
              userId: Number(integration.userIdExternal),
            },
          }),
        }
      );

      entryId = lookup.data?.MediaList?.id ?? null;
    }

    if (!entryId) {
      // Already absent on AniList
      return;
    }

    const response = await fetchJson<{ data?: { DeleteMediaListEntry?: { deleted?: boolean } } }>(
      providerBaseUrls.anilistGraphql.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requireIntegrationToken(integration)}`,
        },
        body: JSON.stringify({
          query: `
            mutation ($id: Int) {
              DeleteMediaListEntry(id: $id) {
                deleted
              }
            }
          `,
          variables: { id: entryId },
        }),
      }
    );

    if (!response.data?.DeleteMediaListEntry?.deleted) {
      throw new Error('AniList delete failed');
    }
  },
};

export const providerRegistry: Record<IntegrationServiceName, ProviderAdapter> = {
  shikimori: shikimoriProvider,
  myanimelist: myAnimeListProvider,
  anilist: aniListProvider,
};

export function getProvider(serviceName: IntegrationServiceName) {
  return providerRegistry[serviceName];
}

export function getCanonicalCallbackUrl(serviceName: IntegrationServiceName) {
  return getProviderCallbackUrl(serviceName);
}
