import { extractSeasonFromTitle } from '@/lib/torrents/watcher/parsers';
import type { ProwlarrRelease } from '@/lib/torrents/watcher/identity';

export const BAD_AUDIO_MARKERS = [
  '[звук с ts]',
  '[звук с ts ]',
  '[ звук с ts]',
  'звук с ts',
  '[звук с тс]',
  'звук с тс',
  'звук из зала',
  '[ад]',
  ' ad]',
  ' ad ',
  'ad]',
  'telecine',
  ' telesync',
  'telesync',
  ' ts audio',
  'ts audio',
  ' line audio',
  'line audio',
  ' cam audio',
  'cam audio',
  'camrip',
  'hdcam',
  'tsrip',
  'screener',
  ' dvdscr',
  'dvdscr',
  ' workprint',
] as const;

const COMMON_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'at',
  'и',
  'в',
  'на',
  'с',
  'для',
  'rip',
  'web',
  'bd',
  'dvd',
  'hd',
  'uhd',
  '4k',
  '1080p',
  '720p',
  '2160p',
  'h264',
  'h265',
  'hevc',
  'x264',
  'x265',
  'av1',
  'raw',
  'rus',
  'eng',
  'multi',
  'season',
  'seasons',
  'episode',
  'episodes',
  'сезон',
  'сезоны',
  'эп',
  'эпизод',
  'movie',
  'tv',
  'ova',
  'mv',
  'фильм',
  'сериал',
  'webrip',
  'web-dl',
  'webdl',
  'bdrip',
  'remux',
  'bluray',
  'blu-ray',
  'dvdrip',
  'uhdtv',
  'hdtv',
  'sdr',
  'hdr',
  'hdr10',
  'dolby',
  'vision',
  'profile',
  'bit',
  '10-bit',
  '8-bit',
  'dvo',
  'mvo',
  'avo',
  'amzn',
  'nf',
  'dv',
  'hybrid',
]);

function tokenize(value: string): string[] {
  const prepared = value
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2');
  return prepared.match(/[0-9a-zа-яё]+/gi) ?? [];
}

function titleTokens(value: string): string[] {
  return tokenize(value).filter(
    (token) =>
      !COMMON_WORDS.has(token) &&
      token.length > 1 &&
      !/^(19|20)\d{2}$/.test(token)
  );
}

function containsSequence(tokens: string[], sequence: string[]): boolean {
  if (!sequence.length || sequence.length > tokens.length) {
    return false;
  }
  for (let start = 0; start <= tokens.length - sequence.length; start += 1) {
    if (tokens.slice(start, start + sequence.length).join('\0') === sequence.join('\0')) {
      return true;
    }
  }
  return false;
}

function containsExactSegment(value: string, sequence: string[]): boolean {
  const segments = value.split(/\s*[\\/|]+\s*|\s+-\s+/);
  for (const segment of segments) {
    const cleanSegment = segment.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
    const tokens = titleTokens(cleanSegment);
    if (tokens.join('\0') === sequence.join('\0')) {
      return true;
    }
  }
  return false;
}

export function hasBadAudioMarkers(release: ProwlarrRelease): boolean {
  const title = String(release.title || '').toLowerCase();
  const description = String(
    release.description || release.overview || release.summary || ''
  ).toLowerCase();
  const text = `${title}\n${description}`;
  return BAD_AUDIO_MARKERS.some((marker) => text.includes(marker));
}

