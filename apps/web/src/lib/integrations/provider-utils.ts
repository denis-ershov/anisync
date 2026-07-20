import type { LibraryStatus, ProviderUpdatePayload } from './provider-types';

export function toIsoOrNull(value?: string | number | null): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'number') {
    return new Date(value * 1000).toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeShikimoriDate(date?: { date?: string | null } | null) {
  return date?.date || null;
}

export function normalizeAniListStatus(status?: string | null): LibraryStatus {
  switch (status) {
    case 'CURRENT':
      return 'watching';
    case 'PLANNING':
      return 'planned';
    case 'COMPLETED':
      return 'completed';
    case 'PAUSED':
      return 'on_hold';
    case 'DROPPED':
      return 'dropped';
    case 'REPEATING':
      return 'rewatching';
    default:
      return 'planned';
  }
}

export function normalizeMalStatus(status?: string | null): LibraryStatus {
  switch (status) {
    case 'watching':
    case 'plan_to_watch':
    case 'completed':
    case 'on_hold':
    case 'dropped':
      return status === 'plan_to_watch' ? 'planned' : status;
    default:
      return 'planned';
  }
}

export function mapLibraryStatusToMal(status: ProviderUpdatePayload['watchStatus']) {
  switch (status) {
    case 'planned':
      return 'plan_to_watch';
    case 'watching':
    case 'completed':
    case 'on_hold':
    case 'dropped':
      return status;
    case 'rewatching':
      return 'watching';
    default:
      return undefined;
  }
}

export function mapLibraryStatusToAniList(status: ProviderUpdatePayload['watchStatus']) {
  switch (status) {
    case 'watching':
      return 'CURRENT';
    case 'planned':
      return 'PLANNING';
    case 'completed':
      return 'COMPLETED';
    case 'on_hold':
      return 'PAUSED';
    case 'dropped':
    case 'not_interested':
      return 'DROPPED';
    case 'rewatching':
      return 'REPEATING';
    default:
      return undefined;
  }
}
