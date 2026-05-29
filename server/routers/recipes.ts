import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, ilike, lt, type SQL } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { client, db } from '../db/index';
import { recipes, recipeIngredients, recipeSteps } from '../db/schema';
import { scrapeRecipe } from '../services/recipeScraper';
import { startSectionImport, getActiveJob, cancelActiveJob } from '../services/sectionImport';
import { calcRecipeNutrition } from '../services/nutritionCalc';
import { normalizeRecipeCategory } from '../services/categoryNormalize';

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
    category: normalizeRecipeCategory(input.category),
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
    // Защитное слияние: сводим варианты («Десерт»/«десерт»/«Десерты»)
    // к каноничной метке и суммируем счётчики. Корректно даже если в БД
    // ещё остались ненормализованные значения (до прогона миграции 026).
    const merged = new Map<string, number>();
    for (const r of rows) {
      const canonical = normalizeRecipeCategory(r.category) ?? r.category;
      merged.set(canonical, (merged.get(canonical) ?? 0) + r.count);
    }
    return [...merged.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'ru'));
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
            category: normalizeRecipeCategory(scraped.category),
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
  // Пересчёт КБЖУ всех рецептов. Batch по 10 параллельно, чтобы
  // на 15000 рецептов не упасть по таймауту (было ~1 рецепт/сек).
  recalcAllNutrition: protectedProcedure.mutation(async () => {
    const allRecipes = await db.select({ id: recipes.id }).from(recipes);
    let updated = 0;
    let failed = 0;
    const BATCH = 10;
    for (let i = 0; i < allRecipes.length; i += BATCH) {
      const batch = allRecipes.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((r) => calcRecipeNutrition(r.id))
      );
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value && res.value.matched > 0) {
          updated++;
        } else if (res.status === 'rejected') {
          failed++;
        }
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
    .query(async ({ input, ctx }) => {
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
        .where(eq(inventory.userId, ctx.userId));

      // Заготовки тоже считаются доступными ингредиентами
      const { preserves } = await import('../db/schema');
      const preserveRows = await db
        .select({ name: preserves.name })
        .from(preserves)
        .where(eq(preserves.userId, ctx.userId));

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
            eq(inventory.userId, ctx.userId),
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

  // --- ГОТОВИТЬ (п.8 Этап 0) — ЧАСТИЧНОЕ СПИСАНИЕ ---
  // Списывает ингредиенты рецепта из инвентаря по FEFO (сначала истекающие).
  // НОВАЯ ЛОГИКА: списывает ТОЛЬКО нужное количество, а не весь продукт.
  //
  // Алгоритм для каждого ингредиента рецепта:
  //   1. Нечёткий матчинг по названию (как раньше)
  //   2. Если amount в рецепте и quantity в инвентаре оба указаны:
  //      a) Приводим к общей единице (конвертация кг↔г, л↔мл и т.д.)
  //      b) Если в инвентаре >= нужного → уменьшаем quantity на нужное
  //      c) Если в инвентаре < нужного → обнуляем (удаляем) + недостаток в shopping
  //   3. Если amount или quantity не указаны → fallback: удаляем целиком
  //   4. Если продукт стал 0 → удаляем запись из инвентаря
  //
  // Всё в одной транзакции.
  cook: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const { inventory, cookingHistory } = await import('../db/schema');
      const { asc } = await import('drizzle-orm');

      // --- Таблица конвертации единиц ---
      // Приводим все к базовой единице (г для массы, мл для объёма, шт для штук)
      const UNIT_TO_BASE: Record<string, { base: string; factor: number }> = {
        // Масса → граммы
        'г': { base: 'г', factor: 1 },
        'гр': { base: 'г', factor: 1 },
        'грамм': { base: 'г', factor: 1 },
        'кг': { base: 'г', factor: 1000 },
        'килограмм': { base: 'г', factor: 1000 },
        // Объём → миллилитры
        'мл': { base: 'мл', factor: 1 },
        'л': { base: 'мл', factor: 1000 },
        'литр': { base: 'мл', factor: 1000 },
        'ст.л.': { base: 'мл', factor: 15 },
        'ст. л.': { base: 'мл', factor: 15 },
        'ст.л': { base: 'мл', factor: 15 },
        'столовая ложка': { base: 'мл', factor: 15 },
        'ч.л.': { base: 'мл', factor: 5 },
        'ч. л.': { base: 'мл', factor: 5 },
        'ч.л': { base: 'мл', factor: 5 },
        'чайная ложка': { base: 'мл', factor: 5 },
        'стакан': { base: 'мл', factor: 250 },
        'стак.': { base: 'мл', factor: 250 },
        // Штуки
        'шт': { base: 'шт', factor: 1 },
        'шт.': { base: 'шт', factor: 1 },
        'штука': { base: 'шт', factor: 1 },
        'штук': { base: 'шт', factor: 1 },
      };

      /** Нормализация единицы измерения */
      const normalizeUnit = (u: string | null | undefined): string | null => {
        if (!u) return null;
        const lower = u.toLowerCase().trim().replace(/\.$/, '');
        // Попробуем найти как есть и без точки
        if (UNIT_TO_BASE[lower]) return lower;
        if (UNIT_TO_BASE[lower + '.']) return lower + '.';
        // Попробуем с точкой на конце
        const withDot = lower + '.';
        if (UNIT_TO_BASE[withDot]) return withDot;
        return lower;
      };

      /** Конвертировать количество в базовые единицы. Возвращает null если единица неизвестна */
      const toBase = (amount: number, unit: string | null | undefined): { value: number; base: string } | null => {
        if (!unit) return null;
        const norm = normalizeUnit(unit);
        if (!norm) return null;
        const conv = UNIT_TO_BASE[norm] || UNIT_TO_BASE[norm + '.'] || UNIT_TO_BASE[norm.replace(/\.$/, '')];
        if (!conv) return null;
        return { value: amount * conv.factor, base: conv.base };
      };

      /** Конвертировать из базовых единиц обратно в указанную единицу */
      const fromBase = (baseValue: number, unit: string | null | undefined): number => {
        if (!unit) return baseValue;
        const norm = normalizeUnit(unit);
        if (!norm) return baseValue;
        const conv = UNIT_TO_BASE[norm] || UNIT_TO_BASE[norm + '.'] || UNIT_TO_BASE[norm.replace(/\.$/, '')];
        if (!conv) return baseValue;
        return baseValue / conv.factor;
      };

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
          .where(eq(inventory.userId, ctx.userId))
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

        // Трекаем уже полностью списанные ID чтобы не матчить дважды
        const deletedIds = new Set<number>();
        // Трекаем уменьшенные количества (id → оставшееся в базовых единицах)
        const adjustedQuantities = new Map<number, number>();

        interface MissingItem {
          name: string;
          quantity: string | null;
          unit: string | null;
        }
        const missingItems: MissingItem[] = [];

        for (const ing of ingredients) {
          const neededAmount = ing.amount ? parseFloat(ing.amount) : null;
          const neededUnit = ing.unit;

          // Найти все подходящие продукты по FEFO (массив уже отсортирован по expiryDate)
          const matches = allInv.filter(
            item => !deletedIds.has(item.id) && isMatch(ing.name, item.productName)
          );

          if (matches.length === 0) {
            // Ингредиент не найден в инвентаре — целиком в shopping
            missingItems.push({
              name: ing.name,
              quantity: ing.amount,
              unit: neededUnit,
            });
            continue;
          }

          // Если amount не указан в рецепте — fallback: удаляем первый найденный целиком
          if (neededAmount == null || isNaN(neededAmount) || neededAmount <= 0) {
            const first = matches[0];
            await tx.delete(inventory).where(eq(inventory.id, first.id));
            deletedIds.add(first.id);
            consumed++;
            continue;
          }

          // Пытаемся списать нужное количество из одного или нескольких продуктов
          const neededBase = toBase(neededAmount, neededUnit);
          let remainingToConsume = neededBase ? neededBase.value : neededAmount;
          let usedBaseUnit = neededBase?.base || null;
          let partiallyConsumed = false;

          for (const invItem of matches) {
            if (deletedIds.has(invItem.id)) continue;
            if (remainingToConsume <= 0) break;

            const invQty = invItem.quantity ? parseFloat(invItem.quantity) : null;

            // Если quantity не указан в инвентаре — удаляем целиком (старое поведение)
            if (invQty == null || isNaN(invQty) || invQty <= 0) {
              await tx.delete(inventory).where(eq(inventory.id, invItem.id));
              deletedIds.add(invItem.id);
              remainingToConsume = 0; // считаем что хватило
              partiallyConsumed = true;
              break;
            }

            // Приводим к базовым единицам для сравнения
            const invBase = toBase(invQty, invItem.unit);
            // Берём текущее скорректированное значение если уже уменьшали
            let availableBase: number;
            if (invBase && usedBaseUnit && invBase.base === usedBaseUnit) {
              availableBase = adjustedQuantities.has(invItem.id)
                ? adjustedQuantities.get(invItem.id)!
                : invBase.value;
            } else if (!usedBaseUnit || !invBase) {
              // Единицы несовместимы или не распознаны — сравниваем напрямую
              availableBase = adjustedQuantities.has(invItem.id)
                ? adjustedQuantities.get(invItem.id)!
                : invQty;
              usedBaseUnit = null;
            } else {
              // Единицы разных типов (масса vs объём) — удаляем целиком
              await tx.delete(inventory).where(eq(inventory.id, invItem.id));
              deletedIds.add(invItem.id);
              remainingToConsume = 0;
              partiallyConsumed = true;
              break;
            }

            if (availableBase <= 0) continue;

            if (availableBase >= remainingToConsume) {
              // В инвентаре >= нужного → уменьшаем
              const leftoverBase = availableBase - remainingToConsume;

              if (leftoverBase < 0.01) {
                // Практически ноль — удаляем запись
                await tx.delete(inventory).where(eq(inventory.id, invItem.id));
                deletedIds.add(invItem.id);
              } else {
                // Конвертируем остаток обратно в единицу инвентаря
                const leftoverInOriginal = usedBaseUnit
                  ? fromBase(leftoverBase, invItem.unit)
                  : leftoverBase;
                const rounded = Math.round(leftoverInOriginal * 100) / 100;
                await tx.update(inventory)
                  .set({ quantity: String(rounded), updatedAt: new Date() })
                  .where(eq(inventory.id, invItem.id));
                adjustedQuantities.set(invItem.id, leftoverBase);
              }

              remainingToConsume = 0;
              partiallyConsumed = true;
            } else {
              // В инвентаре < нужного → забираем всё, идём к следующему
              remainingToConsume -= availableBase;
              await tx.delete(inventory).where(eq(inventory.id, invItem.id));
              deletedIds.add(invItem.id);
              partiallyConsumed = true;
            }
          }

          if (partiallyConsumed) {
            consumed++;
          }

          // Если после всех продуктов ещё осталось — добавляем недостаток в shopping
          if (remainingToConsume > 0.01) {
            const shortageInOriginal = usedBaseUnit
              ? fromBase(remainingToConsume, neededUnit)
              : remainingToConsume;
            const rounded = Math.round(shortageInOriginal * 100) / 100;
            missingItems.push({
              name: ing.name,
              quantity: String(rounded),
              unit: neededUnit,
            });
          }
        }

        // Авто-добавление недостающих ингредиентов в список покупок.
        // Исключаем «базовые продукты» — соль/масло и т.д. которые всегда есть.
        if (missingItems.length > 0) {
          const { purchaseItems } = await import('../db/schema');

          // Загружаем базовые продукты для исключения
          const basicProducts = await tx
            .select({ productName: inventory.productName })
            .from(inventory)
            .where(and(eq(inventory.userId, ctx.userId), eq(inventory.isBasic, 1)));
          const basicNames = new Set(basicProducts.map(b => norm(b.productName)));

          for (const item of missingItems) {
            // Пропускаем базовые продукты
            if (basicNames.has(norm(item.name))) continue;
            // Проверяем нечёткое совпадение с базовыми
            const itemStem = stem(norm(item.name).split(/\s+/)[0] || '');
            let isBasicMatch = false;
            for (const bn of basicNames) {
              const bnStem = stem(bn.split(/\s+/)[0] || '');
              if (bnStem.length >= 3 && itemStem.length >= 3 && (bnStem.includes(itemStem) || itemStem.includes(bnStem))) {
                isBasicMatch = true;
                break;
              }
            }
            if (isBasicMatch) continue;

            // Не добавляем если уже есть в покупках (нечувствительно к регистру)
            const existing = await tx
              .select({ id: purchaseItems.id })
              .from(purchaseItems)
              .where(
                and(
                  eq(purchaseItems.userId, ctx.userId),
                  ilike(purchaseItems.productName, item.name),
                ),
              )
              .limit(1);

            if (existing.length === 0) {
              await tx.insert(purchaseItems).values({
                userId: ctx.userId,
                productName: item.name,
                quantity: item.quantity,
                unit: item.unit,
                recipeSource: recipe.title,
              });
            }
          }
        }

        // Записываем факт готовки в историю — снапшотом, чтобы не зависеть
        // от рецепта (он может быть позже отредактирован/удалён).
        await tx.insert(cookingHistory).values({
          userId: ctx.userId,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          servings: recipe.servings ?? 1,
          caloriesPerServing: recipe.calories ?? null,
          category: recipe.category ?? null,
          cuisine: recipe.cuisine ?? null,
          consumedCount: consumed,
          totalIngredients: ingredients.length,
        });

        // Создаём запись в preserves типа 'cooked' — готовое блюдо с порциями.
        // Это позволяет отслеживать сколько порций осталось после приготовления.
        const { preserves } = await import('../db/schema');
        const today = new Date().toISOString().slice(0, 10);
        // Срок хранения готового блюда в холодильнике — 3 дня
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 3);
        const expiryStr = expiryDate.toISOString().slice(0, 10);

        await tx.insert(preserves).values({
          userId: ctx.userId,
          preserveType: 'cooked',
          name: recipe.title,
          servings: recipe.servings ?? 1,
          preparedAt: today,
          expiryDate: expiryStr,
          notes: `Приготовлено из рецепта`,
        });

        // Проверяем minQuantity — если после списания какой-то продукт
        // упал ниже минимума, авто-добавляем в покупки.
        // Берём свежий снапшот инвентаря (после всех update/delete выше).
        const { purchaseItems: purchaseItemsTable } = await import('../db/schema');
        const updatedInv = await tx
          .select()
          .from(inventory)
          .where(eq(inventory.userId, ctx.userId));

        let autoAdded = 0;
        for (const item of updatedInv) {
          if (!item.minQuantity) continue;
          const qty = item.quantity ? parseFloat(item.quantity) : 0;
          const minQty = parseFloat(item.minQuantity);
          if (isNaN(minQty) || minQty <= 0) continue;
          if (qty >= minQty) continue;

          // Проверяем что этого продукта ещё нет в покупках
          const alreadyInShopping = await tx
            .select({ id: purchaseItemsTable.id })
            .from(purchaseItemsTable)
            .where(
              and(
                eq(purchaseItemsTable.userId, ctx.userId),
                ilike(purchaseItemsTable.productName, item.productName),
              ),
            )
            .limit(1);

          if (alreadyInShopping.length === 0) {
            await tx.insert(purchaseItemsTable).values({
              userId: ctx.userId,
              productName: item.productName,
              quantity: String(minQty),
              unit: item.unit,
            });
            autoAdded++;
          }
        }

        return { consumed, total: ingredients.length, addedToShopping: missingItems.length + autoAdded };
      });
    }),

  // --- ИМПОРТ ИЗ YOUTUBE ---
  // Принимает URL видео, извлекает описание + субтитры,
  // отправляет в Gemini AI для структурирования в рецепт.
  importFromYoutube: protectedProcedure
    .input(z.object({ url: z.string().min(10).max(500) }))
    .mutation(async ({ input }) => {
      const { extractVideoId, getVideoInfo, getVideoCaptions, extractLinksFromDescription } = await import('../services/youtube');

      // 1. Извлечь video ID
      const videoId = extractVideoId(input.url);
      if (!videoId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Некорректная ссылка на YouTube. Поддерживаются: youtube.com/watch?v=..., youtu.be/..., shorts/...',
        });
      }

      // 2. Получить информацию о видео
      const videoInfo = await getVideoInfo(videoId);
      if (!videoInfo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Видео не найдено. Проверь ссылку.',
        });
      }

      // 3. Проверить есть ли ссылка на сайт с рецептом в описании
      const siteLinks = extractLinksFromDescription(videoInfo.description);

      // 4. Получить субтитры (если доступны)
      let captions: string | null = null;
      try {
        captions = await getVideoCaptions(videoId);
      } catch {
        // Субтитры недоступны — не критично
      }

      // 5. Собрать текст для AI
      const textForAI = [
        `Название видео: ${videoInfo.title}`,
        `Канал: ${videoInfo.channelTitle}`,
        '',
        'Описание видео:',
        videoInfo.description.slice(0, 3000),
        '',
        captions ? `Субтитры (первые 4000 символов):\n${captions.slice(0, 4000)}` : '',
      ].filter(Boolean).join('\n');

      if (textForAI.length < 50) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Не удалось извлечь достаточно текста из видео. Попробуй добавить рецепт вручную.',
        });
      }

      // 6. Отправить в Gemini AI для извлечения рецепта
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'GEMINI_API_KEY не настроен.',
        });
      }

      const prompt = `Ты — кулинарный эксперт. Из текста ниже (название, описание, субтитры) восстанови рецепт и верни ТОЛЬКО JSON (без markdown, без \`\`\`):

{
  "title": "Название блюда на русском",
  "description": "Краткое описание (1-2 предложения)",
  "servings": 4,
  "prepTime": null,
  "cookTime": null,
  "totalTime": null,
  "category": "Завтраки/Супы/Салаты/Основные блюда/Десерты/Закуски/Соусы/Выпечка/Напитки",
  "cuisine": "Русская/Итальянская/...",
  "difficulty": "Легко/Средне/Сложно",
  "ingredients": [
    { "name": "Название ингредиента", "amount": 200, "unit": "г" }
  ],
  "steps": [
    { "instruction": "Шаг приготовления" }
  ]
}

Правила:
- Если количество не указано — amount: null
- Единицы: г, кг, мл, л, шт, ст.л., ч.л., стакан
- ВАЖНО: шаги приготовления почти никогда не записаны явным нумерованным списком. Извлекай их из описания и субтитров — реконструируй последовательность действий своими словами в логичном порядке. Даже если в тексте только разговорная речь автора, выдели из неё этапы готовки и сформулируй их как чёткие шаги.
- Шаги — по порядку, без нумерации в тексте
- НЕ отказывайся, если шаги не оформлены явно — твоя задача восстановить их из контекста.
- Возвращай {"error": "причина"} ТОЛЬКО если в тексте вообще нет кулинарной информации (нет ни ингредиентов, ни процесса готовки).

Текст:
${textForAI}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Gemini API вернул ошибку ${res.status}. Попробуй позже.`,
          });
        }

        const data = await res.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // Убираем markdown обёртку если есть
        const jsonText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let parsed: any;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'AI не смог извлечь рецепт из этого видео. Попробуй видео где автор проговаривает ингредиенты и шаги.',
          });
        }

        if (parsed.error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `AI не нашёл рецепт: ${parsed.error}`,
          });
        }

        // 7. Сохранить рецепт в БД
        const result = await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(recipes)
            .values({
              title: parsed.title || videoInfo.title,
              description: parsed.description || null,
              imageUrl: videoInfo.thumbnailUrl,
              servings: parsed.servings || 4,
              prepTime: parsed.prepTime || null,
              cookTime: parsed.cookTime || null,
              totalTime: parsed.totalTime || null,
              sourceUrl: input.url,
              source: `YouTube: ${videoInfo.channelTitle}`,
              category: normalizeRecipeCategory(parsed.category),
              cuisine: parsed.cuisine || null,
              difficulty: parsed.difficulty || null,
              calories: null,
            })
            .returning({ id: recipes.id });

          if (parsed.ingredients?.length > 0) {
            await tx.insert(recipeIngredients).values(
              parsed.ingredients.map((ing: any, idx: number) => ({
                recipeId: created.id,
                name: ing.name || 'Без названия',
                amount: ing.amount != null ? String(ing.amount) : null,
                unit: ing.unit || null,
                groupName: ing.groupName || null,
                sortOrder: idx,
              })),
            );
          }

          if (parsed.steps?.length > 0) {
            await tx.insert(recipeSteps).values(
              parsed.steps.map((s: any, idx: number) => ({
                recipeId: created.id,
                stepNumber: idx + 1,
                instruction: s.instruction || s,
                imageUrl: null,
                timerMinutes: s.timerMinutes || null,
              })),
            );
          }

          return { id: created.id };
        });

        // 8. Авто-расчёт КБЖУ
        try {
          await calcRecipeNutrition(result.id);
        } catch {
          // Не критично
        }

        return {
          id: result.id,
          title: parsed.title || videoInfo.title,
          ingredientsCount: parsed.ingredients?.length || 0,
          stepsCount: parsed.steps?.length || 0,
          siteLinks, // ссылки на сайты из описания (если AI не справился — пользователь может импортировать оттуда)
        };
      } finally {
        clearTimeout(timeout);
      }
    }),
});
