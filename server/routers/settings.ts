import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "../db/index";
import {
  recipes,
  recipeIngredients,
  recipeSteps,
  menus,
  menuItems,
  inventory,
  purchaseItems,
  users,
} from "../db/schema";

const currencySchema = z.enum(["EUR", "RUB"]);
export type AppCurrency = z.infer<typeof currencySchema>;

export const settingsRouter = router({

  // Текущая валюта по умолчанию (для отображения в Настройках и
  // подстановки в форме создания чека).
  // Берём первого пользователя — мульти-юзер пока не поддерживается.
  getCurrency: protectedProcedure.query(async () => {
    const [user] = await db
      .select({ defaultCurrency: users.defaultCurrency })
      .from(users)
      .limit(1);
    const value = user?.defaultCurrency === "RUB" ? "RUB" : "EUR";
    return { currency: value as AppCurrency };
  }),

  // Сохранить валюту. Влияет на:
  //  - значение по умолчанию в форме «Новый чек вручную»;
  //  - fallback в парсере OCR, если магазин не распознан.
  setCurrency: protectedProcedure
    .input(z.object({ currency: currencySchema }))
    .mutation(async ({ input }) => {
      const [user] = await db.select({ id: users.id }).from(users).limit(1);
      if (!user) throw new Error("Пользователь не найден");
      await db
        .update(users)
        .set({ defaultCurrency: input.currency })
        .where(eq(users.id, user.id));
      return { currency: input.currency };
    }),

  // Экспорт всех данных в JSON (раздел 15.1 плана)
  exportBackup: protectedProcedure.query(async () => {
    const [
      allRecipes,
      allIngredients,
      allSteps,
      allMenus,
      allMenuItems,
      allInventory,
      allPurchases,
    ] = await Promise.all([
      db.select().from(recipes),
      db.select().from(recipeIngredients),
      db.select().from(recipeSteps),
      db.select().from(menus),
      db.select().from(menuItems),
      db.select().from(inventory),
      db.select().from(purchaseItems),
    ]);

    const recipesWithDetails = allRecipes.map((recipe) => ({
      ...recipe,
      ingredients: allIngredients.filter((i) => i.recipeId === recipe.id),
      steps: allSteps.filter((s) => s.recipeId === recipe.id),
    }));

    const menusWithItems = allMenus.map((menu) => ({
      ...menu,
      items: allMenuItems.filter((i) => i.menuId === menu.id),
    }));

    return {
      exported_at: new Date().toISOString(),
      version: 1,
      recipes: recipesWithDetails,
      inventory: allInventory,
      purchase_items: allPurchases,
      menus: menusWithItems,
    };
  }),

  // Восстановление из backup (раздел 15.2 плана)
  importBackup: protectedProcedure
    .input(
      z.object({
        version: z.number(),
        exported_at: z.string(),
        recipes: z.array(z.object({
          title: z.string(),
          description: z.string().nullable().optional(),
          imageUrl: z.string().nullable().optional(),
          image_url: z.string().nullable().optional(),
          servings: z.number().optional(),
          prepTime: z.number().nullable().optional(),
          prep_time: z.number().nullable().optional(),
          cookTime: z.number().nullable().optional(),
          cook_time: z.number().nullable().optional(),
          totalTime: z.number().nullable().optional(),
          total_time: z.number().nullable().optional(),
          sourceUrl: z.string().nullable().optional(),
          source_url: z.string().nullable().optional(),
          source: z.string().nullable().optional(),
          category: z.string().nullable().optional(),
          cuisine: z.string().nullable().optional(),
          difficulty: z.string().nullable().optional(),
          calories: z.number().nullable().optional(),
          ingredients: z.array(z.object({
            name: z.string(),
            amount: z.union([z.string(), z.number()]).nullable().optional(),
            unit: z.string().nullable().optional(),
            groupName: z.string().nullable().optional(),
            group_name: z.string().nullable().optional(),
            sortOrder: z.number().optional(),
            sort_order: z.number().optional(),
          })).optional().default([]),
          steps: z.array(z.object({
            instruction: z.string(),
            stepNumber: z.number().optional(),
            step_number: z.number().optional(),
            imageUrl: z.string().nullable().optional(),
            image_url: z.string().nullable().optional(),
            timerMinutes: z.number().nullable().optional(),
            timer_minutes: z.number().nullable().optional(),
          })).optional().default([]),
        }).passthrough()),
        inventory: z.array(z.object({
          productName: z.string().optional(),
          product_name: z.string().optional(),
          quantity: z.union([z.string(), z.number()]).nullable().optional(),
          unit: z.string().nullable().optional(),
          storageType: z.string().optional(),
          storage_type: z.string().optional(),
          expiryDate: z.string().nullable().optional(),
          expiry_date: z.string().nullable().optional(),
          minQuantity: z.string().nullable().optional(),
          min_quantity: z.string().nullable().optional(),
          category: z.string().nullable().optional(),
        }).passthrough()),
        purchase_items: z.array(z.object({
          productName: z.string().optional(),
          product_name: z.string().optional(),
          quantity: z.union([z.string(), z.number()]).nullable().optional(),
          unit: z.string().nullable().optional(),
          category: z.string().nullable().optional(),
          isChecked: z.number().optional(),
          is_checked: z.number().optional(),
          recipeSource: z.string().nullable().optional(),
          recipe_source: z.string().nullable().optional(),
        }).passthrough()),
        menus: z.array(z.object({}).passthrough()),
      })
    )
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        const [user] = await tx.select({ id: users.id }).from(users).limit(1);
        if (!user) throw new Error("Пользователь не найден");
        const userId = user.id;

        await tx.delete(purchaseItems);
        await tx.delete(menuItems);
        await tx.delete(menus);
        await tx.delete(inventory);
        await tx.delete(recipeIngredients);
        await tx.delete(recipeSteps);
        await tx.delete(recipes);

        for (const r of input.recipes) {
          const { ingredients, steps, id: _oldId, ...recipeData } = r;

          const [inserted] = await tx
            .insert(recipes)
            .values({
              title: recipeData.title,
              description: recipeData.description ?? null,
              imageUrl: recipeData.imageUrl ?? recipeData.image_url ?? null,
              servings: recipeData.servings ?? 4,
              prepTime: recipeData.prepTime ?? recipeData.prep_time ?? null,
              cookTime: recipeData.cookTime ?? recipeData.cook_time ?? null,
              totalTime: recipeData.totalTime ?? recipeData.total_time ?? null,
              sourceUrl: recipeData.sourceUrl ?? recipeData.source_url ?? null,
              source: recipeData.source ?? null,
              category: recipeData.category ?? null,
              cuisine: recipeData.cuisine ?? null,
              difficulty: recipeData.difficulty ?? null,
              calories: recipeData.calories ?? null,
            })
            .returning({ id: recipes.id });

          if (ingredients?.length > 0) {
            await tx.insert(recipeIngredients).values(
              ingredients.map((ing: any, idx: number) => ({
                recipeId: inserted.id,
                name: ing.name,
                amount: ing.amount != null ? String(ing.amount) : null,
                unit: ing.unit ?? null,
                groupName: ing.groupName ?? ing.group_name ?? null,
                sortOrder: ing.sortOrder ?? ing.sort_order ?? idx,
              }))
            );
          }

          if (steps?.length > 0) {
            await tx.insert(recipeSteps).values(
              steps.map((s: any, idx: number) => ({
                recipeId: inserted.id,
                stepNumber: s.stepNumber ?? s.step_number ?? idx + 1,
                instruction: s.instruction,
                imageUrl: s.imageUrl ?? s.image_url ?? null,
                timerMinutes: s.timerMinutes ?? s.timer_minutes ?? null,
              }))
            );
          }
        }

        if (input.inventory.length > 0) {
          await tx.insert(inventory).values(
            input.inventory.map((item: any) => ({
              userId,
              productName: item.productName ?? item.product_name,
              quantity: item.quantity != null ? String(item.quantity) : null,
              unit: item.unit ?? null,
              storageType: item.storageType ?? item.storage_type ?? "fridge",
              expiryDate: item.expiryDate ?? item.expiry_date ?? null,
              minQuantity: item.minQuantity ?? item.min_quantity ?? null,
              category: item.category ?? null,
            }))
          );
        }

        if (input.purchase_items.length > 0) {
          await tx.insert(purchaseItems).values(
            input.purchase_items.map((item: any) => ({
              userId,
              productName: item.productName ?? item.product_name,
              quantity: item.quantity != null ? String(item.quantity) : null,
              unit: item.unit ?? null,
              category: item.category ?? null,
              isChecked: item.isChecked ?? item.is_checked ?? 0,
              recipeSource: item.recipeSource ?? item.recipe_source ?? null,
            }))
          );
        }
      });

      return { ok: true };
    }),

  // Статистика для страницы «О приложении»
  getStats: protectedProcedure.query(async () => {
    const allRecipes = await db.select({ id: recipes.id }).from(recipes);
    return {
      recipesCount: allRecipes.length,
      version: "1.0",
    };
  }),
});
