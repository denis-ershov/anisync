import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReleaseContentHash,
  computeReleaseIdentity,
  extractInfoHashFromMagnet,
} from '@/lib/torrents/watcher/identity';
import {
  buildSearchQueries,
  filterReleasesByPreferences,
  filterResultsByImdbOrTitle,
  filterResultsBySeason,
  hasBadAudioMarkers,
  hasJunkReleaseMarkers,
  isRussianTitleOrigin,
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

test('extractSeasonFromTitle parses S4E1-6 of 10 and S1E1-5', () => {
  assert.equal(
    extractSeasonFromTitle(
      'Тед Лассо / Ted Lasso  / S4E1-6 of 10 (2026) WEB-DL [H.265/2160p] [4K, SDR, 10-bit]  Red Head Sound, NewComers, HDrezka, AlexFilm, TVShows, ViruseProject (Обновляемая)'
    ),
    4
  );
  assert.equal(
    extractSeasonFromTitle(
      'Фонари / Lanterns  / S1E1-5 of 8 (2026) WEB-DL [H.265/2160p] [4K, SDR, 8-bit]  HBO, HDRezka Studio, Kubik, LostFilm, NewComers, TVShows, Red Head Sound, WinMedia (обновляемая)'
    ),
    1
  );
});

test('matchesPreferredAudio matches real voice studios and multi-track releases', () => {
  const tedLasso = {
    title:
      'Тед Лассо / Ted Lasso  / S4E1-6 of 10 (2026) WEB-DL [H.265/2160p] [4K, SDR, 10-bit]  Red Head Sound, NewComers, HDrezka, AlexFilm, TVShows, ViruseProject (Обновляемая)',
  };
  assert.equal(matchesPreferredAudio(tedLasso, 'russian'), true);
  assert.equal(matchesPreferredAudio(tedLasso, 'Red Head Sound'), true);
  assert.equal(matchesPreferredAudio(tedLasso, 'HDrezka'), true);

  const lanterns = {
    title:
      'Фонари / Lanterns  / S1E1-5 of 8 (2026) WEB-DL [H.265/2160p] [4K, SDR, 8-bit]  HBO, HDRezka Studio, Kubik, LostFilm, NewComers, TVShows, Red Head Sound, WinMedia (обновляемая)',
  };
  assert.equal(matchesPreferredAudio(lanterns, 'russian'), true);
  assert.equal(matchesPreferredAudio(lanterns, 'LostFilm'), true);

  const dragonMoney = {
    title: 'Фильм (2026) WEB-DL 1080p Dragon Money Studio',
  };
  assert.equal(matchesPreferredAudio(dragonMoney, 'russian'), true);

  const syncmer = {
    title: 'Show (2026) S01E01 WEB-DL Syncmer',
  };
  assert.equal(matchesPreferredAudio(syncmer, 'russian'), true);

  const tvoe = {
    title: 'Show (2026) S01 WEB-DL Дубляж (TVOЁ)',
  };
  assert.equal(matchesPreferredAudio(tvoe, 'russian'), true);
});

test('matchesPreferredAudio recognizes domestic Russian cinema (Холоп 3) for both russian and original', () => {
  const kholop3 = {
    title: 'Холоп 3 (2026) WEBRip [H.264/1080p]',
  };
  const context = { isRussianOrigin: true };

  assert.equal(isRussianTitleOrigin('Холоп 3', 'Холоп 3'), true);
  assert.equal(isRussianTitleOrigin('Мастер и Маргарита', 'Мастер и Маргарита'), true);
  assert.equal(isRussianTitleOrigin('Тед Лассо', 'Ted Lasso'), false);

  assert.equal(matchesPreferredAudio(kholop3, 'russian', context), true);
  assert.equal(matchesPreferredAudio(kholop3, 'original', context), true);
  assert.equal(matchesPreferredAudio(kholop3, 'any', context), true);
});

test('matchesPreferredAudio matches original scene releases from international trackers', () => {
  const ytsRelease = {
    title: 'Dune.Part.Two.2024.1080p.WEBRip.x264.AAC5.1-[YTS.MX]',
    indexer: 'YTS',
  };
  assert.equal(matchesPreferredAudio(ytsRelease, 'original'), true);

  const sceneRelease = {
    title: 'Severance.S01.1080p.ATVP.WEB-DL.DDP5.1.Atmos.H.264-FLUX',
    indexer: '1337x',
  };
  assert.equal(matchesPreferredAudio(sceneRelease, 'original'), true);
});

test('filterResultsByImdbOrTitle normalizes letter ё to е for Russian titles', () => {
  const releases = [
    {
      title: 'Сто лет тому вперед (2024) WEB-DL 1080p',
    },
  ];
  const filtered = filterResultsByImdbOrTitle(
    releases,
    'tt2999999',
    'Сто лет тому вперёд',
    'Сто лет тому вперёд',
    '2024',
    'movie'
  );
  assert.equal(filtered.length, 1);
  assert.match(filtered[0].title ?? '', /вперед/);
});

test('filterResultsByImdbOrTitle matches multipart titles with subtitles (Слово пацана)', () => {
  const releases = [
    {
      title: 'Слово пацана (1 сезон: 1-8 серии) (2023) WEB-DL 1080p',
    },
  ];
  const filtered = filterResultsByImdbOrTitle(
    releases,
    'tt28280054',
    'Слово пацана. Кровь на асфальте',
    'Слово пацана. Кровь на асфальте',
    '2023',
    'tv'
  );
  assert.equal(filtered.length, 1);
});

test('buildSearchQueries generates queries for domestic TV series with season variants', () => {
  const queries = buildSearchQueries({
    imdbId: 'tt28280054',
    title: 'Слово пацана. Кровь на асфальте',
    originalTitle: 'Слово пацана. Кровь на асфальте',
    itemType: 'tv',
    year: '2023',
    targetSeason: 1,
  });

  assert.ok(queries.some((q) => q.includes('1 сезон')));
  assert.ok(queries.some((q) => q.includes('сезон 1')));
  assert.ok(queries.some((q) => q.includes('s01')));
  assert.ok(queries.some((q) => q.startsWith('Слово пацана')));
});

test('filterResultsByImdbOrTitle and filterReleasesByPreferences correctly process Холоп 3 and sequels', () => {
  const prowlarrReleases = [
    {
      title: 'Холоп 3 (2026) WEBRip [H.264/2160p] [4K, SDR, 8 bit]',
      indexer: 'NoNaMe Club',
    },
    {
      title: '3 (2026) WEBRip 1080p RUS',
      indexer: 'BigFANGroup',
    },
    {
      title: 'Холоп 3 (2026) WEBRip [H.264/1080p]',
      indexer: 'NoNaMe Club',
    },
    {
      title: 'Холоп III (2026) WEBRip [H.264/1080p]',
      indexer: 'NoNaMe Club',
    },
    {
      title: 'Холоп (2019) BDRip 1080p',
      indexer: 'NoNaMe Club',
    },
  ];

  // 1. Поиск для фильма «Холоп 3» (2026)
  const matchedForKholop3 = filterResultsByImdbOrTitle(
    prowlarrReleases,
    'tt_kholop3',
    'Холоп 3',
    'Холоп 3',
    '2026',
    'movie'
  );

  // Должны совпасть обе раздачи с NNM-Club (2160p и 1080p), а также римская запись Холоп III
  // Фильм первой части (Холоп 2019) не должен попасть!
  const titlesMatched = matchedForKholop3.map((r) => r.title);
  assert.ok(titlesMatched.includes('Холоп 3 (2026) WEBRip [H.264/2160p] [4K, SDR, 8 bit]'));
  assert.ok(titlesMatched.includes('Холоп 3 (2026) WEBRip [H.264/1080p]'));
  assert.ok(titlesMatched.includes('Холоп III (2026) WEBRip [H.264/1080p]'));
  assert.equal(titlesMatched.includes('Холоп (2019) BDRip 1080p'), false);

  // 2. Проверяем настройки: Качество «1080p, 2160p SDR», Озвучка «russian»
  const filteredPreferences = filterReleasesByPreferences(
    matchedForKholop3,
    '1080p, 2160p SDR',
    'russian',
    { isRussianOrigin: true }
  );

  const prefTitles = filteredPreferences.map((r) => r.title);
  assert.ok(prefTitles.includes('Холоп 3 (2026) WEBRip [H.264/2160p] [4K, SDR, 8 bit]'));
  assert.ok(prefTitles.includes('Холоп 3 (2026) WEBRip [H.264/1080p]'));
  assert.ok(prefTitles.includes('Холоп III (2026) WEBRip [H.264/1080p]'));

  // 3. Защита сиквелов: поиск для первой части «Холоп» (2019) НЕ должен находить «Холоп 3»
  const matchedForKholop1 = filterResultsByImdbOrTitle(
    prowlarrReleases,
    'tt_kholop1',
    'Холоп',
    'Холоп',
    '2019',
    'movie'
  );
  assert.equal(matchedForKholop1.length, 1);
  assert.equal(matchedForKholop1[0].title, 'Холоп (2019) BDRip 1080p');
});


