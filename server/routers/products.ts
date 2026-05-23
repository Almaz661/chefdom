import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, ilike, or, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { products, ingredients, recipes, recipeIngredients, ingredientSubstitutions } from '../db/schema';
import { translateToRu } from '../services/translate';
import { calcRecipeNutrition } from '../services/nutritionCalc';


export const productsRouter = router({

  // G.3 — поиск товара по штрих-коду (с fallback на Open Food Facts API)
  getByBarcode: protectedProcedure
    .input(z.object({ barcode: z.string().min(1) }))
    .query(async ({ input }) => {
      // 1. Сначала ищем в локальной БД
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.barcode, input.barcode))
        .limit(1);

      if (product) return product;

      // 2. Fallback — Open Food Facts API
      try {
        const offRes = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${input.barcode}.json?fields=product_name,brands,quantity`
        );

        if (!offRes.ok) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден по штрих-коду' });
        }

        const offData = await offRes.json() as {
          status: number;
          product?: { product_name?: string; brands?: string; quantity?: string };
        };

        if (offData.status !== 1 || !offData.product?.product_name) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден по штрих-коду' });
        }

        const offProduct = offData.product;

        // 3. Переводим название NL/EN→RU (DeepL, best-effort)
        const translatedName = await translateToRu(offProduct.product_name!);

        // 4. Сохраняем в локальную БД для будущих запросов
        const [saved] = await db
          .insert(products)
          .values({
            barcode: input.barcode,
            nameRu: translatedName,
            nameNl: offProduct.product_name!,
            brand: offProduct.brands || null,
            packageQuantity: offProduct.quantity || null,
            offId: input.barcode, // маркер что пришло из OFF
          })
          .onConflictDoNothing()
          .returning();

        if (saved) return saved;

        // Если onConflict сработал — значит кто-то уже вставил, читаем заново
        const [existing] = await db
          .select()
          .from(products)
          .where(eq(products.barcode, input.barcode))
          .limit(1);

        if (existing) return existing;

        // Возвращаем данные из OFF без сохранения
        return {
          id: 0,
          barcode: input.barcode,
          nameRu: translatedName,
          brand: offProduct.brands || null,
          packageQuantity: offProduct.quantity || null,
          packageUnit: null,
          offId: input.barcode,
          ingredientId: null,
          nameNl: offProduct.product_name!,
          imageUrl: null,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден по штрих-коду' });
      }
    }),

  // G.3 — поиск товара по названию
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(products)
        .where(ilike(products.nameRu, `%${input.query}%`))
        .limit(20);
      return rows;
    }),

  // G.3 — поиск ингредиента по названию
  searchIngredient: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(ingredients)
        .where(ilike(ingredients.nameRu, `%${input.query}%`))
        .limit(20);
      return rows;
    }),

  // B.3 — получить замены для ингредиента.
  // Поиск нечувствителен к регистру и работает по подстроке:
  // "Сметана 20%" найдёт замены для "Сметана"
  // "Свежий чеснок" найдёт замены для "чеснок"
  getSubstitutions: protectedProcedure
    .input(z.object({ ingredientName: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      // Чистим имя: убираем количество и единицы, оставляем только название
      const cleanName = input.ingredientName
        .replace(/\d+([.,]\d+)?\s*\S*/g, '') // числа с единицами: "200г", "1 ст.л."
        .replace(/[%(){}[\]]/g, '') // спецсимволы
        .trim()
        .toLowerCase();

      if (cleanName.length < 2) return [];

      // Двунаправленный поиск через ILIKE:
      // 1. ingredient_name содержит cleanName ("Сметана" в БД, "Сметана 20%" на входе)
      // 2. cleanName содержит ingredient_name ("свежий чеснок" на входе, "чеснок" в БД)
      const rows = await db
        .select()
        .from(ingredientSubstitutions)
        .where(
          or(
            ilike(ingredientSubstitutions.ingredientName, `%${cleanName}%`),
            sql`LOWER(${ingredientSubstitutions.ingredientName}) = ANY(string_to_array(${cleanName}, ' '))`,
          ),
        )
        .limit(10);
      return rows;
    }),

  // G.4 — рассчитать и сохранить КБЖУ рецепта автоматически.
  // Делегирует в nutritionCalc.calcRecipeNutrition — единственную реализацию.
  // Если matched === 0 (ингредиенты не нашлись в USDA) — рецепт НЕ обновляется,
  // существующие значения КБЖУ не затираются нулями.
  calcNutrition: protectedProcedure
    .input(z.object({ recipeId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await calcRecipeNutrition(input.recipeId);
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Рецепт не найден' });
      }
      return result;
    }),
});
