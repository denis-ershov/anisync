import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAllowedCatalogGenreIds,
  mappedGenreIdForType,
  paginateCatalogItems,
} from '../src/lib/integrations/tmdb/client';

test('paginateCatalogItems returns the offset slice for the requested page', () => {
  const items = Array.from({ length: 75 }, (_, index) => index + 1);

  assert.deepEqual(paginateCatalogItems(items, 1, 25), items.slice(0, 25));
  assert.deepEqual(paginateCatalogItems(items, 2, 25), items.slice(25, 50));
  assert.deepEqual(paginateCatalogItems(items, 3, 25), items.slice(50, 75));
});

test('isAllowedCatalogGenreIds excludes anime, non-scripted TV, concerts and documentaries', () => {
  assert.equal(isAllowedCatalogGenreIds('movie', [28, 16]), false);
  assert.equal(isAllowedCatalogGenreIds('movie', [10402]), false);
  assert.equal(isAllowedCatalogGenreIds('movie', [18, 53]), true);
  assert.equal(isAllowedCatalogGenreIds('show', [10764]), false);
  assert.equal(isAllowedCatalogGenreIds('show', [10767]), false);
  assert.equal(isAllowedCatalogGenreIds('show', [18, 9648]), true);
});

test('mappedGenreIdForType maps common movie and TV genre ids for mixed catalog filtering', () => {
  assert.equal(mappedGenreIdForType('show', 28), 10759);
  assert.equal(mappedGenreIdForType('show', 878), 10765);
  assert.equal(mappedGenreIdForType('movie', 10759), 28);
  assert.equal(mappedGenreIdForType('movie', 10765), 878);
  assert.equal(mappedGenreIdForType('movie', 18), 18);
});
