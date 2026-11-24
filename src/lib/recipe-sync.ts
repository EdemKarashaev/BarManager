import {
  cacheGeneration,
  withCacheLock,
} from './cache-lock';
import { fetchRecipes, fetchRecipeSteps } from './recipes';
import {
  readRecipeCache,
  writeRecipeCache,
  type RecipeSnapshot,
} from './recipe-cache';

export async function loadLocalRecipes(
  userId: string,
  roleId: number,
) {
  const snapshot = await readRecipeCache(userId, roleId);

  if (!snapshot) return null;

  return {
    ...snapshot,
    recipes: snapshot.recipes.filter(
      recipe => recipe.admin_only === false
    ),
  };
}

export async function syncRecipes(
  userId: string,
  roleId: number,
  isAdmin: boolean,
  signal: AbortSignal,
) {
  const generation = cacheGeneration(userId);
  const rows = await fetchRecipes(signal);

  const recipes = rows.filter(
    recipe => isAdmin || recipe.admin_only === false
  );

  // Hidden administrative recipes are never persisted.
  const publicRecipes = recipes.filter(
    recipe => recipe.admin_only === false
  );

  const steps = await fetchRecipeSteps(
    publicRecipes.map(recipe => recipe.id),
    signal,
  );

  if (signal.aborted) {
    throw new Error('Synchronization cancelled');
  }

  const snapshot: RecipeSnapshot = {
    version: 1,
    userId,
    roleId,
    savedAt: Date.now(),
    recipes: publicRecipes,
    steps,
  };

  let persisted = false;

  try {
    persisted = await withCacheLock(userId, async () => {
      if (
        signal.aborted ||
        generation !== cacheGeneration(userId)
      ) return false;

      await writeRecipeCache(snapshot);
      return true;
    });
  } catch {
    // Online recipes remain available if storage fails.
  }

  return {
    recipes,
    savedAt: snapshot.savedAt,
    persisted,
  };
}
