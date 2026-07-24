import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProviderHttpError,
  isPrimaryWriteUnavailableStatus,
  isProviderHttpError,
} from '@/lib/integrations/provider-types';

test('ProviderHttpError exposes status and body', () => {
  const error = new ProviderHttpError(422, '{"error":"invalid"}', 'https://shikimori.one/api');
  assert.equal(error.status, 422);
  assert.equal(error.body, '{"error":"invalid"}');
  assert.match(error.message, /Request failed 422/);
  assert.equal(isProviderHttpError(error), true);
  assert.equal(isProviderHttpError(new Error('nope')), false);
});

test('isPrimaryWriteUnavailableStatus matches 404 and 422 only', () => {
  assert.equal(isPrimaryWriteUnavailableStatus(404), true);
  assert.equal(isPrimaryWriteUnavailableStatus(422), true);
  assert.equal(isPrimaryWriteUnavailableStatus(401), false);
  assert.equal(isPrimaryWriteUnavailableStatus(500), false);
  assert.equal(isPrimaryWriteUnavailableStatus(200), false);
});
