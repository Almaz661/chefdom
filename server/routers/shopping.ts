import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { purchaseItems, inventory } from '../db/schema';

// Словарь слов-модификаторов для дедупликации.
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

/** Нормализация названия для сравнения дублей */
function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();
  // Отрезаем всё после любого тире (все Unicode варианты).
  // Ищем сам символ тире, а не \s* перед ним — иначе .search()
  // возвращает 0 (матч пустой строки) и условие > 0 не срабатывает.
  const dashIdx = n.search(/[\u002D\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFF0D]/);
  if (dashIdx > 0) n = n.slice(0, dashIdx).trim();
  // Убираем скобки и их содержимое
  n = n.replace(/\([^)]*\)/g, "").trim();
  // Разбиваем на слова и убираем модификаторы
  const words = n.split(/\s+/).filter(w => !MODIFIER_WORDS.has(w));
  n = words.join(" ");
  // Убираем гласные окончания (базовый стемминг)
  n = n.replace(/[аяеёиоуыэюь]+$/, "").trim();
  return n;
}

export const shoppingRouter = router({
  // Весь список покупок. Чистый GET без побочных эффектов.
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.userId, ctx.userId))
      .orderBy(purchaseItems.addedAt);
    return items;
  }),

  // Удаление дублей — вызывается явно (кнопка в Настройках или при необходимости)
  deduplicate: protectedProcedure.mutation(async ({ ctx }) => {
    const items = await db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.userId, ctx.userId))
      .orderBy(purchaseItems.addedAt);

    const seen = new Map<string, number>();
    const dupeIds: number[] = [];
    for (const item of items) {
      const key = normalizeName(item.productName);
      if (seen.has(key)) {
        dupeIds.push(item.id);
      } else {
        seen.set(key, item.id);
      }
    }

    for (const id of dupeIds) {
      await db.delete(purchaseItems).where(eq(purchaseItems.id, id));
    }

    return { removed: dupeIds.length };
  }),

  // Добавить позицию
  add: protectedProcedure
    .input(
      z.object({
        productName: z.string().min(1).max(200),
        quantity: z.number().positive().nullable().optional(),
        unit: z.string().max(50).nullable().optional(),
        category: z.string().max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [created] = await db
        .insert(purchaseItems)
        .values({
          userId: ctx.userId,
          productName: input.productName,
          quantity: input.quantity != null ? String(input.quantity) : null,
          unit: input.unit ?? null,
          category: input.category ?? null,
        })
        .returning({ id: purchaseItems.id });
      return { id: created.id };
    }),

  // Переключить чекбокс
  toggle: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const [item] = await db
        .select({ id: purchaseItems.id, isChecked: purchaseItems.isChecked })
        .from(purchaseItems)
        .where(and(eq(purchaseItems.id, input.id), eq(purchaseItems.userId, ctx.userId)))
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
      }

      const newVal = item.isChecked === 0 ? 1 : 0;
      await db
        .update(purchaseItems)
        .set({ isChecked: newVal })
        .where(and(eq(purchaseItems.id, input.id), eq(purchaseItems.userId, ctx.userId)));

      return { id: input.id, isChecked: newVal };
    }),

  // Удалить одну позицию
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db
        .delete(purchaseItems)
        .where(and(eq(purchaseItems.id, input.id), eq(purchaseItems.userId, ctx.userId)))
        .returning({ id: purchaseItems.id });

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
      }
      return { id: input.id };
    }),

  // Купить и положить в инвентарь
  buyAndStore: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        storageType: z.enum(['fridge', 'freezer', 'pantry']).default('fridge'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(purchaseItems)
          .where(eq(purchaseItems.id, input.id))
          .limit(1);

        if (!item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
        }

        await tx
          .update(purchaseItems)
          .set({ isChecked: 1 })
          .where(eq(purchaseItems.id, input.id));

        await tx.insert(inventory).values({
          userId: ctx.userId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          storageType: input.storageType,
          category: item.category,
        });

        return { id: input.id };
      });
    }),

  // Очистить отмеченные (купленные)
  clearChecked: protectedProcedure.mutation(async ({ ctx }) => {
    const deleted = await db
      .delete(purchaseItems)
      .where(and(eq(purchaseItems.userId, ctx.userId), eq(purchaseItems.isChecked, 1)))
      .returning({ id: purchaseItems.id });
    return { count: deleted.length };
  }),
});
