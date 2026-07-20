import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  getApiSloSummary,
  getTrackedApiSloSummary,
  observeApiRequest,
  resetApiSloMetrics,
} from '../src/lib/observability/slo-metrics';

describe('slo-metrics', () => {
  beforeEach(() => {
    resetApiSloMetrics();
  });

  it('aggregates latency percentiles per path', () => {
    observeApiRequest('/api/releases/content/upcoming', 100, 200);
    observeApiRequest('/api/releases/content/upcoming', 200, 200);
    observeApiRequest('/api/releases/content/upcoming', 300, 200);

    const [metric] = getApiSloSummary();
    assert.equal(metric?.path, '/api/releases/content/upcoming');
    assert.equal(metric?.sampleSize, 3);
    assert.equal(metric?.total, 3);
    assert.equal(metric?.errors, 0);
    assert.equal(metric?.p50, 200);
    assert.equal(metric?.p95, 300);
  });

  it('counts 5xx responses as errors', () => {
    observeApiRequest('/api/auth/login', 50, 500);
    observeApiRequest('/api/auth/login', 50, 200);

    const [metric] = getApiSloSummary();
    assert.equal(metric?.errors, 1);
    assert.equal(metric?.errorRate, 0.5);
  });

  it('filters tracked SLO paths', () => {
    observeApiRequest('/api/releases/content/upcoming', 100, 200);
    observeApiRequest('/api/releases/content/search', 100, 200);

    const tracked = getTrackedApiSloSummary();
    assert.equal(tracked.length, 1);
    assert.equal(tracked[0]?.path, '/api/releases/content/upcoming');
  });

  it('strips query string from path key', () => {
    observeApiRequest('/api/releases/watchlist?lang=ru', 120, 200);

    const [metric] = getApiSloSummary();
    assert.equal(metric?.path, '/api/releases/watchlist');
  });
});
