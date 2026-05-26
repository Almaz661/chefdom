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
  cookingHistory,
  receipts,
  receiptItems,
  preserves,
  products,
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
      allCookingHistory,
      allReceipts,
      allReceiptItems,
      allPreserves,
      allProducts,
    ] = await Promise.all([
      db.select().from(recipes),
      db.select().from(recipeIngredients),
      db.select().from(recipeSteps),
      db.select().from(menus),
      db.select().from(menuItems),
      db.select().from(inventory),
      db.select().from(purchaseItems),
      db.select().from(cookingHistory),
      db.select().from(receipts),
      db.select().from(receiptItems),
      db.select().from(preserves),
      db.select().from(products),
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

    const receiptsWithItems = allReceipts.map((receipt) => ({
      ...receipt,
      items: allReceiptItems.filter((i) => i.receiptId === receipt.id),
    }));

    return {
      exported_at: new Date().toISOString(),
      version: 2,
      recipes: recipesWithDetails,
      inventory: allInventory,
      purchase_items: allPurchases,
      menus: menusWithItems,
      cooking_history: allCookingHistory,
      receipts: receiptsWithItems,
      preserves: allPreserves,
      products: allProducts,
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
        // Version 2 fields (optional for backward compat with v1 backups)
        cooking_history: z.array(z.object({
          recipeTitle: z.string().optional(),
          recipe_title: z.string().optional(),
          servings: z.number().optional(),
          caloriesPerServing: z.number().nullable().optional(),
          calories_per_serving: z.number().nullable().optional(),
          category: z.string().nullable().optional(),
          cuisine: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
          rating: z.number().nullable().optional(),
          cookedAt: z.string().nullable().optional(),
          cooked_at: z.string().nullable().optional(),
        }).passthrough()).optional().default([]),
        receipts: z.array(z.object({
          storeName: z.string().nullable().optional(),
          store_name: z.string().nullable().optional(),
          purchaseDate: z.string().nullable().optional(),
          purchase_date: z.string().nullable().optional(),
          totalAmount: z.union([z.string(), z.number()]).nullable().optional(),
          total_amount: z.union([z.string(), z.number()]).nullable().optional(),
          currency: z.string().optional(),
          status: z.string().optional(),
          notes: z.string().nullable().optional(),
          ocrRaw: z.string().nullable().optional(),
          ocr_raw: z.string().nullable().optional(),
          items: z.array(z.object({
            productName: z.string().optional(),
            product_name: z.string().optional(),
            quantity: z.union([z.string(), z.number()]).nullable().optional(),
            unit: z.string().nullable().optional(),
            price: z.union([z.string(), z.number()]).nullable().optional(),
          }).passthrough()).optional().default([]),
        }).passthrough()).optional().default([]),
        preserves: z.array(z.object({
          preserveType: z.string().optional(),
          preserve_type: z.string().optional(),
          name: z.string(),
          quantity: z.union([z.string(), z.number()]).nullable().optional(),
          unit: z.string().nullable().optional(),
          servings: z.number().nullable().optional(),
          preparedAt: z.string().nullable().optional(),
          prepared_at: z.string().nullable().optional(),
          expiryDate: z.string().nullable().optional(),
          expiry_date: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        }).passthrough()).optional().default([]),
        products: z.array(z.object({
          nameRu: z.string().optional(),
          name_ru: z.string().optional(),
          lastPrice: z.union([z.string(), z.number()]).nullable().optional(),
          last_price: z.union([z.string(), z.number()]).nullable().optional(),
          storeName: z.string().nullable().optional(),
          store_name: z.string().nullable().optional(),
          purchaseDate: z.string().nullable().optional(),
          purchase_date: z.string().nullable().optional(),
        }).passthrough()).optional().default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.transaction(async (tx) => {
        const userId = ctx.userId;

        // Удаляем данные ТОЛЬКО текущего пользователя (порядок важен из-за FK).
        // receiptItems и menuItems удаляются каскадно через FK ON DELETE CASCADE,
        // но recipeIngredients/recipeSteps — нет (рецепты общие для всех),
        // поэтому удаляем их явно.
        // Чеки — только текущего пользователя
        const userReceipts = await tx.select({ id: receipts.id }).from(receipts).where(eq(receipts.userId, userId));
        if (userReceipts.length > 0) {
          const receiptIds = userReceipts.map(r => r.id);
          for (const rid of receiptIds) {
            await tx.delete(receiptItems).where(eq(receiptItems.receiptId, rid));
          }
          await tx.delete(receipts).where(eq(receipts.userId, userId));
        }
        await tx.delete(cookingHistory).where(eq(cookingHistory.userId, userId));
        await tx.delete(preserves).where(eq(preserves.userId, userId));
        await tx.delete(purchaseItems).where(eq(purchaseItems.userId, userId));
        // Меню — удаляем items каскадно
        const userMenus = await tx.select({ id: menus.id }).from(menus).where(eq(menus.userId, userId));
        if (userMenus.length > 0) {
          for (const m of userMenus) {
            await tx.delete(menuItems).where(eq(menuItems.menuId, m.id));
          }
          await tx.delete(menus).where(eq(menus.userId, userId));
        }
        await tx.delete(inventory).where(eq(inventory.userId, userId));
        // Рецепты и products — общие (не привязаны к userId), удаляем все
        await tx.delete(recipeIngredients);
        await tx.delete(recipeSteps);
        await tx.delete(recipes);
        await tx.delete(products);

        // --- Рецепты ---
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

        // --- Инвентарь ---
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

        // --- Список покупок ---
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

        // --- История готовки (v2) ---
        if (input.cooking_history.length > 0) {
          await tx.insert(cookingHistory).values(
            input.cooking_history.map((item: any) => ({
              userId,
              recipeTitle: item.recipeTitle ?? item.recipe_title ?? "Без названия",
              servings: item.servings ?? 1,
              caloriesPerServing: item.caloriesPerServing ?? item.calories_per_serving ?? null,
              category: item.category ?? null,
              cuisine: item.cuisine ?? null,
              notes: item.notes ?? null,
              rating: item.rating ?? null,
              cookedAt: item.cookedAt ?? item.cooked_at ?? new Date(),
            }))
          );
        }

        // --- Чеки (v2) ---
        for (const r of input.receipts) {
          const { items, id: _oldId, ...receiptData } = r as any;

          const [insertedReceipt] = await tx
            .insert(receipts)
            .values({
              userId,
              storeName: receiptData.storeName ?? receiptData.store_name ?? null,
              purchaseDate: receiptData.purchaseDate ?? receiptData.purchase_date ?? null,
              totalAmount: receiptData.totalAmount ?? receiptData.total_amount
                ? String(receiptData.totalAmount ?? receiptData.total_amount)
                : null,
              currency: receiptData.currency ?? "EUR",
              status: receiptData.status ?? "final",
              notes: receiptData.notes ?? null,
              ocrRaw: receiptData.ocrRaw ?? receiptData.ocr_raw ?? null,
            })
            .returning({ id: receipts.id });

          if (items?.length > 0) {
            await tx.insert(receiptItems).values(
              items.map((item: any, idx: number) => ({
                receiptId: insertedReceipt.id,
                productName: item.productName ?? item.product_name ?? "?",
                quantity: item.quantity != null ? String(item.quantity) : null,
                unit: item.unit ?? null,
                price: item.price != null ? String(item.price) : null,
                sortOrder: idx,
              }))
            );
          }
        }

        // --- Заготовки (v2) ---
        if (input.preserves.length > 0) {
          await tx.insert(preserves).values(
            input.preserves.map((item: any) => ({
              userId,
              preserveType: item.preserveType ?? item.preserve_type ?? "frozen",
              name: item.name,
              quantity: item.quantity != null ? String(item.quantity) : null,
              unit: item.unit ?? null,
              servings: item.servings ?? null,
              preparedAt: item.preparedAt ?? item.prepared_at ?? null,
              expiryDate: item.expiryDate ?? item.expiry_date ?? null,
              notes: item.notes ?? null,
            }))
          );
        }

        // --- Продукты (v2) ---
        if (input.products.length > 0) {
          for (const item of input.products as any[]) {
            const nameRu = item.nameRu ?? item.name_ru;
            if (!nameRu) continue;
            await tx
              .insert(products)
              .values({
                nameRu,
                lastPrice: item.lastPrice ?? item.last_price
                  ? String(item.lastPrice ?? item.last_price)
                  : null,
                storeName: item.storeName ?? item.store_name ?? null,
                purchaseDate: item.purchaseDate ?? item.purchase_date ?? null,
                priceUpdatedAt: item.lastPrice || item.last_price ? new Date() : null,
              })
              .onConflictDoNothing()
              .catch(() => {});
          }
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
