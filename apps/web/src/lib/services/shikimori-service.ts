import { getShikimoriApiUrl, getShikimoriGraphqlUrl, providerBaseUrls } from '@/lib/config';
import type { UserIntegration } from '../db/schema';

const SHIKIMORI_GRAPHQL_URL = getShikimoriGraphqlUrl();
const SHIKIMORI_API_URL = getShikimoriApiUrl('/api');

interface IncompleteDate {
  year?: number;
  month?: number;
  day?: number;
  date?: string;
}

export interface ShikimoriAnimeRate {
  id: string;
  anime: {
    id: string;
    malId?: number;
    name: string;
    russian?: string;
    licenseNameRu?: string;
    english?: string[];
    japanese?: string[];
    synonyms?: string[];
    kind?: string;
    rating?: string;
    score?: string;
    status?: string;
    episodes?: number;
    episodesAired?: number;
    duration?: number;
    airedOn?: IncompleteDate;
    releasedOn?: IncompleteDate;
    url?: string;
    season?: string;
    poster?: {
      id?: string;
      originalUrl?: string;
      mainUrl?: string;
    };
    nextEpisodeAt?: string;
    isCensored?: boolean;
    genres?: Array<{
      id: string;
      name: string;
      russian?: string;
      kind?: string;
    }>;
    studios?: Array<{
      id: string;
      name: string;
      imageUrl?: string;
    }>;
    description?: string;
    descriptionHtml?: string;
  };
  status?: string;
  score?: number;
  episodes?: number;
  createdAt: string;
}

export interface ShikimoriAnimeDetails {
  id: string;
  malId?: number;
  name: string;
  russian?: string;
  licenseNameRu?: string;
  english?: string[];
  japanese?: string[];
  synonyms?: string[];
  kind?: string;
  rating?: string;
  score?: string;
  status?: string;
  episodes?: number;
  episodesAired?: number;
  duration?: number;
  airedOn?: IncompleteDate;
  releasedOn?: IncompleteDate;
  url?: string;
  season?: string;
  poster?: {
    id?: string;
    originalUrl?: string;
    mainUrl?: string;
  };
  nextEpisodeAt?: string;
  isCensored?: boolean;
  genres?: Array<{
    id: string;
    name: string;
    russian?: string;
    kind?: string;
  }>;
  studios?: Array<{
    id: string;
    name: string;
    imageUrl?: string;
  }>;
  description?: string;
  descriptionHtml?: string;
}

export interface ShikimoriUserRatesResponse {
  data: {
    userRates: ShikimoriAnimeRate[];
  };
}

