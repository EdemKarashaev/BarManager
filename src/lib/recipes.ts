import { supabase } from './supabase';
import type { Recipe, RecipeStep } from './recipe-model';
const columns = `id,name,description,status,admin_only,recipe_type,serving_notes,preparation_method,
 category:categories(name),
 variants:recipe_variants(id,name,yield_amount,yield_unit,sort_order,
 items:recipe_items(id,quantity,unit,notes,sort_order,
 ingredient:ingredients(id,name,prep_recipe_id)))`;
function ordered(recipe: Recipe): Recipe {
  return { ...recipe, variants: (recipe.variants || []).map(v => ({ ...v, items: [...(v.items || [])].sort((a,b) => a.sort_order-b.sort_order || a.id-b.id) })).sort((a,b) => a.sort_order-b.sort_order || a.id-b.id) };
}
export async function fetchRecipes(signal: AbortSignal): Promise<Recipe[]> {
  const rows: Recipe[] = [];
  const pageSize = 100;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase.from('recipes').select(columns)
      .order('id').range(start, start + pageSize - 1).abortSignal(signal);
    if (error) throw error;
    const page = (data || []) as unknown as Recipe[];
    rows.push(...page.map(ordered));
    if (page.length < pageSize) return rows.sort((a,b) => (a.name || '').localeCompare(b.name || '', 'ru'));
  }
}
export async function fetchRecipe(id: string, signal: AbortSignal): Promise<{ recipe: Recipe | null; steps: RecipeStep[] }> {
  const [recipeResult, stepsResult] = await Promise.all([
    supabase.from('recipes').select(columns).eq('id', id).abortSignal(signal).maybeSingle(),
    supabase.from('recipe_steps').select('id,step_number,instruction').eq('recipe_id', id).order('step_number').order('id').abortSignal(signal),
  ]);
  if (recipeResult.error) throw recipeResult.error;
  if (stepsResult.error) throw stepsResult.error;
  return { recipe: recipeResult.data ? ordered(recipeResult.data as unknown as Recipe) : null, steps: stepsResult.data || [] };
}
export function recipeError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/fetch|network|timeout/i.test(message)) return 'Нет связи с сервером. Проверьте интернет и повторите попытку.';
  if (/permission|denied|jwt/i.test(message)) return 'Не удалось подтвердить доступ. Войдите заново или обратитесь к администратору.';
  return 'Не удалось загрузить ТТК. Повторите попытку. Если ошибка сохраняется, проверьте таблицы и права доступа в Supabase.';
}
