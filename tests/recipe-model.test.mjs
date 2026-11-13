import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRecipe, visibleRecipes, formatAmount, statusLabels } from '../src/lib/recipe-model.ts';
const recipe = { id: 1, name: 'Лимонад Мандарин-КремSoda', admin_only: false, variants: [
  { name: '400 мл', items: [{ ingredient: { name: 'Пюре мандарин' } }] },
  { name: '900 мл', items: [{ ingredient: { name: 'Мёд' } }] },
] };
test('search matches recipe, ingredient in any variant, case, ё and multiple words', () => {
  for (const query of ['', '  МАНДАРИН  ', 'мед', 'мандарин пюре']) assert.equal(matchesRecipe(recipe, query), true);
  assert.equal(matchesRecipe(recipe, 'водка'), false);
  assert.equal(matchesRecipe(recipe, 'мандарин водка'), false);
});
test('missing ingredient relation cannot break search or match hidden name', () => {
  const incomplete = { ...recipe, variants: [{ items: [{ ingredient: null }] }] };
  assert.equal(matchesRecipe(incomplete, 'Мандарин'), true);
  assert.equal(matchesRecipe(incomplete, 'мед'), false);
});
test('non-admin sees no hidden cards; admin sees both; null visibility fails closed', () => {
  const hidden = { ...recipe, id: 2, admin_only: true };
  const unknown = { ...recipe, id: 3, admin_only: null };
  assert.deepEqual(visibleRecipes([recipe, hidden, unknown], false), [recipe]);
  assert.equal(visibleRecipes([recipe, hidden], true).length, 2);
});
test('quantity formatting preserves zero, fractional amounts and unknown units', () => {
  assert.equal(formatAmount(0, 'мл'), '0 мл');
  assert.equal(formatAmount(0.05, 'мл'), '0,05 мл');
  assert.equal(formatAmount(60, null), '60 (ед. не указана)');
  assert.equal(formatAmount(null, 'мл'), 'Не указано');
});
test('status labels distinguish introduction and withdrawal', () => {
  assert.equal(statusLabels.coming_soon, 'Скоро в меню');
  assert.equal(statusLabels.phasing_out, 'Скоро выведем');
});
