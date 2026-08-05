export const CATALOG_PAGE_SIZES = [25, 50, 100] as const;

export type CatalogPageSize = (typeof CATALOG_PAGE_SIZES)[number];

export const DEFAULT_CATALOG_PAGE_SIZE: CatalogPageSize = 25;

export function isCatalogPageSize(value: number): value is CatalogPageSize {
  return (CATALOG_PAGE_SIZES as readonly number[]).includes(value);
}

export function toCatalogPageSize(value: number | string, fallback: CatalogPageSize = DEFAULT_CATALOG_PAGE_SIZE): CatalogPageSize {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return isCatalogPageSize(parsed) ? parsed : fallback;
}
