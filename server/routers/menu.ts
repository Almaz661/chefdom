import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, inArray, desc, sql as rawSql, lte, isNotNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { menus, menuItems, recipes, recipeIngredients, purchaseItems, inventory, cookingHistory, preserves } from '../db/schema';

const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;

export const menuRouter = router({
  // Получить меню недели. Если нет — создать пустое.
  getWeek: protectedProcedure
    .input(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input, ctx }) => {
      // Найти или создать меню на эту неделю
      let [menu] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.userId, ctx.userId), eq(menus.weekStartDate, input.weekStart)))
        .limit(1);

      if (!menu) {
        [menu] = await db
          .insert(menus)
          .values({ userId: ctx.userId, weekStartDate: input.weekStart })
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
    .mutation(async ({ input, ctx }) => {
      // Найти или создать меню
      let [menu] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.userId, ctx.userId), eq(menus.weekStartDate, input.weekStart)))
        .limit(1);

      if (!menu) {
        [menu] = await db
          .insert(menus)
          .values({ userId: ctx.userId, weekStartDate: input.weekStart })
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
  getTodayMeal: protectedProcedure.query(async ({ ctx }) => {
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
      .where(and(eq(menus.userId, ctx.userId), eq(menus.weekStartDate, weekStartDate)))
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
    .mutation(async ({ input, ctx }) => {
      // Найти меню
      const [menu] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.userId, ctx.userId), eq(menus.weekStartDate, input.weekStart)))
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

      // Нормализация названия для объединения дублей.
      // 1. Отрезаем ВСЁ после первого тире/дефиса:
      //    «Соль – по вкусу» → «соль», «Свекла –» → «свекла»
      // 2. Убираем уточнения в скобках: «Масло (оливковое)» → «масло»
      // 3. Убираем прилагательные-уточнения для специй:
      //    «Перец чёрный молотый» → «перец»
      //    «Соль морская крупная» → «соль»
      // 4. Убираем гласные окончания для базового стемминга.
      //
      // Ключевая идея: для дедупликации в покупках «Перец чёрный молотый»
      // и «Перец» — один и тот же продукт. Уточнения (молотый, морская,
      // крупная, репчатый) не влияют на то, что покупать.

      // Слова-уточнения, которые можно отбросить при сравнении.
      // Это прилагательные и причастия, описывающие форму/сорт,
      // но не меняющие суть продукта в контексте покупок.
      const MODIFIER_WORDS = new Set([
        "чёрный", "черный", "белый", "красный",
        "молотый", "молотая", "молотое", "молотые",
        "морская", "морской", "крупная", "крупный", "мелкая", "мелкий",
        "репчатый", "репчатая",
        "сушёный", "сушеный", "сушёная", "сушеная",
        "свежий", "свежая", "свежее", "свежие",
        "замороженный", "замороженная", "замороженные",
        "консервированный", "консервированная", "консервированные",
        "варёный", "вареный", "варёная", "вареная",
        "жареный", "жареная", "копчёный", "копченый",
        "тёртый", "тертый", "тёртая", "тертая",
        "нарезанный", "нарезанная", "измельчённый", "измельченный",
        "крупнозернистая", "мелкозернистая", "йодированная",
        "душистый", "острый", "сладкий", "горький", "кислый",
        "столовая", "каменная", "экстра", "обычная", "обычный",
        "пшеничная", "пшеничный", "ржаная", "ржаной",
        "куриное", "куриная", "куриный", "свиная", "свиной", "говяжий", "говяжья",
      ]);

      // Извлечь чистое название продукта из строки ингредиента.
      // «Соль – по вкусу» → «Соль»
      // «Перец черный – по вкусу» → «Перец черный»
      // «Помидор – 2 шт. среднего размера» → «Помидор»
      function extractProductName(name: string): string {
        let n = name.trim();
        // Отрезаем всё после любого тире (все Unicode варианты)
        const dashIdx = n.search(/[\u002D\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFF0D]/);
        if (dashIdx > 0) n = n.slice(0, dashIdx).trim();
        // Убираем «по вкусу» если осталось
        n = n.replace(/\s*по вкусу\s*/gi, "").trim();
        // Убираем скобки и их содержимое
        n = n.replace(/\([^)]*\)/g, "").trim();
        return n || name.trim();
      }

      function normalizeName(name: string): string {
        let n = extractProductName(name).toLowerCase();
        // Разбиваем на слова и убираем модификаторы
        const words = n.split(/\s+/).filter(w => !MODIFIER_WORDS.has(w));
        n = words.join(" ");
        // Убираем гласные окончания (базовый стемминг)
        n = n.replace(/[аяеёиоуыэюь]+$/, "").trim();
        return n;
      }

      // Нормализация единицы — «г», «гр», «грамм», «граммов» → «г»
      function normalizeUnit(unit: string | null): string {
        if (!unit) return "";
        const u = unit.toLowerCase().trim().replace(/\.$/, "");
        if (["г", "гр", "грамм", "граммов"].includes(u)) return "г";
        if (["кг", "килограмм", "килограммов"].includes(u)) return "кг";
        if (["мл", "миллилитр", "миллилитров"].includes(u)) return "мл";
        if (["л", "литр", "литров"].includes(u)) return "л";
        if (["шт", "штук", "штука", "штуки"].includes(u)) return "шт";
        if (["ст.л", "ст.л.", "ст. л.", "ст. ложка", "ст. ложки", "ст. ложек", "столовая", "столовых"].includes(u)) return "ст.л.";
        if (["ч.л", "ч.л.", "ч. л.", "ч. ложка", "ч. ложки", "ч. ложек", "чайная", "чайных"].includes(u)) return "ч.л.";
        if (["стакан", "стакана", "стаканов", "стак", "стак."].includes(u)) return "стакан";
        return u;
      }

      // Агрегировать: суммировать количества ТОЛЬКО по нормализованному названию.
      // Если один и тот же продукт в разных рецептах указан в разных единицах
      // (г vs шт) — объединяем в одну строку с единицей первого попавшегося.
      const aggregated = new Map<string, { name: string; amount: number | null; unit: string | null; category: string | null }>();
      for (const ing of ingredients) {
        const nameNorm = normalizeName(ing.name);
        const key = nameNorm;
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

      // Получить текущий список покупок для дедупликации.
      // Также удалим старые дубли, которые могли попасть в список
      // до того, как normalizeName стала учитывать модификаторы.
      const existing = await db
        .select({ id: purchaseItems.id, productName: purchaseItems.productName, unit: purchaseItems.unit })
        .from(purchaseItems)
        .where(eq(purchaseItems.userId, ctx.userId));

      // Группируем по нормализованному ключу, запоминаем ID дублей
      const existingByKey = new Map<string, number[]>();
      for (const e of existing) {
        const k = normalizeName(e.productName);
        if (!existingByKey.has(k)) existingByKey.set(k, []);
        existingByKey.get(k)!.push(e.id);
      }

      // Добавить агрегированные ингредиенты которых ещё нет в списке
      // + удалить старые дубли (оставляем первую запись, остальные убираем).
      // Всё в одной транзакции.
      let added = 0;
      let deduped = 0;
      await db.transaction(async (tx) => {
        // 1. Удалить старые дубли
        for (const [, ids] of existingByKey) {
          if (ids.length <= 1) continue;
          // Оставляем первый, удаляем остальные
          const toDelete = ids.slice(1);
          for (const id of toDelete) {
            await tx.delete(purchaseItems).where(eq(purchaseItems.id, id));
            deduped++;
          }
        }

        // 2. Добавить новые позиции которых ещё нет
        const existingKeys = new Set(existingByKey.keys());
        for (const [key, agg] of aggregated) {
          if (existingKeys.has(key)) continue;

          await tx.insert(purchaseItems).values({
            userId: ctx.userId,
            productName: extractProductName(agg.name),
            quantity: agg.amount !== null ? String(agg.amount) : null,
            unit: agg.unit,
            category: agg.category,
          });

          existingKeys.add(key);
          added++;
        }
      });

      return { added, deduped };
    }),

  // Умные подсказки для выбора рецепта при заполнении меню.
  // Возвращает рекомендованные рецепты с причинами:
  // - Истекающие ингредиенты (используй пока не пропало)
  // - Давно не готовили (разнообразие)
  // - Никогда не готовили (попробуй новое)
  getSuggestions: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(10) }))
    .query(async ({ input, ctx }) => {
      type Suggestion = {
        recipe: {
          id: number;
          title: string;
          imageUrl: string | null;
          totalTime: number | null;
          category: string | null;
        };
        reason: string;
        reasonType: 'expiring' | 'not_cooked_long' | 'never_cooked' | 'available';
        priority: number; // меньше = важнее
        expiringIngredients?: string[];
        daysSinceCooked?: number;
        availablePercent?: number;
      };

      const suggestions: Suggestion[] = [];

      // 1. Получаем истекающие продукты (в ближайшие 4 дня)
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + 4);
      const limitStr = limitDate.toISOString().slice(0, 10);

      const expiringItems = await db
        .select({ productName: inventory.productName, expiryDate: inventory.expiryDate })
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, ctx.userId),
            isNotNull(inventory.expiryDate),
            lte(inventory.expiryDate, limitStr),
          )
        );

      // + заготовки которые скоро истекают
      const expiringPreserves = await db
        .select({ name: preserves.name, expiryDate: preserves.expiryDate })
        .from(preserves)
        .where(
          and(
            eq(preserves.userId, ctx.userId),
            isNotNull(preserves.expiryDate),
            lte(preserves.expiryDate, limitStr),
          )
        );

      const expiringNames = new Set([
        ...expiringItems.map(i => i.productName.toLowerCase()),
        ...expiringPreserves.map(i => i.name.toLowerCase()),
      ]);

      // 2. Получаем всё что есть в наличии (для matching)
      const allInventory = await db
        .select({ productName: inventory.productName })
        .from(inventory)
        .where(eq(inventory.userId, ctx.userId));

      const allPreserves = await db
        .select({ name: preserves.name })
        .from(preserves)
        .where(eq(preserves.userId, ctx.userId));

      const availableNames = new Set([
        ...allInventory.map(i => i.productName.toLowerCase()),
        ...allPreserves.map(i => i.name.toLowerCase()),
      ]);

      // 3. История готовки — когда последний раз готовили каждый рецепт
      const cookHistory = await db
        .select({ recipeId: cookingHistory.recipeId, cookedAt: cookingHistory.cookedAt })
        .from(cookingHistory)
        .where(eq(cookingHistory.userId, ctx.userId))
        .orderBy(desc(cookingHistory.cookedAt));

      const lastCookedMap = new Map<number, Date>();
      for (const h of cookHistory) {
        if (h.recipeId && !lastCookedMap.has(h.recipeId)) {
          lastCookedMap.set(h.recipeId, h.cookedAt);
        }
      }
      const everCookedIds = new Set(lastCookedMap.keys());

      // 4. Получаем все рецепты с ингредиентами
      const allRecipes = await db
        .select({
          id: recipes.id,
          title: recipes.title,
          imageUrl: recipes.imageUrl,
          totalTime: recipes.totalTime,
          category: recipes.category,
        })
        .from(recipes);

      const allIngredients = await db
        .select({
          recipeId: recipeIngredients.recipeId,
          name: recipeIngredients.name,
        })
        .from(recipeIngredients);

      // Группируем ингредиенты по рецепту
      const ingredientsByRecipe = new Map<number, string[]>();
      for (const ing of allIngredients) {
        if (!ingredientsByRecipe.has(ing.recipeId)) {
          ingredientsByRecipe.set(ing.recipeId, []);
        }
        ingredientsByRecipe.get(ing.recipeId)!.push(ing.name.toLowerCase());
      }

      // Простой fuzzy match для ингредиентов
      function fuzzyMatch(ingredientName: string, availableSet: Set<string>): boolean {
        const ingLower = ingredientName.toLowerCase();
        // Точное вхождение
        for (const avail of availableSet) {
          if (avail.includes(ingLower) || ingLower.includes(avail)) {
            return true;
          }
        }
        // Стемминг: убираем окончания
        const stemmed = ingLower.replace(/[аяеёиоуыэюь]+$/, '');
        if (stemmed.length >= 3) {
          for (const avail of availableSet) {
            const availStemmed = avail.replace(/[аяеёиоуыэюь]+$/, '');
            if (availStemmed.includes(stemmed) || stemmed.includes(availStemmed)) {
              return true;
            }
          }
        }
        return false;
      }

      // 5. Оцениваем каждый рецепт
      for (const recipe of allRecipes) {
        const ings = ingredientsByRecipe.get(recipe.id) || [];
        if (ings.length === 0) continue;

        // Проверяем истекающие ингредиенты
        const matchedExpiring: string[] = [];
        for (const ing of ings) {
          if (fuzzyMatch(ing, expiringNames)) {
            matchedExpiring.push(ing);
          }
        }

        // Проверяем доступность
        let availableCount = 0;
        for (const ing of ings) {
          if (fuzzyMatch(ing, availableNames)) {
            availableCount++;
          }
        }
        const availablePercent = Math.round((availableCount / ings.length) * 100);

        // Если есть истекающие ингредиенты — приоритет 1
        if (matchedExpiring.length > 0) {
          suggestions.push({
            recipe,
            reason: `Используй ${matchedExpiring.slice(0, 2).join(', ')} пока не испортились`,
            reasonType: 'expiring',
            priority: 1,
            expiringIngredients: matchedExpiring,
            availablePercent,
          });
          continue; // не дублируем рецепт в других категориях
        }

        // Давно не готовили (>14 дней)
        const lastCooked = lastCookedMap.get(recipe.id);
        if (lastCooked) {
          const daysSince = Math.floor((Date.now() - lastCooked.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince > 14) {
            suggestions.push({
              recipe,
              reason: `Давно не готовили — ${daysSince} дней`,
              reasonType: 'not_cooked_long',
              priority: 2,
              daysSinceCooked: daysSince,
              availablePercent,
            });
            continue;
          }
        } else {
          // Никогда не готовили
          suggestions.push({
            recipe,
            reason: 'Ещё не пробовали — время попробовать!',
            reasonType: 'never_cooked',
            priority: 3,
            availablePercent,
          });
          continue;
        }

        // Высокая доступность ингредиентов (>70%)
        if (availablePercent >= 70) {
          suggestions.push({
            recipe,
            reason: `${availablePercent}% ингредиентов есть дома`,
            reasonType: 'available',
            priority: 4,
            availablePercent,
          });
        }
      }

      // Сортируем: сначала по приоритету, потом по availablePercent
      suggestions.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (b.availablePercent || 0) - (a.availablePercent || 0);
      });

      return suggestions.slice(0, input.limit);
    }),
});
