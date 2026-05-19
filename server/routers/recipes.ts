import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, ilike, lt, type SQL } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { client, db } from '../db/index';
import { recipes, recipeIngredients, recipeSteps } from '../db/schema';

const PAGE_SIZE = 20;

export const recipesRouter = router({
  // Список рецептов с поиском, фильтрами и cursor-based пагинацией.
  // Используется через useInfiniteQuery — tRPC сам подставит cursor.
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        cuisine: z.string().optional(),
        difficulty: z.string().optional(),
        cursor: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      const conditions: SQL[] = [];
      if (input.search && input.search.trim()) {
        conditions.push(ilike(recipes.title, `%${input.search.trim()}%`));
      }
      if (input.category) conditions.push(eq(recipes.category, input.category));
      if (input.cuisine) conditions.push(eq(recipes.cuisine, input.cuisine));
      if (input.difficulty) conditions.push(eq(recipes.difficulty, input.difficulty));
      if (input.cursor) conditions.push(lt(recipes.id, input.cursor));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Берём PAGE_SIZE+1 — если пришло больше, значит есть следующая страница.
      const rows = await db
        .select({
          id: recipes.id,
          title: recipes.title,
          imageUrl: recipes.imageUrl,
          totalTime: recipes.totalTime,
          servings: recipes.servings,
          difficulty: recipes.difficulty,
          category: recipes.category,
        })
        .from(recipes)
        .where(where)
        .orderBy(desc(recipes.id))
        .limit(PAGE_SIZE + 1);

      let nextCursor: number | null = null;
      if (rows.length > PAGE_SIZE) {
        const lastItem = rows[PAGE_SIZE - 1];
        nextCursor = lastItem.id;
        rows.length = PAGE_SIZE;
      }

      return { items: rows, nextCursor };
    }),

  // Деталь рецепта: рецепт + ингредиенты (по sortOrder) + шаги (по stepNumber)
  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.id))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Рецепт не найден',
        });
      }

      const ingredients = await db
        .select()
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, input.id))
        .orderBy(recipeIngredients.sortOrder);

      const steps = await db
        .select()
        .from(recipeSteps)
        .where(eq(recipeSteps.recipeId, input.id))
        .orderBy(recipeSteps.stepNumber);

      return { recipe, ingredients, steps };
    }),

  // Категории с количеством — для фильтр-чипов.
  getCategories: publicProcedure.query(async () => {
    const rows = await client<{ category: string; count: number }[]>`
      SELECT category, COUNT(*)::int AS count
      FROM recipes
      WHERE category IS NOT NULL AND category <> ''
      GROUP BY category
      ORDER BY count DESC, category ASC
    `;
    return rows;
  }),

  // То же по кухне.
  getCuisines: publicProcedure.query(async () => {
    const rows = await client<{ cuisine: string; count: number }[]>`
      SELECT cuisine, COUNT(*)::int AS count
      FROM recipes
      WHERE cuisine IS NOT NULL AND cuisine <> ''
      GROUP BY cuisine
      ORDER BY count DESC, cuisine ASC
    `;
    return rows;
  }),

  // Общее количество — нужно чтобы отличить «БД пуста» от «фильтр ничего не нашёл».
  getStats: publicProcedure.query(async () => {
    const rows = await client<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM recipes
    `;
    return { total: rows[0]?.count ?? 0 };
  }),
});
