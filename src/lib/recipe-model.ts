export type RecipeStatus = 'active' | 'coming_soon' | 'phasing_out';
export type Ingredient = { id: number; name: string | null; prep_recipe_id: number | null };
export type RecipeItem = { id: number; quantity: number | null; unit: string | null; notes: string | null; sort_order: number; ingredient: Ingredient | null };
export type Variant = { id: number; name: string; yield_amount: number | null; yield_unit: string | null; sort_order: number; items: RecipeItem[] };

export type Recipe = {
  id: number;
  name: string | null;
  description: string | null;

  status: RecipeStatus;
  admin_only: boolean;
  recipe_type: string;

  serving_notes: string | null;
  preparation_method: string | null;

  source_sheet?: string | null;

  category: {
    name: string | null;
    sort_order?: number | null;
  } | null;

  variants: Variant[];
};

export type RecipeStep = { id: number; step_number: number; instruction: string | null };
export const statusLabels: Record<RecipeStatus, string> = {
  active: 'В меню', coming_soon: 'Скоро в меню', phasing_out: 'Скоро выведем',
};
export const statusColors: Record<RecipeStatus, string> = {
  active: '#9DA3AE', coming_soon: '#79D5A4', phasing_out: '#FF8B8B',
};
export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}
export function matchesRecipe(recipe: Recipe, query: string): boolean {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  const text = normalizeSearch([recipe.name, ...recipe.variants.flatMap(v => v.items.map(i => i.ingredient?.name))].filter(Boolean).join(' '));
  return words.every(word => text.includes(word));
}
export function visibleRecipes(recipes: Recipe[], isAdmin: boolean): Recipe[] {
  // UI defence only. Supabase RLS remains the authority for read access.
  return recipes.filter(recipe => isAdmin || recipe.admin_only === false);
}
export function formatAmount(amount: number | null, unit: string | null): string {
  if (amount === null) return 'Не указано';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 }).format(amount)} ${unit || '(ед. не указана)'}`;
}
