import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterLibraryForScheduleImport,
  isWithinScheduleImportWindow,
  shouldIncludeInScheduleImport,
  SCHEDULE_IMPORT_WINDOW_DAYS,
} from '@/lib/integrations/library-schedule-import';
import type { ProviderLibraryEntry } from '@/lib/integrations/provider-types';

function entry(
  partial: Partial<ProviderLibraryEntry> & Pick<ProviderLibraryEntry, 'watchStatus'>
): ProviderLibraryEntry {
  return {
    externalEntryId: '1',
    externalAnimeId: '1',
    titleDefault: 'Test',
    watchedEpisodes: 0,
    ...partial,
  };
}

test('schedule window keeps titles airing today and within 14 days', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const inWindow = entry({
    watchStatus: 'watching',
    nextEpisodeDate: '2026-07-25T15:00:00Z',
  });
  const tooFar = entry({
    watchStatus: 'watching',
    nextEpisodeDate: '2026-08-20T15:00:00Z',
  });
  const past = entry({
    watchStatus: 'watching',
    nextEpisodeDate: '2026-07-10T15:00:00Z',
  });

  assert.equal(isWithinScheduleImportWindow(inWindow, now), true);
  assert.equal(isWithinScheduleImportWindow(tooFar, now), false);
  assert.equal(isWithinScheduleImportWindow(past, now), false);
  assert.equal(SCHEDULE_IMPORT_WINDOW_DAYS, 14);
});

test('watching/rewatching import even outside 14-day window (catching up)', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  assert.equal(
    shouldIncludeInScheduleImport(
      entry({ watchStatus: 'watching', nextEpisodeDate: '2026-07-10T15:00:00Z' }),
      now
    ),
    true
  );
  assert.equal(
    shouldIncludeInScheduleImport(
      entry({ watchStatus: 'watching', nextEpisodeDate: '2026-08-20T15:00:00Z' }),
      now
    ),
    true
  );
  assert.equal(
    shouldIncludeInScheduleImport(entry({ watchStatus: 'watching', nextEpisodeDate: null }), now),
    true
  );
  assert.equal(
    shouldIncludeInScheduleImport(
      entry({ watchStatus: 'rewatching', nextEpisodeDate: '2026-07-01T00:00:00Z' }),
      now
    ),
    true
  );
});

test('planned stays limited to 14-day window', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  assert.equal(
    shouldIncludeInScheduleImport(
      entry({ watchStatus: 'planned', airedOn: '2026-07-28', nextEpisodeDate: null }),
      now
    ),
    true
  );
  assert.equal(
    shouldIncludeInScheduleImport(
      entry({ watchStatus: 'planned', airedOn: '2026-08-20', nextEpisodeDate: null }),
      now
    ),
    false
  );
  assert.equal(
    shouldIncludeInScheduleImport(entry({ watchStatus: 'planned', nextEpisodeDate: null }), now),
    false
  );
});

test('filterLibraryForScheduleImport keeps catching-up watching and in-window planned', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const filtered = filterLibraryForScheduleImport(
    [
      entry({
        watchStatus: 'completed',
        nextEpisodeDate: '2026-07-23T00:00:00Z',
      }),
      entry({
        watchStatus: 'watching',
        nextEpisodeDate: null,
      }),
      entry({
        watchStatus: 'planned',
        airedOn: '2026-07-28',
        nextEpisodeDate: null,
      }),
      entry({
        watchStatus: 'watching',
        nextEpisodeDate: '2026-07-24T00:00:00Z',
      }),
      entry({
        watchStatus: 'watching',
        nextEpisodeDate: '2026-07-01T00:00:00Z',
      }),
    ],
    now
  );

  assert.equal(filtered.length, 4);
  assert.equal(
    filtered.filter((item) => item.watchStatus === 'watching').length,
    3
  );
  assert.equal(filtered.some((item) => item.watchStatus === 'planned'), true);
  assert.equal(filtered.some((item) => item.watchStatus === 'completed'), false);
});
