import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CATALOG_PAGE_SIZES,
  DEFAULT_CATALOG_PAGE_SIZE,
  isCatalogPageSize,
  toCatalogPageSize,
} from '../src/lib/ui/catalog-pagination';

test('catalog page sizes are 25/50/100 and divisible by 5-column grid', () => {
  assert.deepEqual([...CATALOG_PAGE_SIZES], [25, 50, 100]);
  for (const size of CATALOG_PAGE_SIZES) {
    assert.equal(size % 5, 0);
  }
  assert.equal(DEFAULT_CATALOG_PAGE_SIZE, 25);
});

test('toCatalogPageSize validates and falls back', () => {
  assert.equal(isCatalogPageSize(25), true);
  assert.equal(isCatalogPageSize(24), false);
  assert.equal(toCatalogPageSize('50'), 50);
  assert.equal(toCatalogPageSize('7'), DEFAULT_CATALOG_PAGE_SIZE);
});
