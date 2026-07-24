import test from 'node:test';
import assert from 'node:assert/strict';
import { collectProviderServiceLinks, buildProviderAnimeUrl } from '@/lib/integrations/provider-links';

test('buildProviderAnimeUrl builds canonical URLs', () => {
  assert.equal(buildProviderAnimeUrl('shikimori', '21'), 'https://shikimori.one/animes/21');
  assert.equal(buildProviderAnimeUrl('myanimelist', '21'), 'https://myanimelist.net/anime/21');
  assert.equal(buildProviderAnimeUrl('anilist', '21'), 'https://anilist.co/anime/21');
});

test('collectProviderServiceLinks merges service ids and malId', () => {
  const links = collectProviderServiceLinks({
    serviceIds: [
      { serviceName: 'shikimori', externalAnimeId: '100' },
      { serviceName: 'anilist', externalAnimeId: '200' },
    ],
    malId: 21,
    catalogUrl: 'https://shikimori.one/animes/100-one-piece',
    sourceService: 'shikimori',
  });

  assert.deepEqual(
    links.map((link) => link.service),
    ['shikimori', 'myanimelist', 'anilist']
  );
  assert.equal(links[0].url, 'https://shikimori.one/animes/100-one-piece');
  assert.equal(links[1].url, 'https://myanimelist.net/anime/21');
  assert.equal(links[2].externalAnimeId, '200');
});

test('collectProviderServiceLinks does not put anilist catalog url on shikimori badge', () => {
  const links = collectProviderServiceLinks({
    serviceIds: [
      { serviceName: 'shikimori', externalAnimeId: '58955' },
      { serviceName: 'anilist', externalAnimeId: '159309' },
    ],
    catalogUrl: 'https://anilist.co/anime/159309',
    sourceService: 'shikimori',
  });

  const shiki = links.find((link) => link.service === 'shikimori');
  const al = links.find((link) => link.service === 'anilist');
  assert.equal(shiki?.url, 'https://shikimori.one/animes/58955');
  assert.equal(al?.url, 'https://anilist.co/anime/159309');
});
