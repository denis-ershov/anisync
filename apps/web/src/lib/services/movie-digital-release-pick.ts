import { inDateRange } from '@/lib/integrations/tmdb/digital-release-dates';
import type { ReleaseScheduleSource } from '@/lib/releases/schedule-types';

export type DigitalReleaseSource = ReleaseScheduleSource | 'watchmode';

export type DigitalReleaseCandidate = {
  date: string;
  source: DigitalReleaseSource;
  region?: string;
  label?: string | null;
};

export type AggregatedMovieDigitalRelease = {
  date: string;
  source: DigitalReleaseSource;
  candidates: DigitalReleaseCandidate[];
};

function earliestCandidate(
  candidates: DigitalReleaseCandidate[],
): DigitalReleaseCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

export function pickEarliestDigitalCandidate(
  candidates: DigitalReleaseCandidate[],
  from?: string,
  toExclusive?: string,
): AggregatedMovieDigitalRelease | null {
  const pool =
    from && toExclusive
      ? candidates.filter((candidate) => inDateRange(candidate.date, from, toExclusive))
      : candidates;
  const winner = earliestCandidate(pool);
  if (!winner) {
    return null;
  }
  return { date: winner.date, source: winner.source, candidates };
}
