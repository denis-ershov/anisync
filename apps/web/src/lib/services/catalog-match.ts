import type { AnimeCatalog } from '@/lib/db';
import type { ProviderAnimeDetails } from '@/lib/integrations/provider-types';

/** Normalize titles for cross-provider matching when mal_id is missing. */
export function normalizeTitleKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || null;
}

export function collectTitleKeys(details: {
  titleDefault?: string | null;
  titleEnglish?: string | null;
  titleJapanese?: string | null;
  titleRussian?: string | null;
  synonyms?: string[] | null;
}): Set<string> {
  const keys = new Set<string>();
  for (const value of [
    details.titleDefault,
    details.titleEnglish,
    details.titleJapanese,
    details.titleRussian,
    ...(details.synonyms || []),
  ]) {
    const key = normalizeTitleKey(value);
    if (key) {
      keys.add(key);
    }
  }
  return keys;
}

export function extractYear(details: {
  airedOn?: string | null;
  releasedOn?: string | null;
  season?: string | null;
}): number | null {
  for (const raw of [details.airedOn, details.releasedOn]) {
    if (!raw) continue;
    const match = String(raw).match(/(\d{4})/);
    if (match) {
      return Number(match[1]);
    }
  }

  if (details.season) {
    const match = String(details.season).match(/(\d{4})/);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

export function catalogTitleKeys(catalog: AnimeCatalog): Set<string> {
  return collectTitleKeys({
    titleDefault: catalog.titleDefault,
    titleEnglish: catalog.titleEnglish,
    titleJapanese: catalog.titleJapanese,
    titleRussian: catalog.titleRussian,
    synonyms: catalog.synonyms,
  });
}

/**
 * Pick a single unambiguous catalog match by normalized title (+ year when available).
 * Returns null when 0 or 2+ candidates match.
 */
export function matchCatalogByTitle(
  details: ProviderAnimeDetails,
  candidates: AnimeCatalog[]
): AnimeCatalog | null {
  const keys = collectTitleKeys(details);
  if (!keys.size || !candidates.length) {
    return null;
  }

  const year = extractYear(details);
  const matches = candidates.filter((catalog) => {
    const catalogKeys = catalogTitleKeys(catalog);
    const titleHit = [...keys].some((key) => catalogKeys.has(key));
    if (!titleHit) {
      return false;
    }

    if (year) {
      const catalogYear = extractYear(catalog);
      if (catalogYear && catalogYear !== year) {
        return false;
      }
    }

    return true;
  });

  return matches.length === 1 ? matches[0] : null;
}
