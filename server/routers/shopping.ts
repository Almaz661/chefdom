import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../db/index';
import { purchaseItems } from '../db/schema';

export const shoppingRouter = router({
  // Весь список покупок (userId=1)
  list: publicProcedure.query(async () => {
    const items = await db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.userId, 1))
      .orderBy(purchaseItems.addedAt);
    return items;
  }),

  // Добавить позицию
  add: publicProcedure
    .input(
      z.object({
        productName: z.string().min(1).max(200),
        quantity: z.number().positive().nullable().optional(),
        unit: z.string().max(50).nullable().optional(),
        category: z.string().max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [created] = await db
        .insert(purchaseItems)
        .values({
          userId: 1,
          productName: input.productName,
          quantity: input.quantity != null ? String(input.quantity) : null,
          unit: input.unit ?? null,
          category: input.category ?? null,
        })
        .returning({ id: purchaseItems.id });
      return { id: created.id };
    }),

  // Переключить чекбокс
  toggle: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const [item] = await db
        .select({ id: purchaseItems.id, isChecked: purchaseItems.isChecked })
        .from(purchaseItems)
        .where(eq(purchaseItems.id, input.id))
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
      }

      const newVal = item.isChecked === 0 ? 1 : 0;
      await db
        .update(purchaseItems)
        .set({ isChecked: newVal })
        .where(eq(purchaseItems.id, input.id));

      return { id: input.id, isChecked: newVal };
    }),

  // Удалить одну позицию
  remove: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await db
        .delete(purchaseItems)
        .where(eq(purchaseItems.id, input.id))
        .returning({ id: purchaseItems.id });

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
      }
      return { id: input.id };
    }),

  // Очистить отмеченные (купленные)
  clearChecked: publicProcedure.mutation(async () => {
    const deleted = await db
      .delete(purchaseItems)
      .where(and(eq(purchaseItems.userId, 1), eq(purchaseItems.isChecked, 1)))
      .returning({ id: purchaseItems.id });
    return { count: deleted.length };
  }),
});
