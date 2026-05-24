import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, ilike, lt, type SQL } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { client, db } from '../db/index';
import { recipes, recipeIngredients, recipeSteps } from '../db/schema';
import { scrapeRecipe } from '../services/recipeScraper';
import { startSectionImport, getActiveJob, cancelActiveJob } from '../services/sectionImport';
import { calcRecipeNutrition } from '../services/nutritionCalc';

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

  list: protectedProcedure
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

  getById: protectedProcedure
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

  getCategories: protectedProcedure.query(async () => {
    const rows = await client<{ category: string; count: number }[]>`
      SELECT category, COUNT(*)::int AS count
      FROM recipes
      WHERE category IS NOT NULL AND category <> ''
      GROUP BY category
      ORDER BY count DESC, category ASC
    `;
    return rows;
  }),

  getCuisines: protectedProcedure.query(async () => {
    const rows = await client<{ cuisine: string; count: number }[]>`
      SELECT cuisine, COUNT(*)::int AS count
      FROM recipes
      WHERE cuisine IS NOT NULL AND cuisine <> ''
      GROUP BY cuisine
      ORDER BY count DESC, cuisine ASC
    `;
    return rows;
  }),

  getStats: protectedProcedure.query(async () => {
    const rows = await client<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM recipes
    `;
    return { total: rows[0]?.count ?? 0 };
  }),

  // --- WRITE ---

  // Создание: вставка recipe + ингредиентов + шагов в одной транзакции.
  create: protectedProcedure
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
  update: protectedProcedure
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
  delete: protectedProcedure
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
  // Если рецепт на английском (или другом не-русском) — автоматически
  // переводим на русский через DeepL. Переводятся: название, описание,
  // имена ингредиентов, инструкции шагов. Тексты которые уже на русском
  // не трогаются (детектится по наличию кириллицы).
  importFromUrl: protectedProcedure
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

      // Авто-перевод EN→RU (best-effort, не блокирует импорт)
      try {
        const { translatePlainBatch } = await import('../services/translate');

        // Собираем все тексты для перевода в один массив (для batch-запроса)
        const titlesToTranslate = [
          scraped.title,
          scraped.description ?? '',
          scraped.category ?? '',
          scraped.cuisine ?? '',
        ];
        const ingredientNames = scraped.ingredients.map(i => i.name);
        const stepInstructions = scraped.steps.map(s => s.instruction);

        const allTexts = [
          ...titlesToTranslate,
          ...ingredientNames,
          ...stepInstructions,
        ];

        const translated = await translatePlainBatch(allTexts);

        // Применяем переводы обратно
        scraped.title = translated[0] || scraped.title;
        scraped.description = translated[1] || scraped.description;
        scraped.category = translated[2] || scraped.category;
        scraped.cuisine = translated[3] || scraped.cuisine;

        const ingStart = 4;
        for (let i = 0; i < scraped.ingredients.length; i++) {
          scraped.ingredients[i].name = translated[ingStart + i] || scraped.ingredients[i].name;
        }

        const stepStart = ingStart + ingredientNames.length;
        for (let i = 0; i < scraped.steps.length; i++) {
          scraped.steps[i].instruction = translated[stepStart + i] || scraped.steps[i].instruction;
        }
      } catch (err) {
        console.warn('[importFromUrl] перевод не удался:', err);
        // Не страшно — сохраним как есть
      }

      const result = await db.transaction(async (tx) => {
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

      // Авто-расчёт КБЖУ по справочнику USDA (best-effort).
      // Сайты-источники редко указывают КБЖУ в JSON-LD, особенно русские.
      // Поэтому после сохранения проходимся по ингредиентам и считаем
      // калории/белки/жиры/углеводы из локального справочника.
      // Не блокирует импорт: если расчёт упал (нет данных в USDA для
      // этих ингредиентов и т.п.) — рецепт всё равно сохранён.
      try {
        await calcRecipeNutrition(result.id);
      } catch (err) {
        console.warn(
          `[importFromUrl] calcRecipeNutrition failed for recipe ${result.id}:`,
          err,
        );
      }

      return result;
    }),

  // --- SECTION IMPORT (Блок 7) ---

  importSectionStart: protectedProcedure
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

  importSectionStatus: protectedProcedure.query(() => {
    return getActiveJob();
  }),

  importSectionCancel: protectedProcedure.mutation(() => {
    const ok = cancelActiveJob();
    if (!ok) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Нет активного импорта для отмены',
      });
    }
    return { cancelled: true };
  }),

  // Пересчёт КБЖУ для всех рецептов в базе (кнопка в Настройках).
  // Идём по всем рецептам и для каждого вызываем calcRecipeNutrition.
  // Если matched === 0 (ингредиенты не нашлись в USDA) — рецепт остаётся
  // как был, не затирается. Возвращаем сколько реально обновилось.
  //
  // Время выполнения: ~0.5–1 с на рецепт (зависит от числа ингредиентов
  // и сети до Neon). Для 100 рецептов это ~1–2 минуты — запрос блокирующий,
  // фронт показывает спиннер. Если рецептов сильно больше — нужно будет
  // переделать в job с прогрессом, как sectionImport.
  recalcAllNutrition: protectedProcedure.mutation(async () => {
    const allRecipes = await db.select({ id: recipes.id }).from(recipes);
    let updated = 0;
    let failed = 0;
    for (const r of allRecipes) {
      try {
        const result = await calcRecipeNutrition(r.id);
        if (result && result.matched > 0) updated++;
      } catch (err) {
        failed++;
        console.warn(`[recalcAllNutrition] recipe ${r.id} failed:`, err);
      }
    }
    return { total: allRecipes.length, updated, failed };
  }),

  // --- B.4 «Что приготовить» из имеющегося инвентаря ---
  // Для топ-N рецептов считает сколько ингредиентов есть в инвентаре
  // и использует ли рецепт скоропортящиеся продукты.
  matchWithInventory: protectedProcedure
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

      // 3. Весь инвентарь (для матчинга) + заготовки (frozen/preserved/opened)
      const inv = await db
        .select({ name: inventory.productName })
        .from(inventory)
        .where(eq(inventory.userId, 1));

      // Заготовки тоже считаются доступными ингредиентами
      const { preserves } = await import('../db/schema');
      const preserveRows = await db
        .select({ name: preserves.name })
        .from(preserves)
        .where(eq(preserves.userId, 1));

      // Объединяем инвентарь + заготовки
      const allAvailable = [...inv, ...preserveRows];

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

      // Простой стемминг русских окончаний для нечёткого сравнения
      // "куриные" → "курин", "крылышки" → "крылышк", "крылья" → "крыль"
      const stem = (word: string): string => {
        return word
          .replace(/(ые|ие|ое|ой|ый|ий|ая|яя|ых|их|ого|его|ому|ему|ами|ями|ах|ях|ов|ев|ей|ью|ья|ье|ьи|шки|ки|ка|ко|ку|ek|en|er|es)$/i, '')
          .replace(/(ь|й)$/i, '');
      };

      // Извлечь значимые слова из строки (убрать предлоги, числа, единицы)
      const STOP_WORDS = new Set(['в', 'на', 'с', 'из', 'для', 'по', 'или', 'и', 'а', 'не', 'кг', 'г', 'мл', 'л', 'шт', 'ст', 'ч', 'можно', 'заменить', 'иные', 'части', 'часть']);
      const getKeywords = (s: string): string[] => {
        return norm(s)
          .replace(/[–—\-,.:;!?()\[\]«»"']/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
          .map(stem)
          .filter(w => w.length >= 3);
      };

      // Извлекаем все варианты имени из формата "Original (Перевод)"
      // → ["original", "перевод", "original (перевод)"]
      const extractNames = (s: string): string[] => {
        const full = norm(s);
        const names = [full];
        // Формат "NL text (RU текст)" — извлекаем оба
        const match = full.match(/^(.+?)\s*\((.+?)\)\s*$/);
        if (match) {
          names.push(match[1].trim()); // NL часть
          names.push(match[2].trim()); // RU часть
        }
        return names;
      };

      // Для каждого инвентарного продукта храним все варианты имени + ключевые слова
      const invData = allAvailable.map((i) => ({
        names: extractNames(i.name),
        keywords: getKeywords(i.name),
      }));
      const expiringData = expiringRows.map((e) => ({
        names: extractNames(e.name),
        keywords: getKeywords(e.name),
      }));

      // Проверка: ингредиент есть в инвентаре?
      // 1) Подстрока в обе стороны (как раньше)
      // 2) Пословный матч: если ≥2 ключевых слова совпадают (по стеммам)
      const ingredientInInventory = (ingName: string, dataList: typeof invData): boolean => {
        const n = norm(ingName);
        if (n.length < 2) return false;
        const ingKeywords = getKeywords(ingName);

        for (const item of dataList) {
          // Способ 1: подстрока по вариантам имени
          for (const invName of item.names) {
            if (n === invName) return true;
            if (n.length >= 3 && invName.includes(n)) return true;
            if (invName.length >= 3 && n.includes(invName)) return true;
          }

          // Способ 2: пословный матч по стеммам (≥2 общих слова)
          if (ingKeywords.length >= 2 && item.keywords.length >= 2) {
            let common = 0;
            for (const kw of ingKeywords) {
              if (item.keywords.some(ik => ik === kw || ik.includes(kw) || kw.includes(ik))) {
                common++;
              }
            }
            if (common >= 2) return true;
          }
          // Для коротких названий (1 слово) — совпадение одного стемма достаточно
          if (ingKeywords.length === 1 && item.keywords.length >= 1) {
            const kw = ingKeywords[0];
            if (item.keywords.some(ik => ik === kw || ik.includes(kw) || kw.includes(ik))) {
              return true;
            }
          }
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
          if (ingredientInInventory(ing, invData)) haveCount++;
          if (expiringData.length > 0 && ingredientInInventory(ing, expiringData)) {
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
  //
  // Всё действие обёрнуто в одну транзакцию: либо мы целиком списываем
  // ингредиенты И пишем запись в историю готовки, либо откатываем всё.
  // До этого без транзакции мог получиться частичный сбой — например,
  // половина ингредиентов уже удалена из инвентаря, а insert в
  // cooking_history упал → пользователь видит «исчезли продукты, а в
  // истории ничего нет».
  cook: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { inventory, cookingHistory } = await import('../db/schema');
      const { asc } = await import('drizzle-orm');

      return await db.transaction(async (tx) => {
        // Получить рецепт (метаданные нужны для снапшота в cooking_history)
        const [recipe] = await tx
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
        const ingredients = await tx
          .select()
          .from(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, input.id));

        if (ingredients.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'У рецепта нет ингредиентов' });
        }

        let consumed = 0;

        // Загружаем весь инвентарь для нечёткого матчинга (как в matchWithInventory)
        const allInv = await tx
          .select()
          .from(inventory)
          .where(eq(inventory.userId, 1))
          .orderBy(asc(inventory.expiryDate));

        // Нечёткий матчинг: извлекаем варианты имени + стемминг
        const norm = (s: string) => s.toLowerCase().trim();
        const stem = (word: string): string => {
          return word
            .replace(/(ые|ие|ое|ой|ый|ий|ая|яя|ых|их|ого|его|ому|ему|ами|ями|ах|ях|ов|ев|ей|ью|ья|ье|ьи|шки|ки|ка|ко|ку|ek|en|er|es)$/i, '')
            .replace(/(ь|й)$/i, '');
        };
        const STOP_WORDS = new Set(['в', 'на', 'с', 'из', 'для', 'по', 'или', 'и', 'а', 'не', 'кг', 'г', 'мл', 'л', 'шт', 'ст', 'ч', 'можно', 'заменить', 'иные', 'части', 'часть']);
        const getKeywords = (s: string): string[] => {
          return norm(s)
            .replace(/[–—\-,.:;!?()\[\]«»"']/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
            .map(stem)
            .filter(w => w.length >= 3);
        };
        const extractNames = (s: string): string[] => {
          const full = norm(s);
          const names = [full];
          const match = full.match(/^(.+?)\s*\((.+?)\)\s*$/);
          if (match) {
            names.push(match[1].trim());
            names.push(match[2].trim());
          }
          return names;
        };

        // Проверяем совпадение ингредиента с продуктом инвентаря
        const isMatch = (ingName: string, invProductName: string): boolean => {
          const n = norm(ingName);
          const invNames = extractNames(invProductName);
          // Подстрока в обе стороны
          for (const invName of invNames) {
            if (n === invName) return true;
            if (n.length >= 3 && invName.includes(n)) return true;
            if (invName.length >= 3 && n.includes(invName)) return true;
          }
          // Пословный матч по стеммам
          const ingKw = getKeywords(ingName);
          const invKw = getKeywords(invProductName);
          if (ingKw.length >= 2 && invKw.length >= 2) {
            let common = 0;
            for (const kw of ingKw) {
              if (invKw.some(ik => ik === kw || ik.includes(kw) || kw.includes(ik))) common++;
            }
            if (common >= 2) return true;
          }
          if (ingKw.length === 1 && invKw.length >= 1) {
            const kw = ingKw[0];
            if (invKw.some(ik => ik === kw || ik.includes(kw) || kw.includes(ik))) return true;
          }
          return false;
        };

        // Трекаем уже списанные ID чтобы не списать дважды
        const usedIds = new Set<number>();
        const missingIngredients: string[] = [];

        for (const ing of ingredients) {
          // Найти первый подходящий продукт по FEFO (массив уже отсортирован по expiryDate)
          const match = allInv.find(
            item => !usedIds.has(item.id) && isMatch(ing.name, item.productName)
          );
          if (match) {
            await tx.delete(inventory).where(eq(inventory.id, match.id));
            usedIds.add(match.id);
            consumed++;
          } else {
            // Ингредиент не найден в инвентаре — добавляем в покупки
            missingIngredients.push(ing.name);
          }
        }

        // Авто-добавление недостающих ингредиентов в список покупок
        if (missingIngredients.length > 0) {
          const { purchaseItems } = await import('../db/schema');
          for (const name of missingIngredients) {
            // Не добавляем если уже есть в покупках (нечувствительно к регистру)
            const existing = await tx
              .select({ id: purchaseItems.id })
              .from(purchaseItems)
              .where(
                and(
                  eq(purchaseItems.userId, 1),
                  ilike(purchaseItems.productName, name),
                ),
              )
              .limit(1);

            if (existing.length === 0) {
              await tx.insert(purchaseItems).values({
                userId: 1,
                productName: name,
                recipeSource: recipe.title,
              });
            }
          }
        }

        // Записываем факт готовки в историю — снапшотом, чтобы не зависеть
        // от рецепта (он может быть позже отредактирован/удалён).
        await tx.insert(cookingHistory).values({
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

        return { consumed, total: ingredients.length, addedToShopping: missingIngredients.length };
      });
    }),
});
