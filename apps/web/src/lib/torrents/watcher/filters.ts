import { extractSeasonFromTitle } from '@/lib/torrents/watcher/parsers';
import type { ProwlarrRelease } from '@/lib/torrents/watcher/identity';

/** Маркеры плохого звука / источника (substring, как в NightWatcher). */
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

/**
 * Низкокачественные источники (CAM / TS / HDTS / TC / Screener и т.п.).
 * Word-boundary / separator-aware, чтобы не резать WEB-DL, DTS, HDTV.
 */
export const BAD_SOURCE_PATTERNS: RegExp[] = [
  /\bhd[\s.\-_]?ts\b/i,
  /\bhd[\s.\-_]?cam\b/i,
  /\bcam[\s.\-_]?rip\b/i,
  /\bts[\s.\-_]?rip\b/i,
  /\btc[\s.\-_]?rip\b/i,
  /\btelesync\b/i,
  /\btele[\s.\-_]?sync\b/i,
  /\btelecine\b/i,
  /\btele[\s.\-_]?cine\b/i,
  /\bdvd[\s.\-_]?scr(?:eener)?\b/i,
  /\bscreener\b/i,
  /\bwork[\s.\-_]?print\b/i,
  /\bvhs[\s.\-_]?rip\b/i,
  /\bppv[\s.\-_]?rip\b/i,
  /\bweb[\s.\-_]?cam\b/i,
  /\br[56]\b/i,
  /\bcam\b/i,
  /(?:^|[^a-zа-яё0-9])ts(?:$|[^a-zа-яё0-9])/i,
  /(?:^|[^a-zа-яё0-9])тс(?:$|[^a-zа-яё0-9])/i,
  /(?:^|[^a-zа-яё0-9])tc(?:$|[^a-zа-яё0-9])/i,
  /\bэкранк/i,
  /\bкамерн/i,
];

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

function releaseJunkText(release: ProwlarrRelease): string {
  const title = String(release.title || '');
  const description = String(
    release.description || release.overview || release.summary || ''
  );
  return `${title}\n${description}`.toLowerCase();
}

/** Плохой звук или низкокачественный источник (CAM / TS / HDTS / Screener…). */
export function hasJunkReleaseMarkers(release: ProwlarrRelease): boolean {
  const text = releaseJunkText(release);
  if (BAD_AUDIO_MARKERS.some((marker) => text.includes(marker))) {
    return true;
  }
  return BAD_SOURCE_PATTERNS.some((pattern) => pattern.test(text));
}

