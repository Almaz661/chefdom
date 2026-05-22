// G.4 — расчёт КБЖУ рецепта по ингредиентам из справочника USDA.
// Логика: для каждого ингредиента ищем в `ingredients` (USDA) по нечёткому
// совпадению, считаем кЖБУ исходя из amount (в граммах), делим на servings.
//
// Используется:
// — automatically после массового импорта раздела (sectionImport)
// — endpoint /api/calc-nutrition (пересчёт всех рецептов вручную)
// — tRPC procedure products.calcNutrition (пересчёт конкретного рецепта из UI)
//
// Если в БД ingredients пуст или ни один ингредиент не найден — функция
// возвращает 0 matched и НЕ обновляет рецепт (не затирает существующие
// значения нулями).

import { eq, ilike, sql } from "drizzle-orm";
import { db } from "../db/index";
import { recipes, recipeIngredients, ingredients } from "../db/schema";

export interface NutritionResult {
  matched: number; // сколько ингредиентов найдено в USDA
  total: number;   // всего ингредиентов в рецепте
  perServing: {
    kcal: number;
    protein: number;
    fats: number;
    carbs: number;
  };
}

/**
 * Рассчитывает КБЖУ рецепта и сохраняет в БД.
 * Возвращает null если рецепт не найден.
 * Возвращает результат с matched=0 если ничего не нашли в USDA — рецепт
 * не обновляется в этом случае (не затираем nullами).
 */
export async function calcRecipeNutrition(
  recipeId: number,
): Promise<NutritionResult | null> {
  const [recipe] = await db
    .select({ id: recipes.id, servings: recipes.servings })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  if (!recipe) return null;

  const ings = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId));

  let totalKcal = 0;
  let totalProtein = 0;
  let totalFats = 0;
  let totalCarbs = 0;
  let matchedCount = 0;

  for (const ing of ings) {
    const [found] = await db
      .select()
      .from(ingredients)
      .where(ilike(ingredients.nameRu, `%${ing.name}%`))
      .limit(1);

    if (!found) continue;

    // Количество в граммах. Если amount не указан — считаем 100г как базу.
    const amountG = ing.amount ? parseFloat(ing.amount) : 100;
    const factor = amountG / 100;

    totalKcal += found.kcalPer100g ? parseFloat(found.kcalPer100g) * factor : 0;
    totalProtein += found.proteinG ? parseFloat(found.proteinG) * factor : 0;
    totalFats += found.fatsG ? parseFloat(found.fatsG) * factor : 0;
    totalCarbs += found.carbsG ? parseFloat(found.carbsG) * factor : 0;
    matchedCount++;
  }

  // Если ничего не нашли — не обновляем рецепт. Это важно: если в БД
  // ingredients пусто (например, seed ещё не запустили), мы НЕ должны
  // обнулять calories/proteinG/fatsG/carbsG которые могли прийти из
  // JSON-LD рецепта.
  if (matchedCount === 0) {
    return {
      matched: 0,
      total: ings.length,
      perServing: { kcal: 0, protein: 0, fats: 0, carbs: 0 },
    };
  }

  const servings = recipe.servings || 1;
  const kcalPerServing = Math.round(totalKcal / servings);
  const proteinPerServing = Math.round((totalProtein / servings) * 10) / 10;
  const fatsPerServing = Math.round((totalFats / servings) * 10) / 10;
  const carbsPerServing = Math.round((totalCarbs / servings) * 10) / 10;

  await db.execute(
    sql`UPDATE recipes SET 
      calories = ${kcalPerServing},
      protein_g = ${proteinPerServing},
      fats_g = ${fatsPerServing},
      carbs_g = ${carbsPerServing}
    WHERE id = ${recipeId}`,
  );

  return {
    matched: matchedCount,
    total: ings.length,
    perServing: {
      kcal: kcalPerServing,
      protein: proteinPerServing,
      fats: fatsPerServing,
      carbs: carbsPerServing,
    },
  };
}
