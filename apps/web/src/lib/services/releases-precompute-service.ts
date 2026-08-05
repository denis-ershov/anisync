import { getGenres } from '@/lib/integrations/tmdb';
import { UPCOMING_PRECOMPUTE_COMBOS } from '@/lib/integrations/tmdb/cache-keys';
import { createLogger } from '@/lib/observability/logger';
import { ReleaseCatalogAggregator } from '@/lib/services/release-catalog-aggregator';

const log = createLogger('services:releases-precompute');

const DEFAULT_PAGE_SIZE = 25;

export class ReleasesPrecomputeService {
  static async warmUpcomingCatalog(pageSize = DEFAULT_PAGE_SIZE) {
    let warmed = 0;

    for (const combo of UPCOMING_PRECOMPUTE_COMBOS) {
      await ReleaseCatalogAggregator.getUpcoming(combo.lang, {
        page: 1,
        pageSize,
        type: combo.type,
        sort: combo.sort,
      });
      warmed += 1;
    }

    await Promise.all([getGenres('en'), getGenres('ru')]);

    log.info({ warmed }, 'Releases upcoming catalog precomputed');
    return { warmed };
  }
}