export function filterResultsBySeason(
  results: ProwlarrRelease[],
  targetSeason: number | null | undefined
): ProwlarrRelease[] {
  if (!results.length || !targetSeason) {
    return results;
  }

  return results.filter((release) => {
    const title = (release.title || '').toLowerCase();
    const foundSeasons = new Set<number>();

    for (const match of title.matchAll(/\bs\s*(\d{1,2})\s*-\s*s?\s*(\d{1,2})(?=[^\d]|$)/g)) {
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2], 10);
      if (start <= end) {
        for (let i = start; i <= end; i += 1) {
          foundSeasons.add(i);
        }
      }
    }

    for (const match of title.matchAll(
      /\b(?:сезон|сезона|сезоны|season|seasons)\s*(\d{1,2})\s*-\s*(\d{1,2})\b/g
    )) {
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2], 10);
      if (start <= end) {
        for (let i = start; i <= end; i += 1) {
          foundSeasons.add(i);
        }
      }
    }

    for (const match of title.matchAll(
      /\b(\d{1,2})\s*-\s*(\d{1,2})\s*(?:сезон|сезона|сезоны|season|seasons)\b/g
    )) {
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2], 10);
      if (start <= end) {
        for (let i = start; i <= end; i += 1) {
          foundSeasons.add(i);
        }
      }
    }

    for (const match of title.matchAll(/\bs\s*(\d{1,2})(?=[^\d]|$)/g)) {
      foundSeasons.add(Number.parseInt(match[1], 10));
    }
    for (const match of title.matchAll(
      /\b(?:сезон|сезона|сезоны|season|seasons)\s*(\d{1,2})\b/g
    )) {
      foundSeasons.add(Number.parseInt(match[1], 10));
    }
    for (const match of title.matchAll(
      /\b(\d{1,2})\s*(?:сезон|сезона|сезоны|season|seasons)\b/g
    )) {
      foundSeasons.add(Number.parseInt(match[1], 10));
    }

    return foundSeasons.size > 0 && foundSeasons.has(targetSeason);
  });
}

export function filterResultsByImdbOrTitle(
  results: ProwlarrRelease[],
  imdbId: string,
  title: string | null | undefined,
  originalTitle: string | null | undefined,
  year?: string | null,
  itemType?: string | null
): ProwlarrRelease[] {
  if (!results.length) {
    return results;
  }

  const aliases: string[][] = [];
  for (const value of [(originalTitle || '').toLowerCase().trim(), (title || '').toLowerCase().trim()]) {
    const tokens = titleTokens(value);
    if (tokens.length && !aliases.some((alias) => alias.join('\0') === tokens.join('\0'))) {
      aliases.push(tokens);
    }
  }

  if (!aliases.length) {
    return results;
  }

  return results.filter((release) => {
    const releaseTitle = (release.title || '').toLowerCase();
    const releaseImdb = release.imdbId || release.imdb_id || '';

    if (releaseImdb && imdbId) {
      const releaseImdbStr = String(releaseImdb).trim();
      const imdbIdStr = String(imdbId).trim();
      if (
        releaseImdbStr &&
        releaseImdbStr !== '0' &&
        releaseImdbStr.toLowerCase() === imdbIdStr.toLowerCase()
      ) {
        return true;
      }
    }

    const releaseTokens = titleTokens(releaseTitle);
    const releaseYears = new Set(releaseTitle.match(/\b(?:19|20)\d{2}\b/g) ?? []);

    const hasTitleMatch = aliases.some((alias) =>
      alias.length === 1
        ? containsExactSegment(releaseTitle, alias)
        : containsSequence(releaseTokens, alias)
    );
    if (!hasTitleMatch) {
      return false;
    }

    if (itemType === 'movie' && year) {
      return releaseYears.has(year);
    }
    if (year && releaseYears.size > 0) {
      return releaseYears.has(year);
    }
    return true;
  });
}

