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
  'dl',
  // Кодеки и разрешения после разделения букв и цифр
  '1080',
  '2160',
  '720',
  '480',
  '264',
  '265',
  '4k',
  '8k',
]);

const ROMAN_NUMERALS_MAP: Record<string, string> = {
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
};

const SEASON_EPISODE_CONTEXT_WORDS = new Set([
  'season',
  'seasons',
  'episode',
  'episodes',
  'ep',
  'eps',
  'сезон',
  'сезона',
  'сезоны',
  'серия',
  'серии',
  'серий',
  'эпизод',
  'эпизода',
  'эпизодов',
  's',
  'e',
  'of',
  'из',
  'bit',
  'бит',
  'k',
]);

function tokenize(value: string): string[] {
  const prepared = value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\b(?:viii|vii|vi|iv|iii|ii|ix|x|v)\b/gi, (roman) => {
      return ROMAN_NUMERALS_MAP[roman.toLowerCase()] ?? roman;
    })
    .replace(/([a-zа-я])(\d)/gi, '$1 $2')
    .replace(/(\d)([a-zа-я])/gi, '$1 $2');
  return prepared.match(/[0-9a-zа-я]+/gi) ?? [];
}

export function titleTokens(value: string): string[] {
  const rawTokens = tokenize(value);
  const result: string[] = [];

  for (let i = 0; i < rawTokens.length; i += 1) {
    const token = rawTokens[i];

    // Пропускаем 4-значные года
    if (/^(?:19|20)\d{2}$/.test(token)) {
      continue;
    }

    // Если число — проверяем контекст (сезон, серия, битность, of 10, 4k)
    if (/^\d+$/.test(token)) {
      const prev = rawTokens[i - 1];
      const next = rawTokens[i + 1];
      const nextNext = rawTokens[i + 2];

      if (prev && SEASON_EPISODE_CONTEXT_WORDS.has(prev)) {
        continue;
      }
      if (next && SEASON_EPISODE_CONTEXT_WORDS.has(next)) {
        continue;
      }
      // Диапазон серий (например "1-8 серии"): prev='1', next='8', nextNext='серии'
      if (next && /^\d+$/.test(next) && nextNext && SEASON_EPISODE_CONTEXT_WORDS.has(nextNext)) {
        continue;
      }
      if (prev && /^\d+$/.test(prev) && next && SEASON_EPISODE_CONTEXT_WORDS.has(next)) {
        continue;
      }
      if (COMMON_WORDS.has(token)) {
        continue;
      }
      result.push(token);
      continue;
    }

    if (COMMON_WORDS.has(token)) {
      continue;
    }
    if (token.length > 1) {
      result.push(token);
    }
  }

  return result;
}

/**
 * Очищает название раздачи от технического мусора, сезонности, серий, кодеков и студий
 * перед извлечением ключевых токенов названия.
 */
