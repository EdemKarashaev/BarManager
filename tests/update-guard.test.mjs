import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blockUpdates,
  updatesBlocked,
} from '../src/lib/update-guard.ts';

test('updates are allowed by default', () => {
  assert.equal(updatesBlocked(), false);
});

test('active blocker prevents updates', () => {
  const release = blockUpdates();
  assert.equal(updatesBlocked(), true);
  release();
  assert.equal(updatesBlocked(), false);
});

test('multiple blockers work independently', () => {
  const first = blockUpdates();
  const second = blockUpdates();

  first();
  assert.equal(updatesBlocked(), true);

  second();
  assert.equal(updatesBlocked(), false);
});

test('repeated release cannot remove another blocker', () => {
  const first = blockUpdates();
  const second = blockUpdates();

  first();
  first();

  assert.equal(updatesBlocked(), true);

  second();
  assert.equal(updatesBlocked(), false);
});
