import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDigitalAvailabilityEntry,
  pickCanonicalDigitalReleaseDate,
  pickDigitalReleaseDate,
  type TmdbMovieReleaseDates,
} from '@/lib/integrations/tmdb/digital-release-dates';

function payload(
  entries: Array<{ region: string; dates: Array<{ date: string; type: number; note?: string }> }>,
): TmdbMovieReleaseDates {
  return {
    id: 1,
    results: entries.map(({ region, dates }) => ({
      iso_3166_1: region,
      release_dates: dates.map(({ date, type, note }) => ({
        release_date: date,
        type,
        note,
      })),
    })),
  };
}

test('canonical picks earliest US digital among multiple type-4 entries (FNAF2-like)', () => {
  const data = payload([
    {
      region: 'US',
      dates: [
        { date: '2026-08-03T00:00:00.000Z', type: 4, note: 'Peacock' },
        { date: '2025-12-23T00:00:00.000Z', type: 4, note: 'Amazon' },
        { date: '2025-12-05T00:00:00.000Z', type: 3 },
      ],
    },
  ]);

  assert.equal(pickCanonicalDigitalReleaseDate(data), '2025-12-23');
});

test('canonical prefers earliest US digital over earlier RU date', () => {
  const data = payload([
    {
      region: 'RU',
      dates: [{ date: '2025-11-01T00:00:00.000Z', type: 4 }],
    },
    {
      region: 'US',
      dates: [{ date: '2025-12-23T00:00:00.000Z', type: 4 }],
    },
  ]);

  assert.equal(pickCanonicalDigitalReleaseDate(data), '2025-12-23');
});

test('canonical falls back to global earliest when US has no digital', () => {
  const data = payload([
    {
      region: 'DE',
      dates: [{ date: '2026-07-11T00:00:00.000Z', type: 4 }],
    },
  ]);

  assert.equal(pickCanonicalDigitalReleaseDate(data), '2026-07-11');
});

test('windowed pick uses earliest US digital inside window, not canonical outside window', () => {
  const data = payload([
    {
      region: 'US',
      dates: [
        { date: '2025-12-23T00:00:00.000Z', type: 4 },
        { date: '2026-08-03T00:00:00.000Z', type: 4 },
      ],
    },
  ]);

  assert.equal(pickDigitalReleaseDate(data, '2026-07-01', '2026-09-01'), '2026-08-03');
  assert.equal(pickCanonicalDigitalReleaseDate(data), '2025-12-23');
});

test('windowed pick prefers US in-window date over earlier RU in-window date', () => {
  const data = payload([
    {
      region: 'RU',
      dates: [{ date: '2026-07-10T00:00:00.000Z', type: 4 }],
    },
    {
      region: 'US',
      dates: [{ date: '2026-07-12T00:00:00.000Z', type: 4 }],
    },
  ]);

  assert.equal(pickDigitalReleaseDate(data, '2026-07-01', '2026-08-01'), '2026-07-12');
});

test('type 6 SVOD with platform note counts as digital availability', () => {
  assert.equal(
    isDigitalAvailabilityEntry({ release_date: '2026-01-01', type: 6, note: 'Peacock' }),
    true,
  );
  assert.equal(isDigitalAvailabilityEntry({ release_date: '2026-01-01', type: 6, note: '' }), false);
  assert.equal(isDigitalAvailabilityEntry({ release_date: '2026-01-01', type: 3 }), false);
});

test('ignores theatrical and dates outside window', () => {
  const data = payload([
    {
      region: 'US',
      dates: [{ date: '2026-07-10T00:00:00.000Z', type: 3 }],
    },
  ]);

  assert.equal(pickDigitalReleaseDate(data, '2026-07-01', '2026-08-01'), null);
  assert.equal(
    pickDigitalReleaseDate(
      payload([
        {
          region: 'US',
          dates: [{ date: '2026-08-01T00:00:00.000Z', type: 4 }],
        },
      ]),
      '2026-07-01',
      '2026-08-01',
    ),
    null,
  );
});
