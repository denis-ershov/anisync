import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AnimeCatalog } from '../src/lib/db/schema';
import {
  collectTitleKeys,
  matchCatalogByTitle,
  normalizeTitleKey,
} from '../src/lib/services/catalog-match';

function catalog(partial: Partial<AnimeCatalog> & Pick<AnimeCatalog, 'id' | 'titleDefault'>): AnimeCatalog {
  return {
    malId: null,
    titleEnglish: null,
    titleJapanese: null,
    titleRussian: null,
    licenseNameRu: null,
    synonyms: [],
    kind: null,
    rating: null,
    score: null,
    status: null,
    episodes: null,
    episodesAired: null,
    duration: null,
    airedOn: null,
    releasedOn: null,
    season: null,
    url: null,
    coverImage: null,
    nextEpisodeDate: null,
    isCensored: false,
    genres: [],
    studios: [],
    description: null,
    descriptionHtml: null,
    updatedAt: new Date(),
    createdAt: new Date(),
    ...partial,
  };
}

describe('catalog-match', () => {
  it('normalizes titles', () => {
    assert.equal(normalizeTitleKey('  Cowboy-Bebop!! '), 'cowboy bebop');
    assert.deepEqual([...collectTitleKeys({ titleDefault: 'Foo', synonyms: ['Bar'] })].sort(), [
      'bar',
      'foo',
    ]);
  });

  it('matches uniquely by title and year', () => {
    const candidates = [
      catalog({ id: 1, titleDefault: 'Cowboy Bebop', airedOn: '1998-04-03' }),
      catalog({ id: 2, titleDefault: 'Cowboy Bebop', airedOn: '2021-11-19' }),
    ];

    const hit = matchCatalogByTitle(
      {
        externalAnimeId: '99',
        titleDefault: 'Cowboy Bebop',
        airedOn: '1998-04-03',
      },
      candidates
    );

    assert.equal(hit?.id, 1);
  });

  it('returns null when ambiguous without year disambiguation', () => {
    const candidates = [
      catalog({ id: 1, titleDefault: 'Title', airedOn: '2020-01-01' }),
      catalog({ id: 2, titleDefault: 'Other', titleEnglish: 'Title', airedOn: '2021-06-01' }),
    ];

    const byYear = matchCatalogByTitle(
      {
        externalAnimeId: '1',
        titleDefault: 'Title',
        airedOn: '2020-01-01',
      },
      candidates
    );
    assert.equal(byYear?.id, 1);

    const ambiguous = matchCatalogByTitle(
      {
        externalAnimeId: '1',
        titleDefault: 'Title',
      },
      candidates
    );
    assert.equal(ambiguous, null);
  });
});
