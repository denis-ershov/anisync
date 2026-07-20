import type { LibraryEntryView, LibraryFilters } from './library-types';

function getEntryYear(entry: LibraryEntryView) {
  const year = entry.aired_on ? new Date(entry.aired_on).getFullYear() : Number.NaN;
  return Number.isFinite(year) ? year : null;
}

export function applyLibraryFilters(entries: LibraryEntryView[], filters?: LibraryFilters) {
  let mapped = [...entries];

  if (filters?.studio) {
    const needle = filters.studio.toLowerCase();
    mapped = mapped.filter((entry) => entry.studios.some((studio) => studio.name.toLowerCase().includes(needle)));
  }

  if (filters?.minRating !== undefined) {
    mapped = mapped.filter((entry) => entry.score >= filters.minRating!);
  }

  if (filters?.maxRating !== undefined) {
    mapped = mapped.filter((entry) => entry.score <= filters.maxRating!);
  }

  if (filters?.minYear !== undefined) {
    mapped = mapped.filter((entry) => {
      const year = getEntryYear(entry);
      return year !== null && year >= filters.minYear!;
    });
  }

  if (filters?.maxYear !== undefined) {
    mapped = mapped.filter((entry) => {
      const year = getEntryYear(entry);
      return year !== null && year <= filters.maxYear!;
    });
  }

  if (filters?.minEpisodes !== undefined) {
    mapped = mapped.filter((entry) => entry.episodes >= filters.minEpisodes!);
  }

  if (filters?.maxEpisodes !== undefined) {
    mapped = mapped.filter((entry) => entry.episodes <= filters.maxEpisodes!);
  }

  if (filters?.genres?.length) {
    const normalizedGenres = filters.genres.map((genre) => genre.toLowerCase());
    mapped = mapped.filter((entry) =>
      entry.genres.some((genre) => normalizedGenres.includes(genre.name.toLowerCase()))
    );
  }

  if (filters?.types?.length) {
    const normalizedTypes = filters.types.map((type) => type.toLowerCase());
    mapped = mapped.filter((entry) => entry.kind && normalizedTypes.includes(entry.kind.toLowerCase()));
  }

  return mapped;
}
