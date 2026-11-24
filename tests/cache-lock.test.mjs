import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cacheGeneration,
  invalidateCache,
  withCacheLock,
} from '../src/lib/cache-lock.ts';

test('cache operations execute sequentially', async () => {
  const events = [];

  await Promise.all([
    withCacheLock('user-1', async () => {
      events.push('write-start');
      await Promise.resolve();
      events.push('write-end');
    }),
    withCacheLock('user-1', async () => {
      events.push('clear');
    }),
  ]);

  assert.deepEqual(events, [
    'write-start',
    'write-end',
    'clear',
  ]);
});

test('invalidation rejects stale generation', () => {
  const before = cacheGeneration('user-2');
  invalidateCache('user-2');
  assert.notEqual(cacheGeneration('user-2'), before);
});

test('failed operation does not block queue', async () => {
  await assert.rejects(
    withCacheLock('user-3', async () => {
      throw new Error('storage failure');
    })
  );

  const result = await withCacheLock(
    'user-3',
    async () => 'ok'
  );

  assert.equal(result, 'ok');
});

test('cache generations are isolated by user', () => {
  const before = cacheGeneration('user-4');
  invalidateCache('user-5');
  assert.equal(cacheGeneration('user-4'), before);
});
