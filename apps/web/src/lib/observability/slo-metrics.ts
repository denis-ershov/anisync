interface SloBucket {
  valuesMs: number[];
  total: number;
  errors: number;
}

const MAX_SAMPLES = 500;
const buckets = new Map<string, SloBucket>();

export const SLO_TRACKED_PATHS = [
  '/api/releases/content/upcoming',
  '/api/releases/content/trending',
  '/api/releases/watchlist',
  '/api/auth/login',
] as const;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

export function observeApiRequest(path: string, durationMs: number, statusCode: number): void {
  const key = path.split('?')[0] ?? path;
  const bucket = buckets.get(key) ?? { valuesMs: [], total: 0, errors: 0 };
  bucket.total += 1;
  if (statusCode >= 500) {
    bucket.errors += 1;
  }
  bucket.valuesMs.push(durationMs);
  if (bucket.valuesMs.length > MAX_SAMPLES) {
    bucket.valuesMs.shift();
  }
  buckets.set(key, bucket);
}

export function getApiSloSummary() {
  const summary = Array.from(buckets.entries()).map(([path, bucket]) => {
    const sorted = [...bucket.valuesMs].sort((a, b) => a - b);
    return {
      path,
      sampleSize: sorted.length,
      total: bucket.total,
      errors: bucket.errors,
      errorRate: bucket.total === 0 ? 0 : Number((bucket.errors / bucket.total).toFixed(4)),
      p50: Math.round(percentile(sorted, 50)),
      p95: Math.round(percentile(sorted, 95)),
      p99: Math.round(percentile(sorted, 99)),
    };
  });

  return summary.sort((a, b) => b.p95 - a.p95);
}

export function getTrackedApiSloSummary() {
  const tracked = new Set<string>(SLO_TRACKED_PATHS);
  return getApiSloSummary().filter((metric) => tracked.has(metric.path));
}

/** Только для тестов */
export function resetApiSloMetrics(): void {
  buckets.clear();
}
