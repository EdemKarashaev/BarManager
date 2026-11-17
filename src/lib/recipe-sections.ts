import type { Recipe } from './recipe-model';
export function recipeSection(recipe: Recipe): string {
  return recipe.source_sheet?.trim() || recipe.category?.name?.trim() || 'Без раздела';
}
// Input must already be restricted by RLS and visibleRecipes. No hardcoded hidden sheet names.
export function recipeSections(recipes: Recipe[]): { name: string; count: number }[] {
  const sections = new Map<string, { name: string; count: number; order: number }>();
  for (const recipe of recipes) {
    const name = recipeSection(recipe);
    const order = recipe.category?.sort_order ?? Number.MAX_SAFE_INTEGER;
    const section = sections.get(name);
    if (section) { section.count += 1; section.order = Math.min(section.order, order); }
    else sections.set(name, { name, count: 1, order });
  }
  return [...sections.values()].sort((a,b) => a.order-b.order || a.name.localeCompare(b.name, 'ru')).map(({name,count}) => ({name,count}));
}