export class ShikimoriService {
  /**
   * Get user's anime list from Shikimori using GraphQL
   */
  static async getUserAnimeList(
    integration: UserIntegration,
    status: 'watching' | 'planned' | 'completed' | 'on_hold' | 'dropped' | 'rewatching' = 'watching',
    page: number = 1,
    limit: number = 50
  ): Promise<ShikimoriAnimeRate[]> {
    if (!integration.accessToken || !integration.userIdExternal) {
      throw new Error('Shikimori integration not properly configured');
    }

    // Map status to GraphQL enum format (lowercase, as Shikimori expects)
    // Shikimori GraphQL enum values are lowercase
    const statusMap: Record<string, string> = {
      'watching': 'watching',
      'planned': 'planned',
      'completed': 'completed',
      'on_hold': 'on_hold',
      'dropped': 'dropped',
      'rewatching': 'rewatching'
    };
    const graphqlStatus = statusMap[status] || 'watching';

    const query = `
      {
        userRates(
          page: ${page},
          limit: ${limit},
          userId: ${integration.userIdExternal},
          targetType: Anime,
          status: ${graphqlStatus}
        ) {
          id
          status
          score
          episodes
          createdAt
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
            airedOn {
              year
              month
              day
              date
            }
            releasedOn {
              year
              month
              day
              date
            }
            url
            season
            poster {
              id
              originalUrl
              mainUrl
            }
            nextEpisodeAt
            isCensored
            genres {
              id
              name
              russian
              kind
            }
            studios {
              id
              name
              imageUrl
            }
            description
            descriptionHtml
          }
        }
      }
    `;

    const response = await fetch(SHIKIMORI_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AniSync',
        'Authorization': `Bearer ${integration.accessToken}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shikimori GraphQL error:', errorText);
      throw new Error(`Failed to fetch anime list from Shikimori: ${response.status}`);
    }

    const data = await response.json();

    // Check for GraphQL errors
    if (data.errors) {
      console.error('Shikimori GraphQL errors:', data.errors);
      console.error('Query that failed:', query);
      throw new Error(`GraphQL error: ${data.errors[0]?.message || 'Unknown error'}`);
    }

    // Check if data structure is correct
    if (!data.data || !data.data.userRates) {
      console.error('Unexpected Shikimori response structure:', data);
      throw new Error('Invalid response structure from Shikimori');
    }

    return data.data.userRates;
  }

  /**
   * Get all watching anime for a user
   */
  static async getWatchingAnime(integration: UserIntegration): Promise<ShikimoriAnimeRate[]> {
    return this.getUserAnimeList(integration, 'watching', 1, 50);
  }

  /**
   * Get detailed information about anime by IDs
   */
  static async getAnimeDetails(
    animeIds: string[],
    accessToken?: string
  ): Promise<ShikimoriAnimeDetails[]> {
    const ids = animeIds.join(',');

    const query = `
      {
        animes(ids: "${ids}", limit: 50) {
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
          airedOn {
            year
            month
            day
            date
          }
          releasedOn {
            year
            month
            day
            date
          }
          url
          season
          poster {
            id
            originalUrl
            mainUrl
          }
          nextEpisodeAt
          isCensored
          genres {
            id
            name
            russian
            kind
          }
          studios {
            id
            name
            imageUrl
          }
          description
          descriptionHtml
        }
      }
    `;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AniSync',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(SHIKIMORI_GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shikimori GraphQL error:', errorText);
      throw new Error(`Failed to fetch anime details from Shikimori: ${response.status}`);
    }

    const data = await response.json();

    // Check for GraphQL errors
    if (data.errors) {
      console.error('Shikimori GraphQL errors:', data.errors);
      throw new Error(`GraphQL error: ${data.errors[0]?.message || 'Unknown error'}`);
    }

    // Check if data structure is correct
    if (!data.data || !data.data.animes) {
      console.error('Unexpected Shikimori response structure:', data);
      throw new Error('Invalid response structure from Shikimori');
    }

    return data.data.animes;
  }

  /**
   * Get user info from Shikimori
   */
  static async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch(`${SHIKIMORI_API_URL}/users/whoami`, {
      headers: {
        'User-Agent': 'AniSync',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info from Shikimori: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const formData = new FormData();
    formData.append('grant_type', 'refresh_token');
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    formData.append('refresh_token', refreshToken);

    const response = await fetch(new URL('/oauth/token', providerBaseUrls.shikimori).toString(), {
      method: 'POST',
      headers: {
        'User-Agent': 'AniSync',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Shikimori token: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Update user rate (episodes, score, status, etc.)
   */
  static async updateUserRate(
    integration: UserIntegration,
    userRateId: string,
    updates: {
      episodes?: number;
      status?: string;
      score?: number;
    }
  ): Promise<{ id: string; episodes: number; status: string; score: number }> {
    const body: Record<string, any> = {};

    if (updates.episodes !== undefined) body.episodes = updates.episodes;
    if (updates.status !== undefined) body.status = updates.status;
    if (updates.score !== undefined) body.score = updates.score;

    const response = await fetch(`${SHIKIMORI_API_URL}/v2/user_rates/${userRateId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AniSync',
        'Authorization': `Bearer ${integration.accessToken}`,
      },
      body: JSON.stringify({ user_rate: body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shikimori update user rate error:', errorText);
      throw new Error(`Failed to update user rate on Shikimori: ${response.status}`);
    }

    return response.json();
  }
}