/** @deprecated используйте hasJunkReleaseMarkers */
export function hasBadAudioMarkers(release: ProwlarrRelease): boolean {
  return hasJunkReleaseMarkers(release);
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

function normalizeYear(year: string | null | undefined): string | null {
  if (year == null || String(year).trim() === '') {
    return null;
  }
  const match = String(year).trim().match(/\b((?:19|20)\d{2})\b/);
  return match?.[1] ?? null;
}

function extractReleaseYears(title: string): Set<string> {
  return new Set(title.match(/\b(?:19|20)\d{2}\b/g) ?? []);
}

function yearMatchesRelease(
  itemYear: string | null | undefined,
  releaseTitle: string,
  options?: { requireYearInTitle?: boolean }
): boolean {
  const year = normalizeYear(itemYear);
  if (!year) {
    return true;
  }
  const releaseYears = extractReleaseYears(releaseTitle);
  if (releaseYears.size > 0) {
    return releaseYears.has(year);
  }
  // Для фильмов без года в названии title-match ненадёжен.
  return options?.requireYearInTitle ? false : true;
}

const SUBTITLE_ONLY_PATTERNS: RegExp[] = [
  /(?:^|[^a-zа-яё0-9])ст(?:$|[^a-zа-яё0-9])/i,
  /(?:^|[^a-zа-яё0-9])стр(?:$|[^a-zа-яё0-9])/i,
  /(?:^|[^a-zа-яё0-9])subs?(?:$|[^a-zа-яё0-9])/i,
  /субтит/i,
  /soft[\s.\-_]?sub/i,
  /hard[\s.\-_]?sub/i,
  /sub[\s.\-_]?only/i,
  /только\s+субтитр/i,
];

const RUSSIAN_VOICE_PATTERNS: RegExp[] = [
  /(?:^|[^a-zа-яё0-9])(?:avo|dvo|mvo|hvdvo|3vo)(?:$|[^a-zа-яё0-9])/i,
  /дубляж/i,
  /озвуч/i,
  /закадр/i,
  /многоголосый/i,
  /проф\.?\s*перевод/i,
  /русск(?:ая|ий|ое|ие|ую)?\s*(?:озвуч|дорож|дуб)/i,
  /(?:^|[^a-zа-яё0-9])(?:rus|рус)(?:$|[^a-zа-яё0-9])/i,
];

function isSubtitleOnlyRelease(text: string): boolean {
  return SUBTITLE_ONLY_PATTERNS.some((pattern) => pattern.test(text));
}

function hasRussianVoiceTrack(text: string): boolean {
  return RUSSIAN_VOICE_PATTERNS.some((pattern) => pattern.test(text));
}

export function matchesPreferredAudio(
  release: ProwlarrRelease,
  preferredAudio: string | null | undefined
): boolean {
  if (!preferredAudio) {
    return true;
  }

  const audioLower = preferredAudio.trim().toLowerCase();
  if (!audioLower || audioLower === 'any' || audioLower === '*') {
    return true;
  }

  const title = String(release.title || '');
  const description = String(
    release.description || release.overview || release.summary || ''
  );
  const audioText = `${title}\n${description}`;

  if (audioLower === 'russian' || audioLower === 'rus' || audioLower === 'ru') {
    if (hasRussianVoiceTrack(audioText)) {
      // «RUS Sub» / «СТ» без реальной дорожки — не считаем русской озвучкой.
      if (isSubtitleOnlyRelease(audioText)) {
        const strongVoice =
          /(?:^|[^a-zа-яё0-9])(?:avo|dvo|mvo|hvdvo|3vo)(?:$|[^a-zа-яё0-9])/i.test(
            audioText
          ) ||
          /дубляж|озвуч|закадр|многоголосый|проф\.?\s*перевод/i.test(audioText);
        return strongVoice;
      }
      return true;
    }
    return false;
  }

  if (
    audioLower === 'original_sub' ||
    audioLower === 'original-with-sub' ||
    audioLower === 'orig_sub' ||
    audioLower === 'original' ||
    audioLower === 'eng'
  ) {
    const originalSubMarkers = [
      'eng',
      'english',
      'original',
      'оригинал',
      ' sub',
      'sub]',
      'субтитр',
      ' ст ',
      '/ст/',
      '/ст ',
      ' ст/',
    ];
    return (
      originalSubMarkers.some((marker) => audioText.toLowerCase().includes(marker)) ||
      isSubtitleOnlyRelease(audioText)
    );
  }

  return audioText.toLowerCase().includes(audioLower);
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

  const normalizedYear = normalizeYear(year);

  return results.filter((release) => {
    const releaseTitle = (release.title || '').toLowerCase();
    const releaseImdb = release.imdbId || release.imdb_id || '';

    let imdbMatched = false;
    if (releaseImdb && imdbId) {
      const releaseImdbStr = String(releaseImdb).trim();
      const imdbIdStr = String(imdbId).trim();
      if (
        releaseImdbStr &&
        releaseImdbStr !== '0' &&
        releaseImdbStr.toLowerCase() === imdbIdStr.toLowerCase()
      ) {
        imdbMatched = true;
      }
    }

    if (imdbMatched) {
      // Даже при совпадении IMDb отсекаем явный чужой год в названии (ремейки/одноимённые).
      if (
        itemType === 'movie' &&
        normalizedYear &&
        !yearMatchesRelease(normalizedYear, releaseTitle)
      ) {
        return false;
      }
      return true;
    }

    const releaseTokens = titleTokens(releaseTitle);
    const hasTitleMatch = aliases.some((alias) =>
      alias.length === 1
        ? containsExactSegment(releaseTitle, alias)
        : containsSequence(releaseTokens, alias)
    );
    if (!hasTitleMatch) {
      return false;
    }

    if (itemType === 'movie' && normalizedYear) {
      return yearMatchesRelease(normalizedYear, releaseTitle, { requireYearInTitle: true });
    }
    if (normalizedYear) {
      return yearMatchesRelease(normalizedYear, releaseTitle);
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
    if (hasJunkReleaseMarkers(release)) {
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
          qualityMatch =
            qualityPref.includes(qualityStr) ||
            title.includes(qualityPref) ||
            qualityStr.includes(qualityPref);
        }
        if (qualityMatch) {
          break;
        }
      }
    }

    return qualityMatch && matchesPreferredAudio(release, preferredAudio);
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

  const year = normalizeYear(input.year);
  let seasonNum = input.targetSeason ?? null;
  if (input.itemType === 'tv' && !seasonNum) {
    seasonNum =
      extractSeasonFromTitle(input.originalTitle) || extractSeasonFromTitle(input.title);
  }

  const queries: string[] = [];
  for (const baseTitle of titles) {
    if (input.itemType === 'tv' && seasonNum) {
      const seasonVariants = [
        `сезон ${seasonNum}`,
        `s${String(seasonNum).padStart(2, '0')}`,
        `season ${seasonNum}`,
      ];
      for (const sv of seasonVariants) {
        if (year) {
          queries.push(`${baseTitle} ${year} ${sv}`);
        }
        // Без года — только если год неизвестен (иначе ловим соседние сезоны/ремейки).
        if (!year) {
          queries.push(`${baseTitle} ${sv}`);
        }
      }
      if (!year) {
        queries.push(baseTitle);
      } else {
        queries.push(`${baseTitle} ${year}`);
      }
    } else if (year) {
      // Фильмы/прочее с годом: только запросы с годом.
      queries.push(`${baseTitle} ${year}`);
    } else {
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
