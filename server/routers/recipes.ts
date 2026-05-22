import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, ilike, lt, type SQL } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { client, db } from '../db/index';
import { recipes, recipeIngredients, recipeSteps } from '../db/schema';
import { scrapeRecipe } from '../services/recipeScraper';
import { startSectionImport, getActiveJob, cancelActiveJob } from '../services/sectionImport';

const PAGE_SIZE = 20;

// --- Reusable input schemas ---

const ingredientInput = z.object({
  name: z.string().min(1, 'Название ингредиента не может быть пустым').max(200),
  amount: z.number().nullable(),
  unit: z.string().max(50).nullable().optional(),
  groupName: z.string().max(100).nullable().optional(),
});

const stepInput = z.object({
  instruction: z.string().min(1, 'Инструкция шага не может быть пустой'),
  imageUrl: z.string().max(2000).nullable().optional(),
  timerMinutes: z.number().int().positive().nullable(),
});

const recipeFields = z.object({
  title: z.string().min(1, 'Название обязательно').max(300),
  description: z.string().nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  servings: z.number().int().min(1).max(100),
  prepTime: z.number().int().min(0).max(10000).nullable().optional(),
  cookTime: z.number().int().min(0).max(10000).nullable().optional(),
  totalTime: z.number().int().min(0).max(10000).nullable().optional(),
  sourceUrl: z.string().max(2000).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  cuisine: z.string().max(100).nullable().optional(),
  difficulty: z.string().max(50).nullable().optional(),
  calories: z.number().int().min(0).max(20000).nullable().optional(),
  ingredients: z.array(ingredientInput).max(200),
  steps: z.array(stepInput).max(100),
});

// Хелпер для конвертации payload → row для recipes.
// amount хранится как numeric (строка) — конвертим из number → string.
function toRecipeRow(input: z.infer<typeof recipeFields>) {
  return {
    title: input.title,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    servings: input.servings,
    prepTime: input.prepTime ?? null,
    cookTime: input.cookTime ?? null,
    totalTime: input.totalTime ?? null,
    sourceUrl: input.sourceUrl ?? null,
    source: input.source ?? null,
    category: input.category ?? null,
    cuisine: input.cuisine ?? null,
    difficulty: input.difficulty ?? null,
    calories: input.calories ?? null,
  };
}

