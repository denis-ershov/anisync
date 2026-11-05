import { getGenres } from '@/lib/integrations/tmdb';
import { UPCOMING_PRECOMPUTE_COMBOS } from '@/lib/integrations/tmdb/cache-keys';
import { createLogger } from '@/lib/observability/logger';
import { ReleaseCatalogAggregator } from '@/lib/services/release-catalog-aggregator';

const log = createLogger('services:releases-precompute');

const DEFAULT_PAGE_SIZE = 25;

export class ReleasesPrecomputeService {
  static async warmUpcomingCatalog(pageSize = DEFAULT_PAGE_SIZE) {
    let warmed = 0;
    const errors: Error[] = [];

    for (const combo of UPCOMING_PRECOMPUTE_COMBOS) {
      try {
        await ReleaseCatalogAggregator.refreshUpcoming(combo.lang, {
          page: 1,
          pageSize,
          type: combo.type,
          sort: combo.sort,
        });
        warmed += 1;
      } catch (err) {
        log.error({ err, combo }, 'Не удалось прогреть вариант каталога');
        errors.push(err instanceof Error ? err : new Error('Ошибка прогрева каталога'));
      }
    }

    await Promise.all([getGenres('en'), getGenres('ru')]);

    if (errors.length > 0) {
      throw new AggregateError(errors, `Прогрето ${warmed} из ${UPCOMING_PRECOMPUTE_COMBOS.length} вариантов каталога`);
    }

    log.info({ warmed }, 'Releases upcoming catalog precomputed');
    return { warmed };
  }
}
