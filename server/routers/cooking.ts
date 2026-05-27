import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { cookingHistory, recipes } from '../db/schema';

// Размер страницы для HistoryPage — соответствует разделу 17.1 плана v4
// (HistoryPage: пагинация кнопкой «Показать ещё», 30 записей за раз).
const PAGE_SIZE = 30;

// Период для переключателей на HistoryPage (раздел 19.3 макета):
// «Этот месяц | 3 месяца | Всё время».
const PeriodSchema = z.enum(['month', '3months', 'all']).default('all');
type Period = z.infer<typeof PeriodSchema>;

// Возвращает дату-нижнюю-границу для выбранного периода (или null = без фильтра).
function periodStart(period: Period): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'month') {
    // Начало текущего месяца
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // '3months' — последние 3 календарных месяца, считаем от начала месяца -2
  return new Date(now.getFullYear(), now.getMonth() - 2, 1);
}

export const cookingRouter = router({
  // --- Список с пагинацией для HistoryPage (раздел 19.3 макета).
  // По плану 17.1: 30 записей за раз, кнопка «Показать ещё».
  // period — фильтр для переключателей «Этот месяц | 3 месяца | Всё время».
  // total — общее количество записей за выбранный период (для подписи внизу).
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        period: PeriodSchema.optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const limit = input.limit ?? PAGE_SIZE;
      const period = input.period ?? 'all';
      const fromDate = periodStart(period);

      // Условия для основного запроса (с курсором)
      const conds = [eq(cookingHistory.userId, ctx.userId)];
      if (fromDate) conds.push(gte(cookingHistory.cookedAt, fromDate));
      if (input.cursor) conds.push(lt(cookingHistory.id, input.cursor));

      // Условия для total (без курсора — чтобы счётчик показывал всего за период)
      const totalConds = [eq(cookingHistory.userId, ctx.userId)];
      if (fromDate) totalConds.push(gte(cookingHistory.cookedAt, fromDate));

      const [rows, totalRows] = await Promise.all([
        db
          .select({
            id: cookingHistory.id,
            recipeId: cookingHistory.recipeId,
            recipeTitle: cookingHistory.recipeTitle,
            servings: cookingHistory.servings,
            caloriesPerServing: cookingHistory.caloriesPerServing,
            category: cookingHistory.category,
            cuisine: cookingHistory.cuisine,
            consumedCount: cookingHistory.consumedCount,
            totalIngredients: cookingHistory.totalIngredients,
            notes: cookingHistory.notes,
            cookedAt: cookingHistory.cookedAt,
            recipeImage: recipes.imageUrl,
          })
          .from(cookingHistory)
          .leftJoin(recipes, eq(cookingHistory.recipeId, recipes.id))
          .where(and(...conds))
          .orderBy(desc(cookingHistory.id))
          .limit(limit + 1),
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(cookingHistory)
          .where(and(...totalConds)),
      ]);

      let nextCursor: number | null = null;
      if (rows.length > limit) {
        nextCursor = rows[limit - 1].id;
        rows.length = limit;
      }
      return {
        items: rows,
        nextCursor,
        total: totalRows[0]?.count ?? 0,
      };
    }),

  // --- Последние N (для блока «Недавно готовила» на Dashboard, раздел 6.4 плана).
  recent: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input, ctx }) => {
      const rows = await db
        .select({
          id: cookingHistory.id,
          recipeId: cookingHistory.recipeId,
          recipeTitle: cookingHistory.recipeTitle,
          cookedAt: cookingHistory.cookedAt,
          recipeImage: recipes.imageUrl,
        })
        .from(cookingHistory)
        .leftJoin(recipes, eq(cookingHistory.recipeId, recipes.id))
        .where(eq(cookingHistory.userId, ctx.userId))
        .orderBy(desc(cookingHistory.cookedAt))
        .limit(input.limit);
      return rows;
    }),

  // C.2 — «Любимое в этом месяце» (самый часто готовимый рецепт за текущий месяц).
  topThisMonth: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const rows = await db
      .select({
        recipeTitle: cookingHistory.recipeTitle,
        recipeId: cookingHistory.recipeId,
        count: sql<number>`count(*)::int`,
      })
      .from(cookingHistory)
      .where(
        and(
          eq(cookingHistory.userId, ctx.userId),
          gte(cookingHistory.cookedAt, new Date(monthStart)),
        ),
      )
      .groupBy(cookingHistory.recipeTitle, cookingHistory.recipeId)
      .orderBy(desc(sql`count(*)`))
      .limit(1);
    return rows[0] ?? null;
  }),

  // --- Удалить ошибочную запись из истории.
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db
        .delete(cookingHistory)
        .where(and(eq(cookingHistory.id, input.id), eq(cookingHistory.userId, ctx.userId)))
        .returning({ id: cookingHistory.id });
      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Запись не найдена' });
      }
      return { id: input.id };
    }),
});
