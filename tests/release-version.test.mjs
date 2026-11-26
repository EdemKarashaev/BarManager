import test from 'node:test';
import assert from 'node:assert/strict';
import { nextVersion } from '../scripts/release-version.mjs';

test('patch release', () => {
  assert.equal(nextVersion('1.0.2'), '1.0.3');
});

test('minor release', () => {
  assert.equal(nextVersion('1.0.3', 'minor'), '1.1.0');
});

test('major release', () => {
  assert.equal(nextVersion('1.5.8', 'major'), '2.0.0');
});

test('invalid version rejected', () => {
  assert.throws(() => nextVersion('invalid'));
});

test('invalid release type rejected', () => {
  assert.throws(() => nextVersion('1.0.2', 'unknown'));
});
