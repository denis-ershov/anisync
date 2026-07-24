import test from 'node:test';
import assert from 'node:assert/strict';

import { applyLibraryFilters } from '@/lib/services/library-filters';
import type { LibraryEntryView } from '@/lib/services/library-types';

const entries: LibraryEntryView[] = [
  {
    id: 1,
    animeId: 101,
    sourceService: 'shikimori',
    sourceEntryId: 'a1',
    externalAnimeId: '101',
    malId: 101,
    title: 'Attack on Titan',
    title_en: 'Attack on Titan',
    title_jp: null,
    license_name_ru: null,
    synonyms: [],
    kind: 'tv',
    rating: 'r',
    score: 9,
    status: 'released',
    episodes: 24,
    episodes_aired: 24,
    duration: 24,
    aired_on: '2013-04-01',
    released_on: '2013-04-01',
    season: 'spring_2013',
    url: null,
    cover_image: '',
    next_episode_date: null,
    is_censored: false,
    genres: [{ id: '1', name: 'Action' }],
    studios: [{ id: '1', name: 'Wit Studio' }],
    description: '',
    description_html: null,
    watched_episodes: 24,
    watch_status: 'completed',
    personal_rating: 10,
    user_rate_id: '1',
    source: 'shikimori',
    serviceLinks: [],
    user_notes: '',
    is_favorite: true,
    is_not_interested: false,
    out_of_sync: false,
    sync_state: 'synced',
  },
  {
    id: 2,
    animeId: 202,
    sourceService: 'anilist',
    sourceEntryId: 'a2',
    externalAnimeId: '202',
    malId: 202,
    title: 'Your Name',
    title_en: 'Your Name',
    title_jp: null,
    license_name_ru: null,
    synonyms: [],
    kind: 'movie',
    rating: 'pg_13',
    score: 8.5,
    status: 'released',
    episodes: 1,
    episodes_aired: 1,
    duration: 106,
    aired_on: '2016-08-26',
    released_on: '2016-08-26',
    season: 'summer_2016',
    url: null,
    cover_image: '',
    next_episode_date: null,
    is_censored: false,
    genres: [{ id: '2', name: 'Romance' }],
    studios: [{ id: '2', name: 'CoMix Wave Films' }],
    description: '',
    description_html: null,
    watched_episodes: 0,
    watch_status: 'planned',
    personal_rating: null,
    user_rate_id: '2',
    source: 'anilist',
    serviceLinks: [],
    user_notes: '',
    is_favorite: false,
    is_not_interested: false,
    out_of_sync: false,
    sync_state: 'synced',
  },
];

test('applyLibraryFilters combines genre, type, year and episode filters', () => {
  const result = applyLibraryFilters(entries, {
    genres: ['Action'],
    types: ['TV'],
    minYear: 2010,
    maxYear: 2014,
    minEpisodes: 12,
    maxEpisodes: 30,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, 'Attack on Titan');
});

test('applyLibraryFilters supports studio and rating filters', () => {
  const result = applyLibraryFilters(entries, {
    studio: 'wave',
    minRating: 8,
    maxRating: 9,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, 'Your Name');
});
