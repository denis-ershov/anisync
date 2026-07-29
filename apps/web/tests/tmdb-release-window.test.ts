import assert from 'node:assert/strict';
import test from 'node:test';

import { pickDigitalReleaseDate } from '@/lib/integrations/tmdb/digital-release-dates';

function payload(entries: Array<[string, string, number]>) {
  return {
    id: 1,
    results: entries.map(([region, releaseDate, type]) => ({
      iso_3166_1: region,
      release_dates: [{ release_date: releaseDate, type }],
    })),
  };
}

test('digital release prefers US, then RU, then another region', () => {
  const from = '2026-07-01';
  const to = '2026-08-01';
  assert.equal(
    pickDigitalReleaseDate(
      payload([
        ['RU', '2026-07-10T00:00:00Z', 4],
        ['US', '2026-07-12T00:00:00Z', 4],
      ]),
      from,
      to
    ),
    '2026-07-12'
  );
  assert.equal(
    pickDigitalReleaseDate(payload([['RU', '2026-07-10T00:00:00Z', 4]]), from, to),
    '2026-07-10'
  );
  assert.equal(
    pickDigitalReleaseDate(payload([['DE', '2026-07-11T00:00:00Z', 4]]), from, to),
    '2026-07-11'
  );
});

test('digital release ignores theatrical type and dates outside window', () => {
  assert.equal(
    pickDigitalReleaseDate(payload([['US', '2026-07-10T00:00:00Z', 3]]), '2026-07-01', '2026-08-01'),
    null
  );
  assert.equal(
    pickDigitalReleaseDate(payload([['US', '2026-08-01T00:00:00Z', 4]]), '2026-07-01', '2026-08-01'),
    null
  );
});
