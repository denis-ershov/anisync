import { QUEUE_NAMES } from '@/lib/queue/names';

export const torrentsJobs = {
  queues: [QUEUE_NAMES.torrentsWatcher] as const,
};
