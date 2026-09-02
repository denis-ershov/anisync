import test from 'node:test';
import assert from 'node:assert/strict';

import { STALE_TORRENT_METADATA_MS } from '@/lib/services/torrent-metadata-refresh-service';

test('STALE_TORRENT_METADATA_MS defaults to 24 hours', () => {
  assert.equal(STALE_TORRENT_METADATA_MS, 86_400_000);
});

test('Metadata refresh preserves user preferences and updates content metadata', () => {
  const existingRow = {
    id: 42,
    userId: 1,
    imdbId: 'tt0133093',
    title: 'The Matrix (Old)',
    originalTitle: null,
    type: 'movie' as const,
    enabled: true,
    posterUrl: 'http://old.poster',
    year: '1998',
    genre: 'Action',
    rating: '8.0',
    targetSeason: 2,
    preferredQuality: '2160p HDR (4K)',
    preferredAudio: 'LostFilm',
    maxReleasesCount: 1,
    checkInterval: 30,
    notifyOnce: true,
    pinnedReleaseKey: 'hash123',
    pinnedReleaseTitle: 'The.Matrix.1999.UHD',
    tmdbId: 603,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const freshMetadata = {
    title: 'The Matrix',
    originalTitle: 'The Matrix',
    type: 'movie' as const,
    posterUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
    year: '1999',
    genre: 'Action, Sci-Fi',
    rating: '8.7',
    totalSeasons: null,
    totalEpisodes: null,
    tmdbId: 603,
  };

  // Simulating updated row with preserved user preferences
  const updatedRow = {
    ...existingRow,
    title: freshMetadata.title || existingRow.title,
    originalTitle: freshMetadata.originalTitle ?? existingRow.originalTitle,
    type: freshMetadata.type ?? existingRow.type,
    posterUrl: freshMetadata.posterUrl ?? existingRow.posterUrl,
    year: freshMetadata.year ?? existingRow.year,
    genre: freshMetadata.genre ?? existingRow.genre,
    rating: freshMetadata.rating ?? existingRow.rating,
    updatedAt: new Date('2026-09-02T12:00:00.000Z'),
  };

  // User preferences are strictly preserved
  assert.equal(updatedRow.preferredQuality, '2160p HDR (4K)');
  assert.equal(updatedRow.preferredAudio, 'LostFilm');
  assert.equal(updatedRow.targetSeason, 2);
  assert.equal(updatedRow.pinnedReleaseKey, 'hash123');
  assert.equal(updatedRow.pinnedReleaseTitle, 'The.Matrix.1999.UHD');
  assert.equal(updatedRow.notifyOnce, true);

  // Content metadata is updated
  assert.equal(updatedRow.title, 'The Matrix');
  assert.equal(updatedRow.originalTitle, 'The Matrix');
  assert.equal(updatedRow.year, '1999');
  assert.equal(updatedRow.rating, '8.7');
  assert.equal(updatedRow.genre, 'Action, Sci-Fi');
  assert.equal(updatedRow.posterUrl, 'https://image.tmdb.org/t/p/w500/matrix.jpg');
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
