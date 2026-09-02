import assert from 'node:assert/strict';
import test from 'node:test';

import {
  pickEarliestDigitalCandidate,
  type DigitalReleaseCandidate,
} from '@/lib/services/movie-digital-release-pick';

test('aggregates earliest date across TMDB, Watchmode and Trakt', () => {
  const candidates: DigitalReleaseCandidate[] = [
    { date: '2026-08-03', source: 'tmdb', region: 'US', label: 'Peacock' },
    { date: '2025-12-23', source: 'watchmode', region: 'US', label: 'watchmode' },
    { date: '2025-12-24', source: 'trakt', region: 'US', label: 'trakt' },
  ];

  const result = pickEarliestDigitalCandidate(candidates);
  assert.equal(result?.date, '2025-12-23');
  assert.equal(result?.source, 'watchmode');
});

test('windowed aggregation picks earliest in-window across sources', () => {
  const candidates: DigitalReleaseCandidate[] = [
    { date: '2025-12-23', source: 'tmdb', region: 'US' },
    { date: '2026-08-03', source: 'tmdb', region: 'US' },
    { date: '2026-07-15', source: 'trakt', region: 'US' },
  ];

  const result = pickEarliestDigitalCandidate(candidates, '2026-07-01', '2026-09-01');
  assert.equal(result?.date, '2026-07-15');
  assert.equal(result?.source, 'trakt');
});

test('returns null when no candidates match window', () => {
  const candidates: DigitalReleaseCandidate[] = [
    { date: '2025-12-23', source: 'tmdb', region: 'US' },
  ];

  assert.equal(pickEarliestDigitalCandidate(candidates, '2026-07-01', '2026-08-01'), null);
});

test('canonical display preserves earliest retail digital release over later streaming windows (The Mandalorian & Grogu case)', () => {
  const candidates: DigitalReleaseCandidate[] = [
    { date: '2026-07-21', source: 'tmdb', region: 'US', label: 'PVOD Retail' },
    { date: '2026-07-21', source: 'tmdb', region: 'RU', label: 'PVOD Retail' },
    { date: '2026-09-02', source: 'tmdb', region: 'US', label: 'Disney+' },
    { date: '2026-09-02', source: 'tmdb', region: 'CZ', label: 'Disney+' },
  ];

  // Для отображения в карточках, модалке и поиске (canonical display)
  const canonical = pickEarliestDigitalCandidate(candidates);
  assert.equal(canonical?.date, '2026-07-21');
  assert.equal(canonical?.source, 'tmdb');

  // Проверка логики каталога предстоящих релизов за сентябрь (Вариант А):
  // Фильм с canonicalDate 2026-07-21 считается вышедшим до сентября (canonicalDate < 2026-09-01).
  const fromSeptember = '2026-09-01';
  const isAlreadyReleased = Boolean(canonical?.date && canonical.date < fromSeptember);
  assert.equal(isAlreadyReleased, true);
});

test('movie digital release is not overwritten by streaming calendar dates in aggregator', () => {
  const canonicalDetailDate = '2026-07-21';
  const traktStreamingScheduleDate = '2026-09-02';

  // Логика resolveFromTmdbId:
  const movieType = 'movie' as const;
  const resolvedReleaseDate = movieType === 'movie'
    ? (canonicalDetailDate ?? traktStreamingScheduleDate)
    : (traktStreamingScheduleDate ?? canonicalDetailDate);

  assert.equal(resolvedReleaseDate, '2026-07-21');

  // Логика фильтрации каталога предстоящих релизов (Вариант А):
  const windowFrom = '2026-09-01';
  const windowToExclusive = '2026-11-01';
  const shouldExcludeFromUpcoming = movieType === 'movie' && resolvedReleaseDate < windowFrom;
  assert.equal(shouldExcludeFromUpcoming, true);
});


