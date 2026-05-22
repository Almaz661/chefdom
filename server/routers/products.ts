import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, ilike, sql } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../db/index';
import { products, ingredients, recipes, recipeIngredients, ingredientSubstitutions } from '../db/schema';


export const productsRouter = router({

  // G.3 — поиск товара по штрих-коду.
  // Сначала ищем в локальной БД. Если нет — запрашиваем Open Food Facts API
  // в реальном времени. Если OFF знает этот штрих-код — сохраняем в локальную
  // БД (чтобы повторно не спрашивать) и возвращаем пользователю.
  getByBarcode: publicProcedure
    .input(z.object({ barcode: z.string().min(1) }))
    .query(async ({ input }) => {
      // 1. Локальная БД
      const [local] = await db
        .select()
        .from(products)
        .where(eq(products.barcode, input.barcode))
        .limit(1);
      if (local) return local;

      // 2. Open Food Facts API (бесплатно, без ключа)
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(input.barcode)}.json`,
          { headers: { 'User-Agent': 'ShefDom/1.0 (home kitchen app)' } },
        );
        if (res.ok) {
          const data = await res.json() as {
            status: number;
            product?: {
              product_name?: string;
              product_name_ru?: string;
              product_name_nl?: string;
              brands?: string;
              quantity?: string;
              image_url?: string;
            };
          };
          if (data.status === 1 && data.product) {
            const p = data.product;
            const nameRu = p.product_name_ru || p.product_name || 'Без названия';
            const nameNl = p.product_name_nl || null;
            const brand = p.brands || null;
            // Парсим количество: "250 g" → 250 / g
            let packageQuantity: string | null = null;
            let packageUnit: string | null = null;
            if (p.quantity) {
              const m = p.quantity.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Zа-яА-Я]+)/);
              if (m) {
                packageQuantity = m[1].replace(',', '.');
                packageUnit = m[2].toLowerCase();
              }
            }
            // Сохраняем в локальную БД
            const [saved] = await db
              .insert(products)
              .values({
                barcode: input.barcode,
                nameRu,
                nameNl,
                brand,
                packageQuantity,
                packageUnit,
                imageUrl: p.image_url || null,
                offId: input.barcode,
              })
              .onConflictDoUpdate({
                target: products.barcode,
                set: { nameRu, nameNl, brand, packageQuantity, packageUnit, imageUrl: p.image_url || null },
              })
              .returning();
            return saved;
          }
        }
      } catch {
        // OFF недоступен — не блокируем, просто не нашли
      }

      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Товар не найден по штрих-коду',
      });
    }),

  // G.3 — поиск товара по названию
  search: publicProcedure
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
  searchIngredient: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(ingredients)
        .where(ilike(ingredients.nameRu, `%${input.query}%`))
        .limit(20);
      return rows;
    }),

  // B.3 — получить замены для ингредиента
  getSubstitutions: publicProcedure
    .input(z.object({ ingredientName: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(ingredientSubstitutions)
        .where(ilike(ingredientSubstitutions.ingredientName, input.ingredientName))
        .limit(10);
      return rows;
    }),

  // G.4 — рассчитать и сохранить КБЖУ рецепта автоматически
  // Берёт ингредиенты рецепта, ищет их в справочнике USDA, считает сумму на порцию
  calcNutrition: publicProcedure
    .input(z.object({ recipeId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      // Получить рецепт и его ингредиенты
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.recipeId))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Рецепт не найден' });
      }

      const ings = await db
        .select()
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, input.recipeId));

      let totalKcal = 0;
      let totalProtein = 0;
      let totalFats = 0;
      let totalCarbs = 0;
      let matchedCount = 0;

      for (const ing of ings) {
        // Ищем ингредиент в USDA по названию
        const [found] = await db
          .select()
          .from(ingredients)
          .where(ilike(ingredients.nameRu, `%${ing.name}%`))
          .limit(1);

        if (!found) continue;

        // Количество в граммах (если нет — считаем 100г)
        const amountG = ing.amount ? parseFloat(ing.amount) : 100;

        const factor = amountG / 100;
        totalKcal += found.kcalPer100g ? parseFloat(found.kcalPer100g) * factor : 0;
        totalProtein += found.proteinG ? parseFloat(found.proteinG) * factor : 0;
        totalFats += found.fatsG ? parseFloat(found.fatsG) * factor : 0;
        totalCarbs += found.carbsG ? parseFloat(found.carbsG) * factor : 0;
        matchedCount++;
      }

      // На порцию
      const servings = recipe.servings || 1;
      const kcalPerServing = Math.round(totalKcal / servings);
      const proteinPerServing = Math.round((totalProtein / servings) * 10) / 10;
      const fatsPerServing = Math.round((totalFats / servings) * 10) / 10;
      const carbsPerServing = Math.round((totalCarbs / servings) * 10) / 10;

      // Сохраняем в рецепт
      await db
        .execute(
          sql`UPDATE recipes SET 
            calories = ${kcalPerServing},
            protein_g = ${proteinPerServing},
            fats_g = ${fatsPerServing},
            carbs_g = ${carbsPerServing}
          WHERE id = ${input.recipeId}`
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
    }),
});
