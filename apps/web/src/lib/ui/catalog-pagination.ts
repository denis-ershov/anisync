export const CATALOG_PAGE_SIZES = [25, 50, 100] as const;

export type CatalogPageSize = (typeof CATALOG_PAGE_SIZES)[number];

export const DEFAULT_CATALOG_PAGE_SIZE: CatalogPageSize = 25;

/** Сетка постеров: 1 → 5 колонок. 5 делит 25/50/100 без «хвоста» на полной странице. */
export const catalogCardGridClassName = 'grid grid-cols-1 gap-3 sm:grid-cols-5';

/** Список: одна колонка — ровные строки без обрезки по ширине. */
export const catalogListGridClassName = 'grid grid-cols-1 gap-3';

export function isCatalogPageSize(value: number): value is CatalogPageSize {
  return (CATALOG_PAGE_SIZES as readonly number[]).includes(value);
}

export function toCatalogPageSize(value: number | string, fallback: CatalogPageSize = DEFAULT_CATALOG_PAGE_SIZE): CatalogPageSize {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return isCatalogPageSize(parsed) ? parsed : fallback;
}
