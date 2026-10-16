import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STALE_TORRENT_METADATA_MS,
  DEFAULT_TORRENT_METADATA_REFRESH_FIELDS,
  normalizeRefreshFields,
  computeMetadataUpdate,
} from '@/lib/services/torrent-metadata-refresh-service';

test('STALE_TORRENT_METADATA_MS defaults to 24 hours', () => {
  assert.equal(STALE_TORRENT_METADATA_MS, 86_400_000);
});

test('normalizeRefreshFields returns defaults when undefined or invalid', () => {
  assert.deepEqual(normalizeRefreshFields(undefined), DEFAULT_TORRENT_METADATA_REFRESH_FIELDS);
  assert.deepEqual(normalizeRefreshFields(null), DEFAULT_TORRENT_METADATA_REFRESH_FIELDS);
  assert.deepEqual(normalizeRefreshFields('invalid'), DEFAULT_TORRENT_METADATA_REFRESH_FIELDS);

  // Filters out unknown field strings
  assert.deepEqual(normalizeRefreshFields(['ratings', 'unknown_field', 'posters']), [
    'ratings',
    'posters',
  ]);
});

test('computeMetadataUpdate updates ONLY ratings and posters when configured', () => {
  const existingRow = {
    id: 42,
    userId: 1,
    imdbId: 'tt0133093',
    title: 'Custom User Title',
    originalTitle: 'The Matrix Original',
    type: 'movie' as const,
    enabled: true,
    posterUrl: 'http://old.poster/old.jpg',
    year: '1998',
    genre: 'My Custom Genre',
    plot: 'My custom plot summary',
    rating: '7.5',
    runtime: '130 min',
    targetSeason: 2,
    preferredQuality: '2160p HDR (4K)',
    preferredAudio: 'LostFilm',
    maxReleasesCount: 1,
    checkInterval: 30,
    notifyOnce: true,
    pinnedReleaseKey: 'hash123',
    pinnedReleaseAliases: null,
    pinnedReleaseTitle: 'The.Matrix.1999.UHD',
    tmdbId: 603,
    lastChecked: null,
    totalSeasons: 1,
    totalEpisodes: 1,
    lastNotifiedSeason: 0,
    lastNotifiedEpisode: 0,
    seasonEpisodeCount: null,
    telegramChatId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const freshMetadata = {
    title: 'The Matrix (TMDB Official)',
    originalTitle: 'The Matrix',
    type: 'movie' as const,
    posterUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
    year: '1999',
    genre: 'Action, Sci-Fi',
    plot: 'A computer hacker learns from mysterious rebels about the true nature of his reality...',
    rating: '8.7',
    runtime: '136 min',
    totalSeasons: 4,
    totalEpisodes: 4,
    tmdbId: 603,
  };

  // Only ratings and posters selected
  const update = computeMetadataUpdate(existingRow, freshMetadata, ['ratings', 'posters']);

  assert.equal(update.posterUrl, 'https://image.tmdb.org/t/p/w500/matrix.jpg');
  assert.equal(update.rating, '8.7');

  // Other fields MUST NOT be present in update
  assert.equal(update.genre, undefined);
  assert.equal(update.title, undefined);
  assert.equal(update.originalTitle, undefined);
  assert.equal(update.plot, undefined);
  assert.equal(update.year, undefined);
  assert.equal(update.runtime, undefined);
  assert.equal(update.totalSeasons, undefined);
  assert.equal(update.totalEpisodes, undefined);
});

test('computeMetadataUpdate updates ONLY categories/genres when configured', () => {
  const existingRow = {
    id: 10,
    userId: 2,
    imdbId: 'tt0903747',
    title: 'Во все тяжкие',
    originalTitle: 'Breaking Bad',
    type: 'tv' as const,
    enabled: true,
    posterUrl: 'https://old.poster/bb.jpg',
    year: '2008',
    genre: 'Драма',
    plot: 'Старое описание сериала...',
    rating: '8.9',
    runtime: '47 min',
    targetSeason: 5,
    preferredQuality: '1080p',
    preferredAudio: 'Кубик в Кубе',
    maxReleasesCount: 3,
    checkInterval: 60,
    notifyOnce: false,
    pinnedReleaseKey: null,
    pinnedReleaseAliases: null,
    pinnedReleaseTitle: null,
    tmdbId: 1396,
    lastChecked: null,
    totalSeasons: 5,
    totalEpisodes: 62,
    lastNotifiedSeason: 0,
    lastNotifiedEpisode: 0,
    seasonEpisodeCount: null,
    telegramChatId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const freshMetadata = {
    title: 'Во все тяжкие (Новое)',
    originalTitle: 'Breaking Bad',
    type: 'tv' as const,
    posterUrl: 'https://image.tmdb.org/t/p/w500/new_bb.jpg',
    year: '2008',
    genre: 'Криминал, Драма, Триллер',
    plot: 'Школьный учитель химии...',
    rating: '9.5',
    runtime: '49 min',
    totalSeasons: 5,
    totalEpisodes: 62,
    tmdbId: 1396,
  };

  // Only genres selected
  const update = computeMetadataUpdate(existingRow, freshMetadata, ['genres']);

  assert.equal(update.genre, 'Криминал, Драма, Триллер');
  assert.equal(update.posterUrl, undefined);
  assert.equal(update.rating, undefined);
  assert.equal(update.plot, undefined);
  assert.equal(update.title, undefined);
  assert.equal(update.runtime, undefined);
});

test('computeMetadataUpdate with empty fields array makes no changes', () => {
  const existingRow = {
    id: 1,
    userId: 1,
    imdbId: 'tt1234567',
    title: 'Title',
    originalTitle: 'Original',
    type: 'movie' as const,
    enabled: true,
    posterUrl: 'http://poster',
    year: '2020',
    genre: 'Drama',
    plot: 'Plot',
    rating: '7.0',
    runtime: '100 min',
    targetSeason: null,
    preferredQuality: null,
    preferredAudio: null,
    maxReleasesCount: null,
    checkInterval: null,
    notifyOnce: false,
    pinnedReleaseKey: null,
    pinnedReleaseAliases: null,
    pinnedReleaseTitle: null,
    tmdbId: 100,
    lastChecked: null,
    totalSeasons: null,
    totalEpisodes: null,
    lastNotifiedSeason: 0,
    lastNotifiedEpisode: 0,
    seasonEpisodeCount: null,
    telegramChatId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const freshMetadata = {
    title: 'New Title',
    originalTitle: 'New Original',
    type: 'movie' as const,
    posterUrl: 'http://new-poster',
    year: '2021',
    genre: 'Comedy',
    plot: 'New Plot',
    rating: '9.0',
    runtime: '120 min',
    totalSeasons: null,
    totalEpisodes: null,
    tmdbId: 100,
  };

  const update = computeMetadataUpdate(existingRow, freshMetadata, []);
  assert.deepEqual(update, {});
});

test('computeMetadataUpdate assigns tmdbId if currently missing in row', () => {
  const existingRowWithoutTmdb = {
    id: 1,
    userId: 1,
    imdbId: 'tt1234567',
    title: 'Title',
    originalTitle: 'Original',
    type: 'movie' as const,
    enabled: true,
    posterUrl: 'http://poster',
    year: '2020',
    genre: 'Drama',
    plot: 'Plot',
    rating: '7.0',
    runtime: '100 min',
    targetSeason: null,
    preferredQuality: null,
    preferredAudio: null,
    maxReleasesCount: null,
    checkInterval: null,
    notifyOnce: false,
    pinnedReleaseKey: null,
    pinnedReleaseAliases: null,
    pinnedReleaseTitle: null,
    tmdbId: null, // missing!
    lastChecked: null,
    totalSeasons: null,
    totalEpisodes: null,
    lastNotifiedSeason: 0,
    lastNotifiedEpisode: 0,
    seasonEpisodeCount: null,
    telegramChatId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const update = computeMetadataUpdate(
    existingRowWithoutTmdb,
    { tmdbId: 9999, rating: '8.5' },
    ['ratings']
  );

  assert.equal(update.rating, '8.5');
  assert.equal(update.tmdbId, 9999);
});

test('Stale row filtering detects entries older than threshold', () => {
  const now = Date.now();
  const thresholdMs = 86_400_000; // 24 hours
  const staleBefore = new Date(now - thresholdMs);

  const rows = [
    { id: 1, updatedAt: new Date(now - 100_000_000) }, // Stale (> 27h)
    { id: 2, updatedAt: new Date(now - 10_000) }, // Fresh (10s)
    { id: 3, updatedAt: null }, // Stale (never updated)
  ];

  const staleRows = rows.filter((r) => !r.updatedAt || r.updatedAt < staleBefore);
  assert.deepEqual(staleRows.map((r) => r.id), [1, 3]);
});
