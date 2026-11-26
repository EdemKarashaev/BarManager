import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeOrderQuantities as merge
} from '../src/lib/order-merge.ts';

test('admin and bartender additions are preserved', () => {
  assert.deepEqual(
    merge({}, { syrup: '3' }, { juice: '5' }),
    {
      quantities: { syrup: '3', juice: '5' },
      conflicts: []
    }
  );
});

test('different product edits are merged', () => {
  assert.deepEqual(
    merge(
      { syrup: '2', coffee: '4' },
      { syrup: '3', coffee: '4' },
      { syrup: '2', coffee: '5' }
    ),
    {
      quantities: { syrup: '3', coffee: '5' },
      conflicts: []
    }
  );
});

test('same product conflict is detected', () => {
  assert.deepEqual(
    merge({ a: '2' }, { a: '3' }, { a: '5' }).conflicts,
    ['a']
  );
});

test('same change is not a conflict', () => {
  assert.deepEqual(
    merge({ a: '2' }, { a: '3' }, { a: '3' }),
    { quantities: { a: '3' }, conflicts: [] }
  );
});

test('local deletion preserves remote additions', () => {
  assert.deepEqual(
    merge({ a: '2' }, {}, { a: '2', b: '5' }),
    { quantities: { b: '5' }, conflicts: [] }
  );
});

test('deletion conflicts with remote modification', () => {
  assert.deepEqual(
    merge({ a: '2' }, {}, { a: '5' }).conflicts,
    ['a']
  );
});

test('decimal formats are equivalent', () => {
  assert.deepEqual(
    merge({ a: '1.500' }, { a: '1,5' }, { a: '2' }),
    { quantities: { a: '2' }, conflicts: [] }
  );
});

test('remote deletion is preserved', () => {
  assert.deepEqual(
    merge({ a: '2' }, { a: '2' }, {}),
    { quantities: {}, conflicts: [] }
  );
});
