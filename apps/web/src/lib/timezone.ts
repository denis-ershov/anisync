/** IANA timezone helpers. Instants in DB stay UTC (ISO); display/grouping use user TZ. */

export const DEFAULT_TIMEZONE = 'Europe/Moscow';

/** Common zones for settings UI (value = IANA id). */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
  { value: 'Europe/Kyiv', label: 'Киев (UTC+2/+3)' },
  { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
  { value: 'Asia/Almaty', label: 'Алматы (UTC+5)' },
  { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
  { value: 'Europe/Berlin', label: 'Берлин (UTC+1/+2)' },
  { value: 'Europe/London', label: 'Лондон (UTC+0/+1)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC−5/−4)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC−8/−7)' },
  { value: 'Asia/Tokyo', label: 'Токио (UTC+9)' },
  { value: 'UTC', label: 'UTC' },
];

export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(timeZone?: string | null): string {
  if (timeZone && isValidTimeZone(timeZone)) {
    return timeZone;
  }
  return DEFAULT_TIMEZONE;
}

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Calendar day key YYYY-MM-DD in the given IANA timezone. */
export function zonedDateKey(date: Date, timeZone?: string | null): string {
  const tz = resolveTimeZone(timeZone);
  const { year, month, day } = getZonedParts(date, tz);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

export function diffDateKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/** Wall-clock time HH:mm in user TZ. */
export function formatZonedTime(date: Date, timeZone?: string | null, locale = 'ru'): string {
  const tz = resolveTimeZone(timeZone);
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/**
 * Short next-episode label (no "приблизительно").
 * Examples: "через 40 мин", "через 3 ч", "сегодня 18:30", "через 6 дн."
 */
export function formatNextEpisodeShort(
  episodeAt: Date,
  now: Date = new Date(),
  options?: { timeZone?: string | null; locale?: string }
): string {
  const locale = options?.locale ?? 'ru';
  const tz = resolveTimeZone(options?.timeZone);
  const diffMs = episodeAt.getTime() - now.getTime();

  if (diffMs <= 0) {
    return locale === 'ru' ? 'вышла' : 'aired';
  }

  const minutes = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3600000);
  const sameDay = zonedDateKey(episodeAt, tz) === zonedDateKey(now, tz);

  if (minutes < 60) {
    return locale === 'ru' ? `через ${Math.max(1, minutes)} мин` : `in ${Math.max(1, minutes)}m`;
  }

  if (sameDay || hours < 24) {
    if (hours <= 6) {
      return locale === 'ru' ? `через ${hours} ч` : `in ${hours}h`;
    }
    const time = formatZonedTime(episodeAt, tz, locale);
    return locale === 'ru' ? `сегодня ${time}` : `today ${time}`;
  }

  const days = Math.max(1, Math.round(diffMs / 86400000));
  if (days <= 7) {
    return locale === 'ru' ? `через ${days} дн.` : `in ${days}d`;
  }

  const time = formatZonedTime(episodeAt, tz, locale);
  const date = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
  }).format(episodeAt);
  return `${date} ${time}`;
}