export function cleanReleaseTitleForTokens(title: string): string {
  return title
    // Блоки тех. метаданных и релизных параметров в квадратных скобках
    .replace(/\[\s*(?:s\d+|e\d+|\d+bit|\d+-bit|h[\s.\-_]?264|h[\s.\-_]?265|x264|x265|hevc|avc|2160p|1080p|720p|480p|4k|8k|sdr|hdr|dv|web|bdrip|remux|bluray|hybrid|rus|eng|dub|mvo|avo)[^\]]*\]/gi, ' ')
    // Сезоны и серии во всех форматах (S01E01-02, S1E1-2, S1, E1-2, 1-2 серии, 1-2 of 8, etc.)
    .replace(/\b[sс]\s*\d+\s*[eе]\s*\d+(?:\s*-\s*(?:[eе]\s*)?\d+)?(?:\s+(?:of|из)\s+\d+)?\b/gi, ' ')
    .replace(/\b[sс]\s*\d+(?:\s*-\s*[sс]?\s*\d+)?\b/gi, ' ')
    .replace(/\b[eе]\s*\d+(?:\s*-\s*[eе]?\s*\d+)?\b/gi, ' ')
    .replace(/\b\d+\s*-\s*\d+\s*(?:of|из)\s*\d+\b/gi, ' ')
    .replace(/\b\d+\s*-\s*\d+\s*(?:сери[яий]|эпизод(?:а|ов)?|eps?|episodes?)\b/gi, ' ')
    .replace(/\b(?:of|из)\s*\d+\b/gi, ' ')
    .replace(/\b(?:\d+\s*)?(?:сезон(?:а|ов|ы)?|season|seasons)\s*(?:\d+)?(?:\s*-\s*\d+)?\b/gi, ' ')
    .replace(/\b(?:\d+\s*)?(?:сери[яий]|эпизод(?:а|ов)?|eps?|episodes?)\s*(?:\d+)?(?:\s*-\s*\d+)?\b/gi, ' ')
    // Технические теги видео / аудио / источника
    .replace(/\b(?:hdr10\+?|hdr10plus|hdr|dolby[\s.\-_]?vision|dv)(?:\s*p\d+)?\b/gi, ' ')
    .replace(/\b\d+[\s.\-_]?bit\b/gi, ' ')
    .replace(/\b(?:web[\s.\-_]?(?:dl|rip)|bd[\s.\-_]?rip|dvd[\s.\-_]?rip|remux|blu[\s.\-_]?ray|uhdtv|hdtv)\b/gi, ' ')
    .replace(/\b(?:hevc|avc|h[\s.\-_]?264|h[\s.\-_]?265|x[\s.\-_]?264|x[\s.\-_]?265|av1)\b/gi, ' ')
    .replace(/\b(?:1080[pi]|2160[pi]|720[pi]|480[pi]|4k|8k|uhd|fhd|hd)\b/gi, ' ')
    .replace(/\b(?:dub|sub|subs|mvo|dvo|avo|hybrid|original)\b/gi, ' ')
    .replace(/\b(?:russian|rus|eng|multi)\b/gi, ' ')
    .replace(/\b(?:hdrezka(?:\s*studio)?|lostfilm|red\s*head\s*sound|rhs|newcomers|tvshows|alexfilm|viruseproject|kubik(?:\s*v\s*kube)?)\b/gi, ' ')
    .replace(/\b(?:лицензи[яи]|чистый\s*звук)\b/gi, ' ')
    .replace(/\b(?:p,\s*d|дб|пд|пм|лд|лм)\b/gi, ' ')
    // Года
    .replace(/\b(?:19|20)\d{2}\b/g, ' ');
}