export const recipesRouter = router({
  // --- READ ---

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

  getStats: publicProcedure.query(async () => {
    const rows = await client<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM recipes
    `;
    return { total: rows[0]?.count ?? 0 };
  }),

  // --- WRITE ---

  // Создание: вставка recipe + ингредиентов + шагов в одной транзакции.
  create: publicProcedure
    .input(recipeFields)
    .mutation(async ({ input }) => {
      return await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(recipes)
          .values(toRecipeRow(input))
          .returning({ id: recipes.id });

        if (input.ingredients.length > 0) {
          await tx.insert(recipeIngredients).values(
            input.ingredients.map((ing, idx) => ({
              recipeId: created.id,
              name: ing.name,
              amount: ing.amount !== null ? String(ing.amount) : null,
              unit: ing.unit ?? null,
              groupName: ing.groupName ?? null,
              sortOrder: idx,
            })),
          );
        }

        if (input.steps.length > 0) {
          await tx.insert(recipeSteps).values(
            input.steps.map((s, idx) => ({
              recipeId: created.id,
              stepNumber: idx + 1,
              instruction: s.instruction,
              imageUrl: s.imageUrl ?? null,
              timerMinutes: s.timerMinutes,
            })),
          );
        }

        return { id: created.id };
      });
    }),

  // Обновление: ингредиенты и шаги перезаписываются полностью (DELETE + INSERT).
  // Это проще и безопаснее чем diff'ить, для домашнего приложения подходит.
  update: publicProcedure
    .input(recipeFields.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      return await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: recipes.id })
          .from(recipes)
          .where(eq(recipes.id, input.id))
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Рецепт не найден',
          });
        }

        await tx
          .update(recipes)
          .set({ ...toRecipeRow(input), updatedAt: new Date() })
          .where(eq(recipes.id, input.id));

        await tx
          .delete(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, input.id));
        await tx
          .delete(recipeSteps)
          .where(eq(recipeSteps.recipeId, input.id));

        if (input.ingredients.length > 0) {
          await tx.insert(recipeIngredients).values(
            input.ingredients.map((ing, idx) => ({
              recipeId: input.id,
              name: ing.name,
              amount: ing.amount !== null ? String(ing.amount) : null,
              unit: ing.unit ?? null,
              groupName: ing.groupName ?? null,
              sortOrder: idx,
            })),
          );
        }

        if (input.steps.length > 0) {
          await tx.insert(recipeSteps).values(
            input.steps.map((s, idx) => ({
              recipeId: input.id,
              stepNumber: idx + 1,
              instruction: s.instruction,
              imageUrl: s.imageUrl ?? null,
              timerMinutes: s.timerMinutes,
            })),
          );
        }

        return { id: input.id };
      });
    }),

  // Удаление: каскадно удаляет ингредиенты и шаги (FK ON DELETE CASCADE).
  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await db
        .delete(recipes)
        .where(eq(recipes.id, input.id))
        .returning({ id: recipes.id });
      if (result.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Рецепт не найден',
        });
      }
      return { id: input.id };
    }),

  // Импорт по URL: скрейп с сайта → сохранение в БД одной транзакцией.
  importFromUrl: publicProcedure
    .input(z.object({ url: z.string().url('Некорректный URL') }))
    .mutation(async ({ input }) => {
      let scraped;
      try {
        scraped = await scrapeRecipe(input.url);
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            err instanceof Error
              ? err.message
              : 'Не удалось импортировать рецепт',
        });
      }

      return await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(recipes)
          .values({
            title: scraped.title,
            description: scraped.description,
            imageUrl: scraped.imageUrl,
            servings: scraped.servings,
            prepTime: scraped.prepTime,
            cookTime: scraped.cookTime,
            totalTime: scraped.totalTime,
            sourceUrl: scraped.sourceUrl,
            source: scraped.source,
            category: scraped.category,
            cuisine: scraped.cuisine,
            difficulty: scraped.difficulty,
            calories: scraped.calories,
          })
          .returning({ id: recipes.id });

        if (scraped.ingredients.length > 0) {
          await tx.insert(recipeIngredients).values(
            scraped.ingredients.map((ing, idx) => ({
              recipeId: created.id,
              name: ing.name,
              amount: ing.amount !== null ? String(ing.amount) : null,
              unit: ing.unit,
              groupName: ing.groupName,
              sortOrder: idx,
            })),
          );
        }

        if (scraped.steps.length > 0) {
          await tx.insert(recipeSteps).values(
            scraped.steps.map((s, idx) => ({
              recipeId: created.id,
              stepNumber: idx + 1,
              instruction: s.instruction,
              imageUrl: s.imageUrl,
              timerMinutes: s.timerMinutes,
            })),
          );
        }

        return { id: created.id };
      });
    }),

  // --- SECTION IMPORT (Блок 7) ---

  importSectionStart: publicProcedure
    .input(z.object({ url: z.string().url('Некорректный URL раздела') }))
    .mutation(({ input }) => {
      try {
        const job = startSectionImport(input.url);
        return { jobId: job.id };
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Ошибка запуска импорта',
        });
      }
    }),

  importSectionStatus: publicProcedure.query(() => {
    return getActiveJob();
  }),

  importSectionCancel: publicProcedure.mutation(() => {
    const ok = cancelActiveJob();
    if (!ok) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Нет активного импорта для отмены',
      });
    }
    return { cancelled: true };
  }),

  // --- B.4 «Что приготовить» из имеющегося инвентаря ---
  // Для топ-N рецептов считает сколько ингредиентов есть в инвентаре
  // и использует ли рецепт скоропортящиеся продукты.
  matchWithInventory: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(100),
        expiringDays: z.number().int().min(1).max(30).default(3),
      }),
    )
    .query(async ({ input }) => {
      const { inventory } = await import('../db/schema');
      const { isNotNull, lte } = await import('drizzle-orm');

      // 1. Топ-N последних рецептов
      const recipeRows = await db
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
        .orderBy(desc(recipes.id))
        .limit(input.limit);

      if (recipeRows.length === 0) {
        return [];
      }

      // 2. Все ингредиенты этих рецептов одним запросом
      const recipeIds = recipeRows.map((r) => r.id);
      const allIngs = await client<{ recipe_id: number; name: string }[]>`
        SELECT recipe_id, name
        FROM recipe_ingredients
        WHERE recipe_id = ANY(${recipeIds})
      `;

      // 3. Весь инвентарь (для матчинга)
      const inv = await db
        .select({ name: inventory.productName })
        .from(inventory)
        .where(eq(inventory.userId, 1));

      // 4. Истекающие продукты
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + input.expiringDays);
      const limitStr = limitDate.toISOString().slice(0, 10);
      const expiringRows = await db
        .select({ name: inventory.productName })
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, 1),
            isNotNull(inventory.expiryDate),
            lte(inventory.expiryDate, limitStr),
          ),
        );

      // Нормализуем имена для матчинга (lowercase, trim)
      const norm = (s: string) => s.toLowerCase().trim();
      const invSet = new Set(inv.map((i) => norm(i.name)));
      const expiringSet = new Set(expiringRows.map((e) => norm(e.name)));

      // Проверка: ингредиент есть в инвентаре?
      // Делаем нечёткий поиск — ingredient name содержит inv name (или наоборот)
      const ingredientInInventory = (ingName: string, set: Set<string>): boolean => {
        const n = norm(ingName);
        if (set.has(n)) return true;
        for (const invName of set) {
          if (n.includes(invName) || invName.includes(n)) return true;
        }
        return false;
      };

      // Группируем ингредиенты по recipe_id
      const ingsByRecipe = new Map<number, string[]>();
      for (const row of allIngs) {
        if (!ingsByRecipe.has(row.recipe_id)) ingsByRecipe.set(row.recipe_id, []);
        ingsByRecipe.get(row.recipe_id)!.push(row.name);
      }

      // Считаем для каждого рецепта
      const result = recipeRows.map((r) => {
        const ings = ingsByRecipe.get(r.id) ?? [];
        const totalCount = ings.length;
        let haveCount = 0;
        let expiringCount = 0;

        for (const ing of ings) {
          if (ingredientInInventory(ing, invSet)) haveCount++;
          if (expiringSet.size > 0 && ingredientInInventory(ing, expiringSet)) {
            expiringCount++;
          }
        }

        return {
          ...r,
          totalCount,
          haveCount,
          expiringCount,
          missingCount: totalCount - haveCount,
        };
      });

      // Сортируем: сначала рецепты со скоропортящимися, потом по % имеющихся
      result.sort((a, b) => {
        if (a.expiringCount !== b.expiringCount) return b.expiringCount - a.expiringCount;
        const aPct = a.totalCount === 0 ? 0 : a.haveCount / a.totalCount;
        const bPct = b.totalCount === 0 ? 0 : b.haveCount / b.totalCount;
        return bPct - aPct;
      });

      return result;
    }),

  // --- ГОТОВИТЬ (п.8 Этап 0) ---
  // Списывает ингредиенты рецепта из инвентаря по FEFO (сначала истекающие)
  // и пишет факт готовки в cooking_history (для HistoryPage / Dashboard).
  cook: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { inventory, cookingHistory } = await import('../db/schema');
      const { asc } = await import('drizzle-orm');

      // Получить рецепт (метаданные нужны для снапшота в cooking_history)
      const [recipe] = await db
        .select({
          id: recipes.id,
          title: recipes.title,
          servings: recipes.servings,
          calories: recipes.calories,
          category: recipes.category,
          cuisine: recipes.cuisine,
        })
        .from(recipes)
        .where(eq(recipes.id, input.id))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Рецепт не найден' });
      }

      // Получить ингредиенты рецепта
      const ingredients = await db
        .select()
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, input.id));

      if (ingredients.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'У рецепта нет ингредиентов' });
      }

      let consumed = 0;

      for (const ing of ingredients) {
        // Найти в инвентаре по названию (case-insensitive), сортировка по сроку (FEFO)
        const matches = await db
          .select()
          .from(inventory)
          .where(
            and(
              eq(inventory.userId, 1),
              ilike(inventory.productName, ing.name),
            ),
          )
          .orderBy(asc(inventory.expiryDate));

        if (matches.length > 0) {
          // Удаляем первый (самый скоро истекающий)
          await db.delete(inventory).where(eq(inventory.id, matches[0].id));
          consumed++;
        }
      }

      // Записываем факт готовки в историю — снапшотом, чтобы не зависеть
      // от рецепта (он может быть позже отредактирован/удалён).
      await db.insert(cookingHistory).values({
        userId: 1,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        servings: recipe.servings ?? 1,
        caloriesPerServing: recipe.calories ?? null,
        category: recipe.category ?? null,
        cuisine: recipe.cuisine ?? null,
        consumedCount: consumed,
        totalIngredients: ingredients.length,
      });

      return { consumed, total: ingredients.length };
    }),
});
