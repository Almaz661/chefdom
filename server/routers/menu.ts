import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, inArray } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { menus, menuItems, recipes, recipeIngredients, purchaseItems } from '../db/schema';

const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;

export const menuRouter = router({
  // Получить меню недели. Если нет — создать пустое.
  getWeek: protectedProcedure
    .input(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      // Найти или создать меню на эту неделю (userId=1 — одна семья)
      let [menu] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.userId, 1), eq(menus.weekStartDate, input.weekStart)))
        .limit(1);

      if (!menu) {
        [menu] = await db
          .insert(menus)
          .values({ userId: 1, weekStartDate: input.weekStart })
          .returning();
      }

      // Получить все items с данными рецепта
      const items = await db
        .select({
          id: menuItems.id,
          dayOfWeek: menuItems.dayOfWeek,
          mealType: menuItems.mealType,
          recipeId: menuItems.recipeId,
          recipeTitle: recipes.title,
          recipeImage: recipes.imageUrl,
          recipeTotalTime: recipes.totalTime,
        })
        .from(menuItems)
        .innerJoin(recipes, eq(menuItems.recipeId, recipes.id))
        .where(eq(menuItems.menuId, menu.id));

      return { menuId: menu.id, weekStart: menu.weekStartDate, items };
    }),

  // Добавить рецепт в слот
  addItem: protectedProcedure
    .input(
      z.object({
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dayOfWeek: z.number().int().min(0).max(6),
        mealType: z.enum(mealTypes),
        recipeId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      // Найти или создать меню
      let [menu] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.userId, 1), eq(menus.weekStartDate, input.weekStart)))
        .limit(1);

      if (!menu) {
        [menu] = await db
          .insert(menus)
          .values({ userId: 1, weekStartDate: input.weekStart })
          .returning();
      }

      // Проверить что рецепт существует
      const [recipe] = await db
        .select({ id: recipes.id })
        .from(recipes)
        .where(eq(recipes.id, input.recipeId))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Рецепт не найден' });
      }

      const [created] = await db
        .insert(menuItems)
        .values({
          menuId: menu.id,
          dayOfWeek: input.dayOfWeek,
          mealType: input.mealType,
          recipeId: input.recipeId,
        })
        .returning({ id: menuItems.id });

      return { id: created.id };
    }),

  // Удалить из слота
  removeItem: protectedProcedure
    .input(z.object({ itemId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await db
        .delete(menuItems)
        .where(eq(menuItems.id, input.itemId))
        .returning({ id: menuItems.id });

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Элемент меню не найден' });
      }

      return { id: input.itemId };
    }),

  // Блюдо дня: рецепт из меню на сегодня по времени суток
  getTodayMeal: protectedProcedure.query(async () => {
    // Определяем день недели (0=Пн...6=Вс)
    const todayIdx = (new Date().getDay() + 6) % 7;
    // Определяем приём пищи по времени
    const hour = new Date().getHours();
    let mealType: string;
    if (hour >= 5 && hour < 11) mealType = 'breakfast';
    else if (hour >= 11 && hour < 17) mealType = 'lunch';
    else mealType = 'dinner';

    // weekStartDate = понедельник текущей недели в формате YYYY-MM-DD
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - todayIdx);
    const weekStartDate = monday.toISOString().slice(0, 10);

    // Ищем меню на эту неделю
    const [menu] = await db
      .select()
      .from(menus)
      .where(and(eq(menus.userId, 1), eq(menus.weekStartDate, weekStartDate)))
      .limit(1);
    if (!menu) return null;

    // Ищем слот на сегодня + текущий приём пищи
    const [item] = await db
      .select()
      .from(menuItems)
      .where(
        and(
          eq(menuItems.menuId, menu.id),
          eq(menuItems.dayOfWeek, todayIdx),
          eq(menuItems.mealType, mealType),
        ),
      )
      .limit(1);
    if (!item) return null;

    // Получаем рецепт
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, item.recipeId))
      .limit(1);
    if (!recipe) return null;

    return { recipe, mealType };
  }),

  // Собрать ингредиенты из меню недели → добавить в список покупок (без дублей)
  toShopping: protectedProcedure
    .input(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      // Найти меню
      const [menu] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.userId, 1), eq(menus.weekStartDate, input.weekStart)))
        .limit(1);

      if (!menu) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Меню на эту неделю не найдено' });
      }

      // Получить все recipeId из меню
      const items = await db
        .select({ recipeId: menuItems.recipeId })
        .from(menuItems)
        .where(eq(menuItems.menuId, menu.id));

      if (items.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Меню пустое — нечего добавлять в покупки' });
      }

      // Подсчитать сколько раз каждый рецепт в меню
      const recipeCount = new Map<number, number>();
      for (const item of items) {
        recipeCount.set(item.recipeId, (recipeCount.get(item.recipeId) || 0) + 1);
      }

      const recipeIds = [...recipeCount.keys()];

      // Получить ингредиенты всех рецептов
      const ingredients = await db
        .select()
        .from(recipeIngredients)
        .where(inArray(recipeIngredients.recipeId, recipeIds));

      // Нормализация названия — убираем окончания чтобы «яйцо» и «яйца» были одним продуктом
      function normalizeName(name: string): string {
        return name
          .toLowerCase()
          .trim()
          .replace(/[аяеёиоуыэюь]+$/, "") // убираем гласные окончания
          .trim();
      }

      // Агрегировать: суммировать количества по нормализованному названию + единица
      const aggregated = new Map<string, { name: string; amount: number | null; unit: string | null; category: string | null }>();
      for (const ing of ingredients) {
        const nameNorm = normalizeName(ing.name);
        const unitLower = (ing.unit || "").toLowerCase().trim();
        const key = `${nameNorm}|${unitLower}`;
        const multiplier = recipeCount.get(ing.recipeId) || 1;
        const ingAmount = ing.amount ? parseFloat(ing.amount) : null;
        const scaledAmount = ingAmount !== null ? ingAmount * multiplier : null;

        if (aggregated.has(key)) {
          const prev = aggregated.get(key)!;
          if (prev.amount !== null && scaledAmount !== null) {
            prev.amount += scaledAmount;
          }
        } else {
          aggregated.set(key, {
            name: ing.name,
            amount: scaledAmount,
            unit: ing.unit,
            category: ing.groupName,
          });
        }
      }

      // Получить текущий список покупок для дедупликации
      const existing = await db
        .select({ productName: purchaseItems.productName, unit: purchaseItems.unit })
        .from(purchaseItems)
        .where(eq(purchaseItems.userId, 1));

      const existingKeys = new Set(
        existing.map((e) => `${normalizeName(e.productName)}|${(e.unit || "").toLowerCase().trim()}`),
      );

      // Добавить агрегированные ингредиенты которых ещё нет в списке —
      // в одной транзакции. Без неё при сбое посередине часть ингредиентов
      // попадёт в список покупок, а часть — нет.
      let added = 0;
      await db.transaction(async (tx) => {
        for (const [key, agg] of aggregated) {
          if (existingKeys.has(key)) continue;

          await tx.insert(purchaseItems).values({
            userId: 1,
            productName: agg.name,
            quantity: agg.amount !== null ? String(agg.amount) : null,
            unit: agg.unit,
            category: agg.category,
          });

          existingKeys.add(key);
          added++;
        }
      });

      return { added };
    }),
});
