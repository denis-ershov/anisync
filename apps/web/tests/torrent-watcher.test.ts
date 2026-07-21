import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReleaseContentHash,
  computeReleaseIdentity,
  extractInfoHashFromMagnet,
} from '@/lib/torrents/watcher/identity';
import {
  buildSearchQueries,
  filterResultsByImdbOrTitle,
  filterResultsBySeason,
  hasBadAudioMarkers,
  hasJunkReleaseMarkers,
  matchesPreferredAudio,
} from '@/lib/torrents/watcher/filters';
import { extractEpisodeInfo, extractSeasonFromTitle } from '@/lib/torrents/watcher/parsers';
import { torrentBytesToMagnet } from '@/lib/torrents/watcher/torrent-file';
import { shouldAdoptExistingRelease } from '@/lib/services/torrent-watcher-service';

test('extractInfoHashFromMagnet parses btih', () => {
  const hash = extractInfoHashFromMagnet(
    'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=test'
  );
  assert.equal(hash, '0123456789abcdef0123456789abcdef01234567');
});

test('buildReleaseContentHash is stable for whitespace', () => {
  const a = buildReleaseContentHash(100, 'Title   Extra');
  const b = buildReleaseContentHash(100, 'Title Extra');
  assert.equal(a.contentHash, b.contentHash);
  assert.notEqual(a.contentHash, a.legacyHash);
});

test('computeReleaseIdentity prefers magnet btih', () => {
  const { primary } = computeReleaseIdentity({
    magnetUrl: 'magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    guid: 'http://example/t=1',
    indexer: 'RuTracker',
  });
  assert.equal(primary, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
});

test('extractSeasonFromTitle handles RU/EN', () => {
  assert.equal(extractSeasonFromTitle('Show 4 сезон'), 4);
  assert.equal(extractSeasonFromTitle('Show Season 3'), 3);
  assert.equal(extractSeasonFromTitle('Show S02'), 2);
});

test('extractEpisodeInfo ranges', () => {
  assert.deepEqual(extractEpisodeInfo('Series S01E01-05 of 10'), { current: 5, total: 10 });
  assert.deepEqual(extractEpisodeInfo('Series S03E05 WEBDL'), { current: 5, total: null });
});

test('filterResultsBySeason keeps matching season', () => {
  const filtered = filterResultsBySeason(
    [{ title: 'Show S02E01' }, { title: 'Show S01E01' }, { title: 'Show without season' }],
    2
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, 'Show S02E01');
});

test('hasJunkReleaseMarkers filters cam/ts/hdts and keeps clean releases', () => {
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie CAM audio' }), true);
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie 2025 HDTS 1080p' }), true);
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie 2025.TS.720p' }), true);
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie [TS] 1080p' }), true);
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie CAMRip' }), true);
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie TELESYNC' }), true);
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie WEB-DL 1080p' }), false);
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie BluRay Remux DTS-HD' }), false);
  assert.equal(hasJunkReleaseMarkers({ title: 'Movie HDTV 720p' }), false);
});

test('hasBadAudioMarkers detects cam/ts', () => {
  assert.equal(hasBadAudioMarkers({ title: 'Movie CAM audio' }), true);
  assert.equal(hasBadAudioMarkers({ title: 'Movie WEB-DL 1080p' }), false);
});

test('buildSearchQueries embeds year and skips yearless movie queries', () => {
  const movieQueries = buildSearchQueries({
    imdbId: 'tt1',
    originalTitle: 'Carrie',
    title: 'Кэрри',
    itemType: 'movie',
    year: '2013',
  });
  assert.ok(movieQueries.every((q) => q.includes('2013')));
  assert.ok(movieQueries.some((q) => q.includes('Carrie')));
  assert.equal(
    movieQueries.some((q) => q === 'Carrie' || q === 'Кэрри'),
    false
  );

  const tvQueries = buildSearchQueries({
    imdbId: 'tt1',
    originalTitle: 'Show',
    itemType: 'tv',
    year: '2024',
    targetSeason: 2,
  });
  assert.ok(tvQueries.some((q) => q.includes('сезон 2')));
  assert.ok(tvQueries.some((q) => q.includes('s02')));
  assert.ok(tvQueries.every((q) => q.includes('2024')));
});

test('filterResultsByImdbOrTitle rejects wrong-year remakes', () => {
  const releases = [
    {
      title:
        'Кэрри / Carrie (Брайан Де Пальма / Brian De Palma) [1976, США, ужасы, триллер, BDRip-AVC] AVO (Михаил Иванов)',
    },
    {
      title: 'Кэрри / Carrie (2013) WEB-DL 1080p',
    },
  ];
  const filtered = filterResultsByImdbOrTitle(
    releases,
    'tt1939659',
    'Кэрри',
    'Carrie',
    '2013',
    'movie'
  );
  assert.equal(filtered.length, 1);
  assert.match(filtered[0].title ?? '', /2013/);
});

test('matchesPreferredAudio rejects subtitle-only СТ for russian', () => {
  assert.equal(
    matchesPreferredAudio(
      {
        title:
          'Вверх по волшебному дереву / The Magic Faraway Tree / 2026 / СТ / WEBRip (1080p)',
      },
      'russian'
    ),
    false
  );
  assert.equal(
    matchesPreferredAudio(
      {
        title:
          'Кэрри / Carrie [2013] BDRip-AVC] AVO (Михаил Иванов)',
      },
      'russian'
    ),
    true
  );
  assert.equal(
    matchesPreferredAudio(
      { title: 'Movie 2024 WEB-DL 1080p Dub' },
      'russian'
    ),
    false
  );
});

test('torrentBytesToMagnet hashes exact bencoded info dictionary', () => {
  const torrent = Buffer.from('d4:infod4:name4:test6:lengthi1eee');
  const magnet = torrentBytesToMagnet(torrent);
  assert.match(
    magnet ?? '',
    /^magnet:\?xt=urn:btih:[0-9a-f]{40}&dn=test$/
  );
  assert.equal(torrentBytesToMagnet(Buffer.from('not-a-torrent')), null);
});

test('hunting adopts an existing never-notified release exactly once', () => {
  assert.equal(
    shouldAdoptExistingRelease({
      huntingMode: true,
      sameContent: true,
      notificationCount: 0,
    }),
    true
  );
  assert.equal(
    shouldAdoptExistingRelease({
      huntingMode: true,
      sameContent: true,
      notificationCount: 1,
    }),
    false
  );
});
