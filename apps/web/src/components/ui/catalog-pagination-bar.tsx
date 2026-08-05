'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CATALOG_PAGE_SIZES,
  type CatalogPageSize,
  toCatalogPageSize,
} from '@/lib/ui/catalog-pagination';
import { cn } from '@/lib/utils';

type CatalogPaginationBarProps = {
  page: number;
  pageSize: CatalogPageSize;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  /** Если известен — показываем «N / total». */
  totalPages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: CatalogPageSize) => void;
  className?: string;
  /** Скрыть блок, если данных меньше минимального pageSize и одна страница. */
  hidden?: boolean;
};

export function CatalogPaginationBar({
  page,
  pageSize,
  hasPreviousPage,
  hasNextPage,
  totalPages,
  onPageChange,
  onPageSizeChange,
  className,
  hidden = false,
}: CatalogPaginationBarProps) {
  const t = useTranslations('CatalogPagination');

  if (hidden) {
    return null;
  }

  const pageLabel =
    totalPages != null && totalPages > 0
      ? t('pageOf', { page, total: totalPages })
      : t('page', { page });

  return (
    <div
      className={cn(
        'flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex min-h-11 items-center gap-2">
        <label htmlFor="catalog-page-size" className="shrink-0 text-sm text-muted-foreground">
          {t('pageSize')}
        </label>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(toCatalogPageSize(value, pageSize))}
        >
          <SelectTrigger id="catalog-page-size" className="min-h-11 w-[5.5rem]" aria-label={t('pageSize')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATALOG_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={!hasPreviousPage}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('prev')}
        </Button>
        <span className="text-center text-sm text-muted-foreground">{pageLabel}</span>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          {t('next')}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
