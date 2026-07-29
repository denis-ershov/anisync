export type CatalogNextEpisodeMergeMode = 'replace' | 'fill-gaps' | 'fill-gaps-next-date';

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  return false;
}

/**
 * Выбор `nextEpisodeDate` при merge каталога.
 * - fill-gaps: сохраняем existing, если уже заполнен
 * - replace / fill-gaps-next-date: incoming побеждает, если не пустой
 */
export function resolveNextEpisodeDate(
  existing: string | null | undefined,
  incoming: string | null | undefined,
  mode: CatalogNextEpisodeMergeMode
): string | null {
  if (mode === 'fill-gaps') {
    return !isBlank(existing) ? (existing as string) : incoming ?? null;
  }
  return !isBlank(incoming) ? (incoming as string) : existing ?? null;
}
