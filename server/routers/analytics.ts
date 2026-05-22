import { z } from 'zod';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../db/index';
import { cookingHistory, recipeIngredients } from '../db/schema';

// C.3 — Аналитика.
// Период: «Неделя» / «Месяц» / «3 месяца» (план раздел 19.4).
// Две процедуры:
//   topRecipes — топ-5 самых частых рецептов за период
//   productConsumption — расход продуктов за период (суммирует ингредиенты из приготовленных рецептов)

const PeriodSchema = z.enum(['week', 'month', '3months']).default('month');
type Period = z.infer<typeof PeriodSchema>;

function periodStart(period: Period): Date {
  const now = new Date();
  if (period === 'week') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // 3months
  return new Date(now.getFullYear(), now.getMonth() - 2, 1);
}

export const analyticsRouter = router({
  // Топ-5 рецептов за период
  topRecipes: publicProcedure
    .input(z.object({ period: PeriodSchema.optional() }))
    .query(async ({ input }) => {
      const from = periodStart(input.period ?? 'month');
      const rows = await db
        .select({
          recipeTitle: cookingHistory.recipeTitle,
          recipeId: cookingHistory.recipeId,
          count: sql<number>`count(*)::int`,
        })
        .from(cookingHistory)
        .where(
          and(
            eq(cookingHistory.userId, 1),
            gte(cookingHistory.cookedAt, from),
          ),
        )
        .groupBy(cookingHistory.recipeTitle, cookingHistory.recipeId)
        .orderBy(desc(sql`count(*)`))
        .limit(5);
      return rows;
    }),

  // Расход продуктов за период — суммируем ингредиенты из всех приготовленных рецептов.
  // Группировка по имени ингредиента + единице измерения.
  productConsumption: publicProcedure
    .input(z.object({ period: PeriodSchema.optional() }))
    .query(async ({ input }) => {
      const from = periodStart(input.period ?? 'month');

      // Получаем все записи готовки за период
      const cooks = await db
        .select({
          recipeId: cookingHistory.recipeId,
          servings: cookingHistory.servings,
        })
        .from(cookingHistory)
        .where(
          and(
            eq(cookingHistory.userId, 1),
            gte(cookingHistory.cookedAt, from),
          ),
        );

      // Собираем уникальные recipeId
      const recipeIds = [...new Set(cooks.filter(c => c.recipeId !== null).map(c => c.recipeId!))];
      if (recipeIds.length === 0) return [];

      // Получаем ингредиенты этих рецептов
      const allIngredients = await db
        .select({
          recipeId: recipeIngredients.recipeId,
          name: recipeIngredients.name,
          amount: recipeIngredients.amount,
          unit: recipeIngredients.unit,
        })
        .from(recipeIngredients)
        .where(sql`${recipeIngredients.recipeId} = ANY(${recipeIds})`);

      // Суммируем: для каждого факта готовки умножаем ингредиенты на (servings/default_servings).
      // Упрощённо: считаем что ингредиенты даны на 1 порцию (не совсем точно,
      // но для аналитики расхода достаточно).
      const consumption: Record<string, { name: string; unit: string | null; total: number }> = {};

      for (const cook of cooks) {
        if (!cook.recipeId) continue;
        const ings = allIngredients.filter(i => i.recipeId === cook.recipeId);
        for (const ing of ings) {
          const key = `${ing.name.toLowerCase()}|${(ing.unit || '').toLowerCase()}`;
          if (!consumption[key]) {
            consumption[key] = { name: ing.name, unit: ing.unit, total: 0 };
          }
          const amount = ing.amount ? parseFloat(ing.amount) : 0;
          consumption[key].total += amount;
        }
      }

      // Сортируем по суммарному количеству (убывание), берём топ-10
      return Object.values(consumption)
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(c => ({
          name: c.name,
          unit: c.unit,
          total: Math.round(c.total * 10) / 10,
        }));
    }),
});
