process.env.ANISYNC_PROCESS = 'worker';

import { createLogger } from '@/lib/observability/logger';
import { isQueuesEnabled } from '@/lib/config';
import { shutdownWorkers, startWorkers } from '@/lib/queue/workers';

const log = createLogger('worker');

async function main() {
  if (!isQueuesEnabled()) {
    log.error('REDIS_URL is required for worker process');
    process.exit(1);
  }

  const workers = startWorkers();

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down worker');
    await shutdownWorkers(workers);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  log.error({ err: error }, 'Worker failed to start');
  process.exit(1);
});
