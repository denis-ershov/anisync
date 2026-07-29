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
