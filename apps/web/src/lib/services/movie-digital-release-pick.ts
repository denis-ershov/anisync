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

function sortCandidatesByDate(candidates: DigitalReleaseCandidate[]): DigitalReleaseCandidate[] {
  return [...candidates].sort((a, b) => a.date.localeCompare(b.date));
}

function earliestCandidate(
  candidates: DigitalReleaseCandidate[],
): DigitalReleaseCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  // Приоритет US региона (TMDB US, Watchmode US, Trakt US)
  const usCandidates = candidates.filter((c) => c.region === 'US');
  if (usCandidates.length > 0) {
    return sortCandidatesByDate(usCandidates)[0] ?? null;
  }

  return sortCandidatesByDate(candidates)[0] ?? null;
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