function containsSequence(
  tokens: string[],
  sequence: string[],
  options?: { isMovie?: boolean }
): boolean {
  if (!sequence.length || sequence.length > tokens.length) {
    return false;
  }
  for (let start = 0; start <= tokens.length - sequence.length; start += 1) {
    if (tokens.slice(start, start + sequence.length).join('\0') === sequence.join('\0')) {
      const lastSeqToken = sequence[sequence.length - 1];
      const isSeqEndingInNumber = /^\d+$/.test(lastSeqToken);
      const nextToken = tokens[start + sequence.length];
      // Защита от сиквелов применима ТОЛЬКО для фильмов, когда искомое название НЕ заканчивается цифрой
      // и сразу за ним следует номер части сиквела (напр. фильм 'Холоп' не должен находить 'Холоп 2' или 'Холоп 3').
      // Для ТВ-сериалов цифры после названия относятся к сезонам/эпизодам и фильтруются filterResultsBySeason.
      if (options?.isMovie && !isSeqEndingInNumber && nextToken && /^\d+$/.test(nextToken)) {
        continue;
      }
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

    if (foundSeasons.size > 0) {
      return foundSeasons.has(targetSeason);
    }
    // Если раздача не содержит явных меток сезона:
    // для 1 сезона допускаем (паки/минисериалы без явного S01),
    // для последующих сезонов (2, 3...) раздача без указания сезона не подходит.
    return targetSeason === 1;
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
  options?: { requireYearInTitle?: boolean; isTv?: boolean }
): boolean {
  const year = normalizeYear(itemYear);
  if (!year) {
    return true;
  }
  const releaseYears = extractReleaseYears(releaseTitle);
  if (releaseYears.size > 0) {
    const num = Number(year);
    if (options?.isTv) {
      // Для сериалов год релиза сезона может быть позже года премьеры (напр. Сезон 3 в 2024 при премьере 2020).
      // Отсекаем только явно старые релизы до премьеры сериала (старые ремейки).
      return Array.from(releaseYears).some((y) => Number(y) >= num - 1);
    }
    return (
      releaseYears.has(year) ||
      releaseYears.has(String(num - 1)) ||
      releaseYears.has(String(num + 1))
    );
  }
  // Для фильмов без года в названии title-match ненадёжен.
  return options?.requireYearInTitle ? false : true;
}

export type ItemAudioContext = {
  isRussianOrigin?: boolean;
  tracker?: string | null;
};

export function isRussianTitleOrigin(
  title?: string | null,
  originalTitle?: string | null
): boolean {
  const orig = (originalTitle || '').trim();
  const main = (title || '').trim();
  if (/[а-яё]/i.test(orig) && !/[a-z]/i.test(orig)) {
    return true;
  }
  if (!orig && /[а-яё]/i.test(main) && !/[a-z]/i.test(main)) {
    return true;
  }
  if (/[а-яё]/i.test(orig) && /[а-яё]/i.test(main) && !/[a-z]/i.test(orig)) {
    return true;
  }
  return false;
}

const EXPLICIT_SUBTITLE_ONLY_PATTERNS: RegExp[] = [
  /только\s+субтитр/i,
  /sub[\s.\-_]?only/i,
  /soft[\s.\-_]?sub/i,
  /hard[\s.\-_]?sub/i,
];

const GENERAL_SUBTITLE_PATTERNS: RegExp[] = [
  /(?:^|[^a-zа-я0-9])ст(?:$|[^a-zа-я0-9])/i,
  /(?:^|[^a-zа-я0-9])стр(?:$|[^a-zа-я0-9])/i,
  /(?:^|[^a-zа-я0-9])subs?(?:$|[^a-zа-я0-9])/i,
  /субтит/i,
];

export const RUSSIAN_VOICE_PATTERNS: RegExp[] = [
  // Сокращения типов звука трекеров
  /(?:^|[^a-zа-я0-9])(?:avo|dvo|mvo|hvdvo|3vo|дб|пд|пм|лд|лм)(?:$|[^a-zа-я0-9])/i,
  /(?:^|[^a-zа-я0-9])(?:п\.?о|л\.?о)\.?\s*(?:перевод|озвуч|закадр|голос)/i,
  // Дубляж и перевод
  /дубл/i,
  /озвуч/i,
  /закадр/i,
  /многоголос/i,
  /двухголос/i,
  /одноголос/i,
  /авторск/i,
  /проф\.?\s*перевод/i,
  /русск(?:ая|ий|ое|ие|ую)?\s*(?:озвуч|дорож|дуб|перевод|звук)/i,
  /(?:^|[^a-zа-я0-9])(?:rus|рус|russian)(?:$|[^a-zа-я0-9])/i,
  // Релизные маркеры качественного дубляжа/перевода
  /лицензи/i,
  /чистый\s*звук/i,
  // Студии озвучки (включая все студии из трекеров и настроек)
  /\bred\s*head\s*sound\b/i,
  /\brhs\b/i,
  /\bhd\s*rezka(?:\s*studio)?\b/i,
  /\bhdrezka(?:\s*studio)?\b/i,
  /\brezka\b/i,
  /\bрезка\b/i,
  /\blostfilm\b/i,
  /\bлостфильм\b/i,
  /\bnewcomers\b/i,
  /\bньюкамерс\b/i,
  /\btvshows\b/i,
  /\bтвшоуз\b/i,
  /\balexfilm\b/i,
  /\bалексфильм\b/i,
  /\bviruseproject\b/i,
  /\bвируспроджект\b/i,
  /\bkubik(?:\s*v\s*kube|\s*studio|³)?\b/i,
  /\bкубик\b/i,
  /\bкубик\s*в\s*кубе\b/i,
  /\bквк\b/i,
  /\bwinmedia\b/i,
  /\bвинмедиа\b/i,
  /\bsyncmer\b/i,
  /\bсинкмер\b/i,
  /\ble[\s.\-_]?production\b/i,
  /\bcoldfilm\b/i,
  /\bколдфильм\b/i,
  /\bdragon\s*money\s*studio\b/i,
  /\btvo[eё]\b/i,
  /\bnewstudio\b/i,
  /\bньюстудио\b/i,
  /\bпифагор\b/i,
  /\bpythagor\b/i,
  /\bflarrow\s*films\b/i,
  /\bневафильм\b/i,
  /\bкураж[\s.\-_]?бамбей\b/i,
  /\bjaskier\b/i,
  /\bяскьер\b/i,
  /\bbaibako\b/i,
  /\bбайбако\b/i,
  /\banilibria\b/i,
  /\bанилибрия\b/i,
  /\banidub\b/i,
  /\bанидаб\b/i,
  /\banimevost\b/i,
  /\bанимевост\b/i,
  /\bshiza\s*project\b/i,
  /\bукраинск/i,
  /\bukrainian\b/i,
];

function isSubtitleOnlyRelease(text: string): boolean {
  if (EXPLICIT_SUBTITLE_ONLY_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }
  const hasSub = GENERAL_SUBTITLE_PATTERNS.some((pattern) => pattern.test(text));
  if (!hasSub) {
    return false;
  }
  // Если есть субтитры, но также есть голосовая дорожка — это НЕ subtitle-only!
  return !hasRussianVoiceTrack(text);
}

function hasRussianVoiceTrack(text: string): boolean {
  return RUSSIAN_VOICE_PATTERNS.some((pattern) => pattern.test(text));
}

const INTERNATIONAL_TRACKERS = new Set([
  '1337x',
  'yts',
  'torrentgalaxy',
  'tgx',
  'eztv',
  'rarbg',
  'limetorrents',
  'glodls',
  'badass-torrents',
  'torlock',
  'magnetdl',
]);

function isInternationalTracker(trackerName?: string | null): boolean {
  if (!trackerName) {
    return false;
  }
  const lower = trackerName.toLowerCase();
  for (const t of INTERNATIONAL_TRACKERS) {
    if (lower.includes(t)) {
      return true;
    }
  }
  return false;
}

export function matchesPreferredAudio(
  release: ProwlarrRelease,
  preferredAudio: string | null | undefined,
  context?: ItemAudioContext
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

  // Для отечественного контента (например «Холоп 3») русский звук является родным и оригинальным
  if (context?.isRussianOrigin) {
    if (audioLower === 'russian' || audioLower === 'rus' || audioLower === 'ru') {
      return true;
    }
    if (
      audioLower === 'original' ||
      audioLower === 'original_sub' ||
      audioLower === 'original-with-sub' ||
      audioLower === 'orig_sub'
    ) {
      return true;
    }
  }

  if (audioLower === 'russian' || audioLower === 'rus' || audioLower === 'ru') {
    if (hasRussianVoiceTrack(audioText)) {
      if (isSubtitleOnlyRelease(audioText)) {
        return false;
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
      'orig',
      'оригинал',
      'sub',
      'субтитр',
      'ст',
      'multi',
    ];
    if (originalSubMarkers.some((marker) => audioText.toLowerCase().includes(marker))) {
      return true;
    }
    if (isSubtitleOnlyRelease(audioText)) {
      return true;
    }
    // Зарубежные сцен-релизы с международных трекеров по умолчанию содержат оригинальный звук
    const tracker = release.indexer || release.tracker || context?.tracker;
    if (isInternationalTracker(tracker)) {
      return true;
    }
    // Стандартные сцен-теги англоязычных релизов без дубляжа
    if (/\b(?:web-dl|webrip|bluray|bdrip|remux|hdtv)\b/i.test(title) && !hasRussianVoiceTrack(title)) {
      return true;
    }
    return false;
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

  const rawValues = [(originalTitle || '').trim(), (title || '').trim()].filter(Boolean);
  const aliases: string[][] = [];

  for (const raw of rawValues) {
    const fullTokens = titleTokens(raw);
    if (fullTokens.length && !aliases.some((alias) => alias.join('\0') === fullTokens.join('\0'))) {
      aliases.push(fullTokens);
    }
    // Если название содержит подзаголовок (например "Слово пацана. Кровь на асфальте" или "Фонари: Начало")
    const parts = raw.split(/[:.·•-]/);
    if (parts.length > 1) {
      const firstPartTokens = titleTokens(parts[0]);
      if (
        firstPartTokens.length >= 2 &&
        !aliases.some((alias) => alias.join('\0') === firstPartTokens.join('\0'))
      ) {
        aliases.push(firstPartTokens);
      }
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

    const cleanedTitle = cleanReleaseTitleForTokens(releaseTitle);
    const releaseTokens = titleTokens(cleanedTitle);
    const isMovie = itemType === 'movie';
    const hasTitleMatch = aliases.some((alias) =>
      containsSequence(releaseTokens, alias, { isMovie })
    );
    if (!hasTitleMatch) {
      return false;
    }

    if (itemType === 'movie' && normalizedYear) {
      // Не используем requireYearInTitle — большинство русских раздач (Kinozal, RuTracker)
      // не содержат год в заголовке, но при этом являются верными результатами.
      return yearMatchesRelease(normalizedYear, releaseTitle);
    }
    if (normalizedYear) {
      return yearMatchesRelease(normalizedYear, releaseTitle, { isTv: itemType === 'tv' });
    }
    return true;
  });
}

export type VideoResolution = '2160p' | '1080p' | '720p' | '480p';
export type DynamicRange = 'DV' | 'HDR' | 'SDR';

export type DetectedQuality = {
  resolution: VideoResolution | null;
  dynamicRange: DynamicRange;
  label: string;
};

export function detectReleaseQuality(
  title: string,
  rawQuality?: unknown
): DetectedQuality {
  const cleanTitle = (title || '').toLowerCase();

  // 1. Resolution
  let resolution: VideoResolution | null = null;
  if (/\b(?:2160p?|4k|uhd|ultra[\s._-]?hd)\b/i.test(cleanTitle)) {
    resolution = '2160p';
  } else if (/\b(?:1080p?|1080i|fhd|full[\s._-]?hd)\b/i.test(cleanTitle)) {
    resolution = '1080p';
  } else if (
    /\b(?:720p?|1280x720)\b/i.test(cleanTitle) ||
    (/\bhd\b/i.test(cleanTitle) && !/\b(?:fhd|uhd|hdtv)\b/i.test(cleanTitle))
  ) {
    resolution = '720p';
  } else if (/\b(?:480p?|576p?|sd|dvd|dvdrip)\b/i.test(cleanTitle)) {
    resolution = '480p';
  }

  // Fallback to rawQuality if resolution not determined from title
  if (!resolution && rawQuality) {
    let resValue = '';
    if (typeof rawQuality === 'object' && rawQuality !== null) {
      const obj = rawQuality as Record<string, unknown>;
      resValue = String(obj.resolution || obj.name || '').toLowerCase();
    } else {
      resValue = String(rawQuality).toLowerCase();
    }

    if (resValue.includes('2160') || resValue.includes('4k')) {
      resolution = '2160p';
    } else if (resValue.includes('1080')) {
      resolution = '1080p';
    } else if (resValue.includes('720')) {
      resolution = '720p';
    } else if (resValue.includes('480') || resValue.includes('576')) {
      resolution = '480p';
    }
  }

  // 2. Dynamic Range
  let dynamicRange: DynamicRange = 'SDR';
  const hasDv = /\b(?:dolby[\s._-]?vision|dovi|dv)\b/i.test(cleanTitle);
  const hasHdr = /\b(?:hdr10\+|hdr10|hdr|hlg)\b/i.test(cleanTitle);

  if (hasDv) {
    dynamicRange = 'DV';
  } else if (hasHdr) {
    dynamicRange = 'HDR';
  } else {
    dynamicRange = 'SDR';
  }

  // 3. Label
  let label = '';
  if (resolution === '2160p') {
    if (dynamicRange === 'DV') {
      label = '2160p DV';
    } else if (dynamicRange === 'HDR') {
      label = '2160p HDR';
    } else {
      label = '2160p SDR';
    }
  } else if (resolution) {
    if (dynamicRange === 'DV' || dynamicRange === 'HDR') {
      label = `${resolution} ${dynamicRange}`;
    } else {
      label = resolution;
    }
  } else if (rawQuality && typeof rawQuality === 'object' && (rawQuality as Record<string, unknown>).name) {
    label = String((rawQuality as Record<string, unknown>).name);
  }

  return {
    resolution,
    dynamicRange,
    label,
  };
}

export function filterReleasesByPreferences(
  results: ProwlarrRelease[],
  preferredQuality?: string | null,
  preferredAudio?: string | null,
  context?: ItemAudioContext
): ProwlarrRelease[] {
  return results.filter((release) => {
    if (hasJunkReleaseMarkers(release)) {
      return false;
    }

    if (!matchesPreferredAudio(release, preferredAudio, context)) {
      return false;
    }

    if (!preferredQuality) {
      return true;
    }

    const qualityList = preferredQuality
      .split(',')
      .map((q) => q.trim().toLowerCase())
      .filter(Boolean);

    if (!qualityList.length || qualityList.includes('any') || qualityList.includes('*')) {
      return true;
    }

    const detected = detectReleaseQuality(release.title || '', release.quality);

    for (const pref of qualityList) {
      // 2160p SDR / 4K SDR
      if (pref === '2160p sdr' || pref === '4k sdr' || pref === 'uhd sdr') {
        if (detected.resolution === '2160p' && detected.dynamicRange === 'SDR') {
          return true;
        }
        continue;
      }

      // 2160p HDR / 4K HDR
      if (pref === '2160p hdr' || pref === '4k hdr' || pref === 'uhd hdr') {
        if (
          detected.resolution === '2160p' &&
          (detected.dynamicRange === 'HDR' || detected.dynamicRange === 'DV')
        ) {
          return true;
        }
        continue;
      }

      // General 2160p / 4K (any dynamic range)
      if (pref === '2160p' || pref === '4k' || pref === 'uhd') {
        if (detected.resolution === '2160p') {
          return true;
        }
        continue;
      }

      // 1080p
      if (pref === '1080p' || pref === '1080' || pref === 'fhd') {
        if (detected.resolution === '1080p') {
          return true;
        }
        continue;
      }

      // 720p
      if (pref === '720p' || pref === '720' || pref === 'hd') {
        if (detected.resolution === '720p') {
          return true;
        }
        continue;
      }

      // 480p / SD
      if (pref === '480p' || pref === '480' || pref === 'sd') {
        if (detected.resolution === '480p') {
          return true;
        }
        continue;
      }

      // Exact label match or title substring match if custom
      if (detected.label && detected.label.toLowerCase() === pref) {
        return true;
      }
      const titleLower = (release.title || '').toLowerCase();
      if (titleLower.includes(pref)) {
        return true;
      }
    }

    return false;
  });
}

function cleanQueryString(value: string): string {
  return value
    .replace(/[.:;,\-_/|\\[\]()]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export function buildSearchQueries(input: {
  imdbId: string;
  title?: string | null;
  originalTitle?: string | null;
  itemType?: string | null;
  year?: string | null;
  targetSeason?: number | null;
}): string[] {
  const rawTitles: string[] = [];
  if (input.originalTitle?.trim()) {
    rawTitles.push(input.originalTitle.trim());
  }
  if (input.title?.trim() && input.title.trim() !== (input.originalTitle || '').trim()) {
    rawTitles.push(input.title.trim());
  }
  if (!rawTitles.length && input.imdbId) {
    rawTitles.push(input.imdbId.trim());
  }
  if (!rawTitles.length) {
    return [];
  }

  const year = normalizeYear(input.year);
  let seasonNum = input.targetSeason ?? null;
  if (input.itemType === 'tv' && !seasonNum) {
    seasonNum =
      extractSeasonFromTitle(input.originalTitle) || extractSeasonFromTitle(input.title);
  }

  const queries: string[] = [];
  for (const raw of rawTitles) {
    const cleanBase = cleanQueryString(raw);
    const variants = [cleanBase];

    // Если есть подзаголовок, также добавляем главную часть (например "Слово пацана")
    const parts = raw.split(/[:.·•-]/);
    if (parts.length > 1) {
      const cleanShort = cleanQueryString(parts[0]);
      if (cleanShort && cleanShort !== cleanBase && cleanShort.split(/\s+/).length >= 2) {
        variants.push(cleanShort);
      }
    }

    for (const baseTitle of variants) {
      if (input.itemType === 'tv' && seasonNum) {
        // Запросы под разные стили оформления сезонов на трекерах (RuTracker: "1 сезон", зарубежные: "s01")
        if (year) {
          queries.push(`${baseTitle} ${year} ${seasonNum} сезон`);
          queries.push(`${baseTitle} ${year} s${String(seasonNum).padStart(2, '0')}`);
          queries.push(`${baseTitle} ${year} сезон ${seasonNum}`);
          queries.push(`${baseTitle} ${year} season ${seasonNum}`);
          queries.push(`${baseTitle} ${year}`);
        } else {
          queries.push(`${baseTitle} ${seasonNum} сезон`);
          queries.push(`${baseTitle} s${String(seasonNum).padStart(2, '0')}`);
          queries.push(`${baseTitle} сезон ${seasonNum}`);
          queries.push(baseTitle);
        }
      } else if (year) {
        queries.push(`${baseTitle} ${year}`);
        // Для сериалов также полезно включить базовое название без года
        if (input.itemType === 'tv') {
          queries.push(baseTitle);
        }
      } else {
        queries.push(baseTitle);
      }
    }
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    const clean = query.split(/\s+/).join(' ').trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      unique.push(clean);
    }
  }
  return unique;
}
