process.env.ANISYNC_PROCESS = 'scheduler';

import { createLogger } from '@/lib/observability/logger';
import { isQueuesEnabled } from '@/lib/config';
import { registerRepeatableJobs, shutdownScheduler } from '@/lib/queue/scheduler';

const log = createLogger('scheduler');

async function main() {
  if (!isQueuesEnabled()) {
    log.error('REDIS_URL is required for scheduler process');
    process.exit(1);
  }

  await registerRepeatableJobs();
  log.info('Scheduler is running');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down scheduler');
    await shutdownScheduler();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  log.error({ err: error }, 'Scheduler failed to start');
  process.exit(1);
});
