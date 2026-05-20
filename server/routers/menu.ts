import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, inArray } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../db/index';
import { menus, menuItems, recipes, recipeIngredients, purchaseItems } from '../db/schema';

const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;

export const menuRouter = router({
  // Получить меню недели. Если нет — создать пустое.
  getWeek: publicProcedure
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
  addItem: publicProcedure
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
  removeItem: publicProcedure
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

  // Собрать ингредиенты из меню недели → добавить в список покупок (без дублей)
  toShopping: publicProcedure
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

      const recipeIds = [...new Set(items.map((i) => i.recipeId))];

      // Получить ингредиенты всех рецептов
      const ingredients = await db
        .select()
        .from(recipeIngredients)
        .where(inArray(recipeIngredients.recipeId, recipeIds));

      // Получить текущий список покупок для дедупликации
      const existing = await db
        .select({ productName: purchaseItems.productName })
        .from(purchaseItems)
        .where(eq(purchaseItems.userId, 1));

      const existingNames = new Set(
        existing.map((e) => e.productName.toLowerCase().trim()),
      );

      // Добавить ингредиенты которых ещё нет в списке
      let added = 0;
      for (const ing of ingredients) {
        const nameLower = ing.name.toLowerCase().trim();
        if (existingNames.has(nameLower)) continue;

        await db.insert(purchaseItems).values({
          userId: 1,
          productName: ing.name,
          quantity: ing.amount,
          unit: ing.unit,
          category: ing.groupName,
        });

        existingNames.add(nameLower);
        added++;
      }

      return { added };
    }),
});
