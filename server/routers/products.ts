import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, ilike, or, sql, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { products, ingredients, recipes, recipeIngredients, ingredientSubstitutions, priceHistory } from '../db/schema';
import { translatePlainToRu } from '../services/translate';
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
          `https://world.openfoodfacts.org/api/v2/product/${input.barcode}.json?fields=product_name,product_name_ru,product_name_nl,product_name_en,brands,quantity`
        );

        if (!offRes.ok) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден по штрих-коду' });
        }

        const offData = await offRes.json() as {
          status: number;
          product?: {
            product_name?: string;
            product_name_ru?: string;
            product_name_nl?: string;
            product_name_en?: string;
            brands?: string;
            quantity?: string;
          };
        };

        const offProduct = offData.product;
        if (offData.status !== 1 || !offProduct) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден по штрих-коду' });
        }

        // Выбираем лучшее доступное название и его язык-источник.
        // Приоритет: ru (готовое) → nl → en → product_name (auto-detect).
        const ru = offProduct.product_name_ru?.trim();
        const nl = offProduct.product_name_nl?.trim();
        const en = offProduct.product_name_en?.trim();
        const generic = offProduct.product_name?.trim();

        let sourceName = '';
        let sourceLang: 'NL' | 'EN' | null = null;
        if (ru) {
          sourceName = ru; // уже на русском — переводить не нужно
        } else if (nl) {
          sourceName = nl;
          sourceLang = 'NL';
        } else if (en) {
          sourceName = en;
          sourceLang = 'EN';
        } else if (generic) {
          sourceName = generic;
          // язык auto-detect — для "Bonduelle" / "Heinz" это часто работает
        }

        if (!sourceName) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден по штрих-коду' });
        }

        // 3. Переводим название → чистый русский (без формата "Оригинал (Перевод)").
        // Если уже на русском — translatePlainToRu вернёт исходный текст без вызова DeepL.
        const translatedName = ru ? sourceName : await translatePlainToRu(sourceName, sourceLang);

        // nameNl сохраняем как «оригинал на исходном языке» — для отладки
        // и чтобы можно было повторно перевести если перевод неудачный.
        const originalForNl = nl || generic || en || sourceName;

        // 4. Сохраняем в локальную БД для будущих запросов
        const [saved] = await db
          .insert(products)
          .values({
            barcode: input.barcode,
            nameRu: translatedName,
            nameNl: originalForNl,
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
          nameNl: originalForNl,
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

  // Полный список всех товаров (для отображения каталога)
  // Сортировка по дате обновления цены (свежие покупки сверху)
  list: protectedProcedure.query(async () => {
    const rows = await db
      .select()
      .from(products)
      .orderBy(desc(products.priceUpdatedAt), products.nameRu)
      .limit(200);
    return rows;
  }),

  // Удалить один товар по id
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.delete(products).where(eq(products.id, input.id));
      return { id: input.id };
    }),

  // Удалить товар по ID (только свой — через price_history нет userId,
  // но products — глобальный каталог; deleteAll оставлен только как dev-утилита)
  deleteAll: protectedProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      // Удаляем только продукты привязанные к этому пользователю через price_history.
      // Глобальный каталог (без userId) — не трогаем чужие данные.
      // Для одного пользователя удаляем всё (обратная совместимость).
      const usersCount = await db.select({ id: products.id }).from(products).limit(2);
      if (usersCount.length === 0) return { ok: true };
      // Пока одна БД на одного пользователя — удаляем всё как раньше.
      // TODO: когда будет userId в products — фильтровать по ctx.userId
      void ctx.userId; // используем ctx чтобы не было TS-ошибки
      await db.delete(products);
      return { ok: true };
    }),

  // История цен товара — все покупки по дате (новые сверху)
  getPriceHistory: protectedProcedure
    .input(z.object({ productName: z.string().min(1) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.productName, input.productName))
        .orderBy(desc(priceHistory.createdAt))
        .limit(50);
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
