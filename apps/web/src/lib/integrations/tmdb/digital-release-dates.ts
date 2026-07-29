/**
 * Агрегация дат цифрового релиза из TMDB `/movie/{id}/release_dates`.
 *
 * Стратегия:
 * 1. US — приоритетный регион.
 * 2. Собираем все digital-like записи (type 4 + SVOD type 6 с платформой в note).
 * 3. Берём самую раннюю календарную дату (покупка/аренда / стриминг на платформе).
 * 4. Для каталога/расписания — earliest в окне, не «canonical вне окна → null».
 */

export const TMDB_DIGITAL_RELEASE_TYPE = 4;
export const TMDB_TV_RELEASE_TYPE = 6;

export type TmdbReleaseDateEntry = {
  release_date: string;
  type: number;
  note?: string | null;
};

export type TmdbMovieReleaseDates = {
  id: number;
  results: Array<{
    iso_3166_1: string;
    release_dates: TmdbReleaseDateEntry[];
  }>;
};

const SVOD_PLATFORM_PATTERN =
  /peacock|netflix|hulu|disney\+?|prime video|amazon|apple tv|google play|vudu|fandango|youtube|microsoft|redbox|max|paramount\+?|showtime|starz|crunchyroll|mubi|tubi/i;

export function toDateOnly(value: string | undefined | null): string | null {
  if (!value) return null;
  const [date] = value.split('T');
  return date ?? null;
}

export function inDateRange(value: string | null | undefined, from: string, toExclusive: string): boolean {
  return Boolean(value && value >= from && value < toExclusive);
}

function earliestDateKey(dates: string[]): string | null {
  if (dates.length === 0) {
    return null;
  }
  return [...dates].sort((a, b) => a.localeCompare(b))[0];
}

/** type 4 Digital + type 6 TV только если note указывает на SVOD/retailer. */
export function isDigitalAvailabilityEntry(entry: TmdbReleaseDateEntry): boolean {
  if (entry.type === TMDB_DIGITAL_RELEASE_TYPE) {
    return true;
  }

  if (entry.type !== TMDB_TV_RELEASE_TYPE) {
    return false;
  }

  const note = entry.note?.trim() ?? '';
  if (!note) {
    return false;
  }

  return SVOD_PLATFORM_PATTERN.test(note);
}

function digitalDateKeysForRegion(payload: TmdbMovieReleaseDates, region: string): string[] {
  const entry = payload.results.find((item) => item.iso_3166_1 === region);
  if (!entry) {
    return [];
  }

  return (entry.release_dates ?? [])
    .filter(isDigitalAvailabilityEntry)
    .map((item) => toDateOnly(item.release_date))
    .filter((date): date is string => Boolean(date));
}

function allDigitalDateKeys(payload: TmdbMovieReleaseDates): string[] {
  return payload.results
    .flatMap((region) => region.release_dates ?? [])
    .filter(isDigitalAvailabilityEntry)
    .map((item) => toDateOnly(item.release_date))
    .filter((date): date is string => Boolean(date));
}

/**
 * Самая ранняя US digital date; если в US нет — earliest globally.
 * Для UI (torrent/releases карточки) без ограничения окна.
 */
export function pickCanonicalDigitalReleaseDate(payload: TmdbMovieReleaseDates): string | null {
  const usEarliest = earliestDateKey(digitalDateKeysForRegion(payload, 'US'));
  if (usEarliest) {
    return usEarliest;
  }

  return earliestDateKey(allDigitalDateKeys(payload));
}

/**
 * Earliest US digital в окне [from, toExclusive); fallback — earliest global в окне.
 */
export function pickDigitalReleaseDate(
  payload: TmdbMovieReleaseDates,
  from: string,
  toExclusive: string,
): string | null {
  const usInWindow = digitalDateKeysForRegion(payload, 'US').filter((date) =>
    inDateRange(date, from, toExclusive),
  );
  const usEarliest = earliestDateKey(usInWindow);
  if (usEarliest) {
    return usEarliest;
  }

  const globalInWindow = allDigitalDateKeys(payload).filter((date) => inDateRange(date, from, toExclusive));
  return earliestDateKey(globalInWindow);
}
