import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReleaseContentHash,
  computeReleaseIdentity,
  extractInfoHashFromMagnet,
} from '@/lib/torrents/watcher/identity';
import {
  buildSearchQueries,
  detectReleaseQuality,
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

test('filterResultsBySeason matches Season 1 for unlabelled packs but rejects Season 2+', () => {
  const releases = [
    { title: 'Квест Вижна (2021) WEB-DL 1080p' },
    { title: 'Vision Quest S01 1080p' },
    { title: 'Vision Quest S02 1080p' },
  ];

  // Для 1 сезона: пропускает и явный S01, и релиз без явной метки сезона
  const season1 = filterResultsBySeason(releases, 1);
  assert.equal(season1.length, 2);
  assert.ok(season1.some((r) => r.title === 'Квест Вижна (2021) WEB-DL 1080p'));
  assert.ok(season1.some((r) => r.title === 'Vision Quest S01 1080p'));

  // Для 2 сезона: берет только S02, отсекая релиз без метки
  const season2 = filterResultsBySeason(releases, 2);
  assert.equal(season2.length, 1);
  assert.equal(season2[0].title, 'Vision Quest S02 1080p');
});

test('filterResultsBySeason handles Cyrillic С/Е (U+0441/U+0435) in season markers', () => {
  const releases = [
    // Кириллические С и Е в маркере сезона
    { title: 'МобЛэнд / MobLand / С03Е01 из 10 (2026) WEB-DL 1080p' },
    { title: 'МобЛэнд / MobLand / С4Е1-6 of 10 (2026) WEB-DL 2160p' },
    { title: 'Show С01 1080p' },
    { title: 'Show S02E01 1080p' },
  ];

  const season3 = filterResultsBySeason(releases, 3);
  assert.equal(season3.length, 1);
  assert.ok(season3[0]!.title!.includes('С03Е01'));

  const season4 = filterResultsBySeason(releases, 4);
  assert.equal(season4.length, 1);
  assert.ok(season4[0]!.title!.includes('С4Е1'));

  const season1 = filterResultsBySeason(releases, 1);
  assert.equal(season1.length, 1);
  assert.ok(season1[0]!.title!.includes('С01'));

  const season2 = filterResultsBySeason(releases, 2);
  assert.equal(season2.length, 1);
  assert.ok(season2[0]!.title!.includes('S02'));
});

test('filterResultsBySeason handles NxMM format (EZTV-style: 3x01, 03x12)', () => {
  const releases = [
    { title: 'The.Show.3x01.720p.WEB-DL' },
    { title: 'The.Show.3x12.1080p.HDTV' },
    { title: 'The.Show.1x08.720p.WEB-DL' },
    { title: 'The.Show.S02E01.1080p' },
  ];

  const season3 = filterResultsBySeason(releases, 3);
  assert.equal(season3.length, 2);
  assert.ok(season3.every((r) => r.title!.includes('3x')));

  const season1 = filterResultsBySeason(releases, 1);
  assert.equal(season1.length, 1);
  assert.ok(season1[0]!.title!.includes('1x08'));
});

test('filterResultsBySeason handles "(N сезон: серии)" format from Russian trackers', () => {
  const releases = [
    { title: 'Тед Лассо / Ted Lasso (3 сезон: 1-12 серии) (2024) WEB-DL 1080p' },
    { title: 'Тед Лассо / Ted Lasso (1 сезон: 1-10 серии) (2020) WEB-DL 1080p' },
    { title: 'Тед Лассо / Ted Lasso S02 (2021) WEB-DL 1080p' },
  ];

  const season3 = filterResultsBySeason(releases, 3);
  assert.equal(season3.length, 1);
  assert.ok(season3[0]!.title!.includes('3 сезон'));

  const season1 = filterResultsBySeason(releases, 1);
  assert.equal(season1.length, 1);
  assert.ok(season1[0]!.title!.includes('1 сезон'));

  const season2 = filterResultsBySeason(releases, 2);
  assert.equal(season2.length, 1);
  assert.ok(season2[0]!.title!.includes('S02'));
});

test('filterResultsBySeason matches real MobLand releases from Russian trackers', () => {
  const releases = [
    { title: 'МобЛэнд / MobLand / S3E1 04 из 10 (2026) WEB-DL 1080p DUB Red Head Sound RUSSIAN' },
    { title: 'МобЛэнд / MobLand / S4E1-6 of 10 (2026) WEB-DL 2160p 4K HEVC HDR10+ RUSSIAN' },
    { title: 'МобЛэнд / MobLand / S5E1 of 10 (2026) WEB-DL 1080p MVO HDrezka RUSSIAN' },
    { title: 'Гангстерландия / MobLand / S3E1 3 of 10 (2026) WEB-DL AVC DubMix RUSSIAN' },
    { title: 'MobLand S1-3 (2026) DUB 4K HEVC SDR WEBDL 2160p RUSSIAN' },
    { title: 'МобЛэнд / MobLand Season 4 (2026) WEB-DL 1080p RUSSIAN' },
  ];

  const season3 = filterResultsBySeason(releases, 3);
  assert.ok(season3.some((r) => r.title!.includes('S3E1 04')));
  assert.ok(season3.some((r) => r.title!.includes('S3E1 3 of')));
  assert.ok(season3.some((r) => r.title!.includes('S1-3')));

  const season4 = filterResultsBySeason(releases, 4);
  assert.ok(season4.some((r) => r.title!.includes('S4E1-6')));
  assert.ok(season4.some((r) => r.title!.includes('Season 4')));

  const season5 = filterResultsBySeason(releases, 5);
  assert.ok(season5.some((r) => r.title!.includes('S5E1')));
});

test('25 real MobLand releases: Season 2 filtering, episode parsing, audio & title matching', () => {
  const realReleases = [
    { title: 'MobLand - S2E1-4 - 2026 DUB (Red Head Sound), Sub 4K, HEVC, HDR, HDR10+, DV P8 Hybrid 2160p - RUSSIAN' },
    { title: 'Гангстерленд / MobLand / S2E1-4 of 10 (2026) WEB-DL [H.265/2160p] [4K, HDR10+, DV 8.1, 10-bit] Red Head Sound (обновлен...)' },
    { title: 'MobLand - S2E1-5 - 2026 DUB, 5 x MVO, DVO, Sub 4K, HEVC, HDR, HDR10+, DV P8 Hybrid 2160p - RUSSIAN' },
    { title: 'MobLand - S2E1-4 - 2026 DUB (Red Head Sound), MVO (HDrezka Studio), Sub WEBDL (AVC) - RUSSIAN' },
    { title: 'Гангстерленд / MobLand / S2E1-5 of 10 (2026) WEB-DL [H.265/2160p] [4K, HDR10+, DV 8.1, 10-bit] HDRezka Studio, Kubik, Lostfilm...' },
    { title: 'MobLand - S2E1-5 - 2026 DUB, 4 x MVO, 2 x DVO, Sub 4K, HEVC, SDR WEBDL 2160p - RUSSIAN' },
    { title: 'MobLand, S2E1-5 of 10 (2026) WEB-DL 1080p RUS' },
    { title: 'MobLand - S2E1-5 - 2026 DUB, MVO (LostFilm, HDrezka Studio), DVO (ViruseProject), MVO (ColdFilm), Sub WEBDL 1080p - RUSSI...' },
    { title: 'Гангстерленд / MobLand / S2E1-5 of 10 (2026) WEB-DL [H.265/2160p] [4K, SDR, 10-bit] NewComers, HDRezka Studio, TVShows...' },
    { title: 'MobLand - S2E1-4 - 2026 MVO (NewComers), Sub HEVC WEBDL 1080p - RUSSIAN' },
    { title: 'MobLand [S02E01-05 of 10] (2026) WEB-DL-AVC | P | HDRezka Studio RUS' },
    { title: 'MobLand - S2E1-5 - 2026 DUB (Red Head Sound), 5 x MVO, DVO, MVO, Sub 4K, HEVC, HDR, HDR10+ WEBDL 2160p - RUSSIAN' },
    { title: 'MobLand [S02E01-05 of 10] (2026) WEBRip | P2-ViruseProject RUS' },
    { title: 'MobLand [S02E01-05 of 10] (2026) WEBRip 1080p | P2-ViruseProject RUS' },
    { title: 'MobLand - S2E1-4 - 2026 DUB (Red Head Sound), Sub WEBDL 720p - RUSSIAN' },
    { title: 'MobLand, S2E1-4 of 10 (2026) WEB-DL-AVC | Red Head Sound, HD ... RUS' },
    { title: 'MobLand - S2E1-4 - 2026 DUB (Red Head Sound), 4 x MVO, 2 x DVO, Sub WEBDL (AVC) - RUSSIAN' },
    { title: 'Гангстерленд / MobLand / [02x01-04 из 10] (2026) WEB-DL-AVC от DoMiNo & selezeN | D, P | Red Head Sound, HDRezka Studio' },
    { title: 'MobLand - S2E1-4 - 2026 DUB (Red Head Sound), Sub WEBDL 1080p - RUSSIAN' },
    { title: 'MobLand [S02E01-04 of 10] (2026) WEB-DL-AVC | D, P, P2 | Red Head Sound, LostFilm, RUS' },
    { title: 'MobLand [S02E01-04 of 10] (2026) WEB-DL-AVC DoMiNo & | D, P | Red Head Sound, HDRezka Studio RUS' },
    { title: 'Гангстерленд / MobLand / S2E1-4 of 10 (2026) WEB-DL [H.264/1080p] HDRezka Studio, LostFilm, NewComers, TVShows, Red H...' },
    { title: 'MobLand - S2E1-4 - 2026 MVO (LostFilm), Sub WEBDL - RUSSIAN' },
    { title: 'MobLand [S02E01-03 of 10] (2026) UHD WEB-DL-HEVC 2160p Scarabey [4K HDR Dolby Vision | D | Red Head Sound RUS' },
    { title: 'MobLand [S02E01-03 of 10] (2026) WEB-DL 1080p Scarabey | D | Red Head Sound RUS' },
  ];

  assert.equal(realReleases.length, 25);

  // 1. Каждый из 25 релизов извлекает сезон 2
  for (const rel of realReleases) {
    const season = extractSeasonFromTitle(rel.title);
    assert.equal(season, 2, `Expected season 2 for "${rel.title}", got ${season}`);
  }

  // 2. Фильтрация по 2 сезону сохраняет ВСЕ 25 раздач
  const season2Releases = filterResultsBySeason(realReleases, 2);
  assert.equal(season2Releases.length, 25, 'All 25 releases must be matched for Season 2');

  // 3. Фильтрация по 1 или 3 сезону отсекает ВСЕ 25 раздач
  const season1Releases = filterResultsBySeason(realReleases, 1);
  assert.equal(season1Releases.length, 0, 'No releases should match Season 1');
  const season3Releases = filterResultsBySeason(realReleases, 3);
  assert.equal(season3Releases.length, 0, 'No releases should match Season 3');

  // 4. Проверка извлечения серий:
  // Релиз 18: [02x01-04 из 10] -> current: 4, total: 10
  const ep18 = extractEpisodeInfo(realReleases[17]!.title);
  assert.deepEqual(ep18, { current: 4, total: 10 });

  // Релиз 2: S2E1-4 of 10 -> current: 4, total: 10
  const ep2 = extractEpisodeInfo(realReleases[1]!.title);
  assert.deepEqual(ep2, { current: 4, total: 10 });

  // Релиз 11: [S02E01-05 of 10] -> current: 5, total: 10
  const ep11 = extractEpisodeInfo(realReleases[10]!.title);
  assert.deepEqual(ep11, { current: 5, total: 10 });

  // Релиз 24: [S02E01-03 of 10] -> current: 3, total: 10
  const ep24 = extractEpisodeInfo(realReleases[23]!.title);
  assert.deepEqual(ep24, { current: 3, total: 10 });

  // Релиз 1: S2E1-4 -> current: 4, total: null
  const ep1 = extractEpisodeInfo(realReleases[0]!.title);
  assert.deepEqual(ep1, { current: 4, total: null });

  // Релиз 3: S2E1-5 -> current: 5, total: null
  const ep3 = extractEpisodeInfo(realReleases[2]!.title);
  assert.deepEqual(ep3, { current: 5, total: null });

  // 5. Все 25 раздач имеют русский звук (Red Head Sound, Rezka, LostFilm, RUS, | D, P | и т.д.)
  for (const rel of realReleases) {
    const hasRu = matchesPreferredAudio(rel, 'russian');
    assert.equal(hasRu, true, `Expected Russian audio for "${rel.title}"`);
  }

  // 6. Все 25 раздач проходят проверку по названию и типу ТВ
  const matched = filterResultsByImdbOrTitle(
    realReleases,
    'tt13404944',
    'Гангстерленд',
    'MobLand',
    '2026',
    'tv'
  );
  assert.equal(matched.length, 25, 'All 25 releases must match MobLand / Гангстерленд watchlist entry');
});

test('extractSeasonFromTitle handles Cyrillic С/Е and NxMM format', () => {
  assert.equal(extractSeasonFromTitle('МобЛэнд / MobLand / С03Е01 из 10'), 3);
  assert.equal(extractSeasonFromTitle('Show С4Е1-6 of 10'), 4);
  assert.equal(extractSeasonFromTitle('The.Show.3x01.720p'), 3);
  assert.equal(extractSeasonFromTitle('Show 03x12 HDTV'), 3);
  // Стандартные паттерны продолжают работать
  assert.equal(extractSeasonFromTitle('Show S01E01'), 1);
  assert.equal(extractSeasonFromTitle('2 сезон'), 2);
});


test('filterResultsByImdbOrTitle allows later release years for ongoing TV shows while rejecting old remakes', () => {
  const releases = [
    // Релиз 3 сезона 2024 года для сериала с премьерой в 2020
    { title: 'Тед Лассо / Ted Lasso (3 сезон: 1-12 серии) (2024) WEB-DL 1080p' },
    // Старый ремейк/сериал 1995 года
    { title: 'Ted Lasso (1995) DVDRip' },
    // Релиз первого сезона в год премьеры
    { title: 'Ted Lasso S01 (2020) 1080p' },
  ];

  const matched = filterResultsByImdbOrTitle(
    releases,
    'tt10986410',
    'Тед Лассо',
    'Ted Lasso',
    '2020',
    'tv'
  );

  const matchedTitles = matched.map((r) => r.title);
  assert.ok(matchedTitles.includes('Тед Лассо / Ted Lasso (3 сезон: 1-12 серии) (2024) WEB-DL 1080p'));
  assert.ok(matchedTitles.includes('Ted Lasso S01 (2020) 1080p'));
  // Старый ремейк должен быть отсечен
  assert.equal(matchedTitles.includes('Ted Lasso (1995) DVDRip'), false);
});

test('computeReleaseIdentity and extractInfoHashFromMagnet handle malformed URI percent-encoding without throwing', () => {
  // Невалидные проценты в ссылке / магнете
  const malformedMagnet = 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=test%&tr=http%3A%2F%2Ftracker%D0%malformed';
  const hash = extractInfoHashFromMagnet(malformedMagnet);
  assert.equal(hash, '0123456789abcdef0123456789abcdef01234567');

  const malformedRelease = {
    title: 'Test Release [1080p]',
    guid: 'http://tracker.example/viewtopic.php?id=12345%&tracker=RuTracker%D0%',
    downloadUrl: 'http://tracker.example/download.php?t=67890%zz',
  };

  const identity = computeReleaseIdentity(malformedRelease);
  assert.ok(identity.primary != null);
  assert.ok(identity.aliases.length > 0);
});

test('buildSearchQueries preserves exact original title VisionQuest without splitting', () => {
  const queries = buildSearchQueries({
    imdbId: 'tt23112594',
    title: 'Квест Вижна',
    originalTitle: 'VisionQuest',
    itemType: 'tv',
    year: '2026',
    targetSeason: null,
  });

  assert.ok(queries.includes('VisionQuest 2026'));
  assert.ok(queries.includes('Квест Вижна 2026'));
  assert.ok(queries.includes('VisionQuest'));
  assert.ok(queries.includes('Квест Вижна'));
  // Проверяем, что исходный тайтл не разделялся
  assert.equal(queries.includes('Vision Quest 2026'), false);
});

test('filterResultsByImdbOrTitle matches exact VisionQuest release and rejects irrelevant titles', () => {
  const releases = [
    { title: 'VisionQuest [S01E01-02 of 08] (2026) WEB-DL 1080p | P, D RUS' },
    { title: 'VisionQuest - S1E1-2 - 2026 Sub WEBRip 1080p - RUSSIAN' },
    { title: 'VisionQuest / S1E1-2 of 8 [2026, HDR10, Dolby Vision, WEB-DL 2160p] [Hybrid] MVO + Dub + Original + ) RUS' },
    { title: 'VisionQuest - S1E1-2 - 2026 DUB, MVO, Sub 4K, HEVC, HDR, HDR10+, Dolby Vision P8 WEBDL 2160p - RUSSIAN' },
    { title: 'VisionQuest - S1E1-2 - 2026 DUB (HDrezka Studio), MVO (HDrezka Studio), Sub WEBDL 1080p - RUSSIAN' },
    { title: 'VisionQuest - S1E1-2 - 2026 DUB (HDrezka Studio), MVO (HDrezka Studio), Sub WEBDL (AVC) - RUSSIAN' },
    { title: 'VisionQuest / S1E1-2 of 8 [2026, WEB-DL] RUS' },
    { title: 'VisionQuest - S1E1-2 - 2026 DUB, Sub 4K, HEVC, HDR10+ WEBDL 2160p - RUSSIAN' },
    { title: 'VisionQuest - S1E1-2 - 2026 MVO (HDrezka Studio) WEBDL - RUSSIAN' },
    { title: 'Квест Вижна / VisionQuest / S01 (2026) WEB-DL 1080p' },
    { title: 'Comedy Club (2026.10.16) HDTV' },
  ];

  const matched = filterResultsByImdbOrTitle(
    releases,
    'tt23112594',
    'Квест Вижна',
    'VisionQuest',
    '2026',
    'tv'
  );

  const titles = matched.map((r) => r.title);
  // Все 9 реальных раздач из Prowlarr должны сопоставиться
  assert.equal(matched.length, 10);
  assert.ok(titles.includes('VisionQuest [S01E01-02 of 08] (2026) WEB-DL 1080p | P, D RUS'));
  assert.ok(titles.includes('VisionQuest - S1E1-2 - 2026 Sub WEBRip 1080p - RUSSIAN'));
  assert.ok(titles.includes('VisionQuest / S1E1-2 of 8 [2026, HDR10, Dolby Vision, WEB-DL 2160p] [Hybrid] MVO + Dub + Original + ) RUS'));
  assert.ok(titles.includes('VisionQuest - S1E1-2 - 2026 DUB, MVO, Sub 4K, HEVC, HDR, HDR10+, Dolby Vision P8 WEBDL 2160p - RUSSIAN'));
  assert.ok(titles.includes('VisionQuest - S1E1-2 - 2026 DUB (HDrezka Studio), MVO (HDrezka Studio), Sub WEBDL 1080p - RUSSIAN'));
  assert.ok(titles.includes('VisionQuest - S1E1-2 - 2026 DUB (HDrezka Studio), MVO (HDrezka Studio), Sub WEBDL (AVC) - RUSSIAN'));
  assert.ok(titles.includes('VisionQuest / S1E1-2 of 8 [2026, WEB-DL] RUS'));
  assert.ok(titles.includes('VisionQuest - S1E1-2 - 2026 DUB, Sub 4K, HEVC, HDR10+ WEBDL 2160p - RUSSIAN'));
  assert.ok(titles.includes('VisionQuest - S1E1-2 - 2026 MVO (HDrezka Studio) WEBDL - RUSSIAN'));
  assert.ok(titles.includes('Квест Вижна / VisionQuest / S01 (2026) WEB-DL 1080p'));
  assert.equal(titles.includes('Comedy Club (2026.10.16) HDTV'), false);
});

test('detectReleaseQuality accurately distinguishes resolutions and dynamic ranges (SDR vs HDR vs DV)', () => {
  const sdr2160 = detectReleaseQuality(
    'American Horror Story: 13 - S13E1-8 - 2026 5 x MVO, DVO, Sub 4K, HEVC, SDR WEBDL 2160p - RUSSIAN'
  );
  assert.equal(sdr2160.resolution, '2160p');
  assert.equal(sdr2160.dynamicRange, 'SDR');
  assert.equal(sdr2160.label, '2160p SDR');

  const hdr2160 = detectReleaseQuality(
    'House of the Dragon S02 2160p WEB-DL DDP5.1 Atmos H.265 HDR10'
  );
  assert.equal(hdr2160.resolution, '2160p');
  assert.equal(hdr2160.dynamicRange, 'HDR');
  assert.equal(hdr2160.label, '2160p HDR');

  const dv2160 = detectReleaseQuality(
    'Dune Part Two 2024 2160p UHD BluRay x265 TrueHD Atmos 7.1 DV HEVC'
  );
  assert.equal(dv2160.resolution, '2160p');
  assert.equal(dv2160.dynamicRange, 'DV');
  assert.equal(dv2160.label, '2160p DV');

  const fhd1080 = detectReleaseQuality('Ted Lasso S03 1080p WEB-DL');
  assert.equal(fhd1080.resolution, '1080p');
  assert.equal(fhd1080.dynamicRange, 'SDR');
  assert.equal(fhd1080.label, '1080p');
});

test('filterReleasesByPreferences strictly differentiates 2160p SDR and 2160p HDR without confusing them', () => {
  const sdrRelease = {
    title: 'Series S01 4K HEVC SDR WEBDL 2160p - RUSSIAN',
    quality: { resolution: '2160' },
  };
  const hdrRelease = {
    title: 'Series S01 4K HEVC HDR10 WEBDL 2160p - RUSSIAN',
    quality: { resolution: '2160' },
  };
  const dvRelease = {
    title: 'Series S01 4K HEVC Dolby Vision WEBDL 2160p - RUSSIAN',
    quality: { resolution: '2160' },
  };
  const fhdRelease = {
    title: 'Series S01 1080p WEB-DL - RUSSIAN',
    quality: { resolution: '1080' },
  };

  // 1. Поиск строго 2160p SDR
  const sdrOnly = filterReleasesByPreferences(
    [sdrRelease, hdrRelease, dvRelease, fhdRelease],
    '2160p SDR',
    'russian'
  );
  assert.equal(sdrOnly.length, 1);
  assert.equal(sdrOnly[0].title, sdrRelease.title);

  // 2. Поиск строго 2160p HDR
  const hdrOnly = filterReleasesByPreferences(
    [sdrRelease, hdrRelease, dvRelease, fhdRelease],
    '2160p HDR',
    'russian'
  );
  assert.equal(hdrOnly.length, 2);
  assert.ok(hdrOnly.some((r) => r.title === hdrRelease.title));
  assert.ok(hdrOnly.some((r) => r.title === dvRelease.title));
  assert.equal(hdrOnly.some((r) => r.title === sdrRelease.title), false);

  // 3. Мульти-выбор: 1080p, 2160p SDR (как в запросе пользователя)
  const mixed = filterReleasesByPreferences(
    [sdrRelease, hdrRelease, dvRelease, fhdRelease],
    '1080p, 2160p SDR',
    'russian'
  );
  assert.equal(mixed.length, 2);
  assert.ok(mixed.some((r) => r.title === sdrRelease.title));
  assert.ok(mixed.some((r) => r.title === fhdRelease.title));
  assert.equal(mixed.some((r) => r.title === hdrRelease.title), false);
  assert.equal(mixed.some((r) => r.title === dvRelease.title), false);
});

test('formatTorrentNotification produces correct HTML message with direct candidate links', () => {
  const { formatTorrentNotification } = require('@/lib/integrations/telegram/bot');
  const message = formatTorrentNotification({
    title: 'MobLand',
    releaseTitle: 'MobLand - S2E1-5 - 2026 DUB 4K',
    quality: '2160p SDR',
    size: 5 * 1024 ** 3,
    seeders: 42,
    imdbId: 'tt31510819',
    year: '2026',
    genre: 'Crime, Drama',
    rating: '8.4',
    itemType: 'tv',
    changeType: 'new',
    links: {
      magnet: 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=MobLand',
      downloadUrl: 'https://prowlarr.internal/download/1',
      infoUrl: 'https://rutracker.org/viewtopic.php?t=123',
    },
  });

  assert.ok(message.includes('MobLand'));
  assert.ok(message.includes('2026'));
  assert.ok(message.includes('5.00 GB'));
  assert.ok(message.includes('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567'));
  assert.ok(message.includes('https://rutracker.org/viewtopic.php?t=123'));
  assert.ok(message.includes('https://prowlarr.internal/download/1'));
});
