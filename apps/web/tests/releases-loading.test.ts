import assert from 'node:assert/strict';
import test from 'node:test';

import type { ReleaseWatchlistEntry } from '@/lib/db';
import type { UpcomingCatalogResult } from '@/lib/integrations/tmdb';

// Только синтетические настройки; тесты не обращаются к внешним API и БД.
process.env.TMDB_API_KEY = 'test-tmdb-token';
process.env.LOG_LEVEL = 'silent';
delete process.env.REDIS_URL;
delete process.env.TRAKT_CLIENT_ID;
delete process.env.WATCHMODE_API_KEY;

async function loadModules() {
  const [tmdb, aggregator, cache] = await Promise.all([
    import('@/lib/integrations/tmdb/client'),
    import('@/lib/services/release-catalog-aggregator'),
    import('@/lib/cache/store'),
  ]);
  return { ...tmdb, ...aggregator, ...cache };
}

function movie(id: number) {
  return { id, title: `Фильм ${id}`, poster_path: '/poster.jpg', popularity: 1000 - id, genre_ids: [18] };
}

test('холодный каталог собирает нужную страницу без сторонних API и полного пула', async (t) => {
  const { ReleaseCatalogAggregator, resolveCatalogWindow } = await loadModules();
  const { from } = resolveCatalogWindow();
  const paths: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.themoviedb.org');
    paths.push(url.pathname);
    if (url.pathname.includes('/genre/')) return Response.json({ genres: [{ id: 18, name: 'Драма' }] });
    if (url.pathname.endsWith('/discover/movie')) {
      const page = Number(url.searchParams.get('page'));
      return Response.json({ results: Array.from({ length: 20 }, (_, i) => movie((page - 1) * 20 + i + 1)),
        total_pages: 20, total_results: 400 });
    }
    const match = url.pathname.match(/\/movie\/(\d+)\/release_dates$/);
    assert.ok(match, `Неожиданный запрос: ${url.pathname}`);
    const id = Number(match[1]);
    return Response.json({ id, results: [{ iso_3166_1: 'US', release_dates: [
      { type: id === 2 ? 3 : 4, release_date: id === 1 ? '2000-01-01' : from },
    ] }] });
  });

  const [result, concurrent] = await Promise.all([
    ReleaseCatalogAggregator.getUpcoming('ru', { type: 'movie', pageSize: 25 }),
    ReleaseCatalogAggregator.getUpcoming('ru', { type: 'movie', pageSize: 25 }),
  ]);
  assert.deepEqual(concurrent, result);
  assert.equal(result.items.length, 25);
  assert.equal(result.items[0].tmdbId, 3);
  assert.ok(result.items.every(item => item.releaseDate === from));
  assert.equal(result.hasNextPage, true);
  assert.equal(paths.filter(path => path.endsWith('/discover/movie')).length, 2);
  assert.ok(paths.filter(path => path.endsWith('/release_dates')).length <= 28);
});

test('будущие премьеры и новые эпизоды не требуют last_air_date в текущем окне', async (t) => {
  const { getUpcoming, resolveCatalogWindow } = await loadModules();
  const { from } = resolveCatalogWindow();
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/discover/tv')) {
      return Response.json({ results: [1001, 1002, 1003].map(id => ({ id })), total_pages: 1, total_results: 3 });
    }
    const id = Number(url.pathname.split('/').pop());
    return Response.json({ id, name: `Сериал ${id}`, poster_path: '/show.jpg', genres: [{ id: 18, name: 'Драма' }],
      first_air_date: id === 1002 ? from : '2000-01-01',
      last_air_date: id === 1002 ? null : '2000-01-01',
      next_episode_to_air: id === 1001 ? { season_number: 2, episode_number: 1, air_date: from, name: 'Премьера' } : null });
  });
  const result = await getUpcoming('ru', { type: 'show', sort: 'releaseDate' });
  assert.deepEqual(result.items.map(item => item.tmdbId), [1001, 1002]);
  assert.equal(result.items[0].nextEpisode?.season, 2);
  assert.equal(result.items[0].nextEpisode?.airDate, from);
  assert.equal(result.items[1].releaseDate, from);
});

test('устаревший снимок отдаётся без сети с правильной пагинацией', async (t) => {
  const { ReleaseCatalogAggregator, resolveCatalogWindow, cacheWrite } = await loadModules();
  const { from, toExclusive } = resolveCatalogWindow();
  const items: UpcomingCatalogResult['items'] = Array.from({ length: 30 }, (_, i) => ({
    tmdbId: 2000 + i, type: 'movie', title: `Фильм ${i}`, titleRu: null, originalTitle: null,
    rating: 7, popularity: 100 - i, posterPath: '/poster.jpg', genre: null, genreRu: null,
    overview: null, year: 2026, releaseDate: from, nextEpisode: null,
  }));
  const key = `releases:catalog:pool:v6:en:movie:rating:0:${from}:${toExclusive}`;
  await cacheWrite(key, { items, updatedAt: Date.now() - 3_600_000 }, 86_400_000);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Сеть недоступна'); });
  const result = await ReleaseCatalogAggregator.getUpcoming('en', { type: 'movie', sort: 'rating', page: 2 });
  assert.deepEqual(result.items, items.slice(25));
  assert.equal(result.totalPages, 2);
  assert.equal(result.totalResults, 30);
  assert.equal(result.hasPreviousPage, true);
  assert.equal(result.hasNextPage, false);
  await assert.rejects(ReleaseCatalogAggregator.refreshUpcoming('en', { type: 'movie', sort: 'rating' }));
  const afterFailure = await ReleaseCatalogAggregator.getUpcoming('en', { type: 'movie', sort: 'rating', page: 2 });
  assert.deepEqual(afterFailure, result);
});

