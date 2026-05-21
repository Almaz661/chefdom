import { z } from "zod";
import { router, publicProcedure } from "../trpc";
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

export const settingsRouter = router({

  // Экспорт всех данных в JSON (раздел 15.1 плана)
  exportBackup: publicProcedure.query(async () => {
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
  importBackup: publicProcedure
    .input(
      z.object({
        version: z.number(),
        exported_at: z.string(),
        recipes: z.array(z.any()),
        inventory: z.array(z.any()),
        purchase_items: z.array(z.any()),
        menus: z.array(z.any()),
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
  getStats: publicProcedure.query(async () => {
    const allRecipes = await db.select({ id: recipes.id }).from(recipes);
    return {
      recipesCount: allRecipes.length,
      version: "1.0",
    };
  }),
});
