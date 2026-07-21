import { pingRedis } from '@/lib/queue/redis';

const ok = await pingRedis();
process.exit(ok ? 0 : 1);