export function filterReleasesByPreferences(
  results: ProwlarrRelease[],
  preferredQuality?: string | null,
  preferredAudio?: string | null
): ProwlarrRelease[] {
  const qualityVariants: Record<string, string[]> = {
    '1080p': ['1080p', '1080', 'full hd', 'fhd'],
    '2160p SDR': ['2160p sdr', '2160 sdr', '4k sdr', 'uhd sdr', 'ultra hd sdr'],
    '2160p HDR': [
      '2160p hdr',
      '2160 hdr',
      '4k hdr',
      'uhd hdr',
      'ultra hd hdr',
      'hdr10',
      'hdr10+',
      'dolby vision',
    ],
    '720p': ['720p', '720', 'hd'],
    '480p': ['480p', '480', 'sd'],
  };

  return results.filter((release) => {
    if (hasBadAudioMarkers(release)) {
      return false;
    }

    const title = (release.title || '').toLowerCase();
    let qualityStr = '';
    if (release.quality && typeof release.quality === 'object') {
      qualityStr = String(release.quality.resolution || '').toLowerCase();
    } else if (release.quality) {
      qualityStr = String(release.quality).toLowerCase();
    }

    let qualityMatch = true;
    if (preferredQuality) {
      const qualityList = preferredQuality
        .split(',')
        .map((q) => q.trim().toLowerCase())
        .filter(Boolean);
      qualityMatch = false;

      for (const qualityPref of qualityList) {
        for (const [variantKey, variants] of Object.entries(qualityVariants)) {
          if (qualityPref.includes(variantKey.toLowerCase()) || variantKey.toLowerCase().includes(qualityPref)) {
            if (variants.some((variant) => qualityStr.includes(variant) || title.includes(variant))) {
              qualityMatch = true;
              break;
            }
          }
        }
        if (!qualityMatch) {
          qualityMatch = qualityPref.includes(qualityStr) || title.includes(qualityPref) || qualityStr.includes(qualityPref);
        }
        if (qualityMatch) {
          break;
        }
      }
    }

    let audioMatch = true;
    if (preferredAudio) {
      const audioLower = preferredAudio.trim().toLowerCase();
      const description = String(
        release.description || release.overview || release.summary || ''
      ).toLowerCase();
      const audioText = `${title}\n${description}`;

      const russianMarkers = ['rus', 'рус', 'дуб', 'dub', 'дубляж', 'многоголосый', 'проф. перевод', 'проф.перевод'];
      const originalSubMarkers = ['eng', 'english', 'original', 'оригинал', 'sub', 'subs', 'субтит'];

      if (audioLower === 'russian' || audioLower === 'rus') {
        audioMatch = russianMarkers.some((marker) => audioText.includes(marker));
      } else if (audioLower === 'original_sub' || audioLower === 'original' || audioLower === 'eng') {
        audioMatch = originalSubMarkers.some((marker) => audioText.includes(marker));
      } else if (audioLower === 'any' || audioLower === '*') {
        audioMatch = true;
      } else {
        audioMatch = audioText.includes(audioLower);
      }
    }

    return qualityMatch && audioMatch;
  });
}

export function buildSearchQueries(input: {
  imdbId: string;
  title?: string | null;
  originalTitle?: string | null;
  itemType?: string | null;
  year?: string | null;
  targetSeason?: number | null;
}): string[] {
  const titles: string[] = [];
  if (input.originalTitle?.trim()) {
    titles.push(input.originalTitle.trim());
  }
  if (input.title?.trim() && input.title.trim() !== (input.originalTitle || '').trim()) {
    titles.push(input.title.trim());
  }
  if (!titles.length && input.imdbId) {
    titles.push(input.imdbId.trim());
  }
  if (!titles.length) {
    return [];
  }

  let seasonNum = input.targetSeason ?? null;
  if (input.itemType === 'tv' && !seasonNum) {
    seasonNum =
      extractSeasonFromTitle(input.originalTitle) || extractSeasonFromTitle(input.title);
  }

  const queries: string[] = [];
  for (const baseTitle of titles) {
    if (input.itemType === 'tv' && seasonNum) {
      const seasonVariants = [`сезон ${seasonNum}`, `s${String(seasonNum).padStart(2, '0')}`, `season ${seasonNum}`];
      for (const sv of seasonVariants) {
        if (input.year) {
          queries.push(`${baseTitle} ${input.year} ${sv}`);
        }
        queries.push(`${baseTitle} ${sv}`);
      }
      queries.push(baseTitle);
    } else {
      if (input.year) {
        queries.push(`${baseTitle} ${input.year}`);
      }
      queries.push(baseTitle);
    }
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    const clean = query.split(/\s+/).join(' ');
    if (!seen.has(clean)) {
      seen.add(clean);
      unique.push(clean);
    }
  }
  return unique;
}