test('сбой части TMDB не скрывает доступные сериалы и не кэширует неполный ответ', async (t) => {
  const { getUpcoming, resolveCatalogWindow } = await loadModules();
  const { from } = resolveCatalogWindow();
  let movieCalls = 0;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/discover/movie')) {
      movieCalls += 1;
      return new Response(null, { status: 401 });
    }
    if (url.pathname.endsWith('/discover/tv')) {
      return Response.json({ results: [{ id: 3001 }], total_pages: 1, total_results: 1 });
    }
    return Response.json({ id: 3001, name: 'Премьера', poster_path: '/show.jpg', first_air_date: from, genres: [] });
  });
  const options = { type: 'all', genreId: 9001 } as const;
  const first = await getUpcoming('ru', options);
  assert.equal(first.partial, true);
  assert.equal(first.items[0].tmdbId, 3001);
  const callsAfterFirst = movieCalls;
  await getUpcoming('ru', options);
  assert.ok(movieCalls > callsAfterFirst);
});

test('полный сбой TMDB возвращает ошибку, а не ложный пустой каталог', async (t) => {
  const { getUpcoming } = await loadModules();
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
  await assert.rejects(getUpcoming('en', { type: 'movie', genreId: 9002 }), /Не удалось/);
});

test('превышение общего бюджета отменяет сетевой запрос и останавливает повторы', async (t) => {
  const { getUpcoming } = await loadModules();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    assert.ok(init?.signal);
    await new Promise(resolve => setTimeout(resolve, 30));
    init.signal.throwIfAborted();
    return Response.json({ results: [], total_pages: 1, total_results: 0 });
  });
  await assert.rejects(getUpcoming('en', { type: 'movie', genreId: 9003 }, 10));
  assert.equal(calls, 1);
});

test('фоновый прогрев публикует общий пул, повторный прогрев не вызывает сеть', async (t) => {
  const { ReleaseCatalogAggregator, resolveCatalogWindow } = await loadModules();
  const { from } = resolveCatalogWindow();
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.themoviedb.org');
    if (url.pathname.endsWith('/discover/movie')) {
      const page = Number(url.searchParams.get('page'));
      return Response.json({ results: Array.from({ length: 20 }, (_, i) => movie(4000 + (page - 1) * 20 + i)),
        total_pages: 2, total_results: 40 });
    }
    return Response.json({ results: [{ iso_3166_1: 'US', release_dates: [{ type: 4, release_date: from }] }] });
  });
  await ReleaseCatalogAggregator.refreshUpcoming('en', { type: 'movie', sort: 'releaseDate' });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Готовый пул не должен требовать сеть'); });
  await ReleaseCatalogAggregator.refreshUpcoming('en', { type: 'movie', sort: 'releaseDate' });
  const result = await ReleaseCatalogAggregator.getUpcoming('en', { type: 'movie', sort: 'releaseDate', page: 2 });
  assert.equal(result.items.length, 15);
  assert.equal(result.totalResults, 40);
  assert.equal(result.totalPages, 2);
});

test('список релизов читает сохранённые даты из БД без сетевого обогащения', async (t) => {
  const { db } = await import('@/lib/db');
  const { ReleaseWatchlistService } = await import('@/lib/services/release-watchlist-service');
  const { MovieDigitalReleaseDateService } = await import('@/lib/services/movie-digital-release-date-service');
  const entry: ReleaseWatchlistEntry = {
    id: 1, userId: 7, tmdbId: 603, type: 'movie', title: 'Матрица', titleRu: 'Матрица',
    status: 'plan', rating: 8, popularity: 100, posterPath: '/poster.jpg', genre: null, genreRu: null,
    year: 1999, releaseDate: '1999-09-21', nextEpisodeSeason: null, nextEpisodeNumber: null,
    nextEpisodeDate: null, addedAt: new Date('2026-01-01T00:00:00Z'), scheduleUpdatedAt: null,
  };
  t.mock.method(db, 'select', () => ({ from: () => ({ where: () => ({ orderBy: async () => [entry] }) }) }));
  const resolve = t.mock.method(MovieDigitalReleaseDateService, 'resolveDisplay', () => {
    throw new Error('Внешние даты не должны запрашиваться при чтении');
  });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Сеть недоступна'); });
  const result = await ReleaseWatchlistService.listForUser(7, 'ru');
  assert.equal(result.length, 1);
  assert.equal(result[0].releaseDate, '1999-09-21');
  assert.equal(result[0].addedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(resolve.mock.callCount(), 0);
});
