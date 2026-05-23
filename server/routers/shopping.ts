import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { purchaseItems, inventory } from '../db/schema';

export const shoppingRouter = router({
  // Весь список покупок (userId=1)
  list: protectedProcedure.query(async () => {
    const items = await db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.userId, 1))
      .orderBy(purchaseItems.addedAt);
    return items;
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
  toggle: protectedProcedure
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
  remove: protectedProcedure
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

  // Купить и положить в инвентарь.
  // Транзакция гарантирует: либо товар отмечен купленным И добавлен в
  // холодильник, либо ничего не происходит. Без транзакции при сбое
  // между двумя шагами товар мог оказаться «купленным» в списке, но
  // не попасть в инвентарь.
  buyAndStore: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        storageType: z.enum(['fridge', 'freezer', 'pantry']).default('fridge'),
      }),
    )
    .mutation(async ({ input }) => {
      return await db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(purchaseItems)
          .where(eq(purchaseItems.id, input.id))
          .limit(1);

        if (!item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
        }

        // Отметить купленным
        await tx
          .update(purchaseItems)
          .set({ isChecked: 1 })
          .where(eq(purchaseItems.id, input.id));

        // Добавить в инвентарь
        await tx.insert(inventory).values({
          userId: 1,
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
  clearChecked: protectedProcedure.mutation(async () => {
    const deleted = await db
      .delete(purchaseItems)
      .where(and(eq(purchaseItems.userId, 1), eq(purchaseItems.isChecked, 1)))
      .returning({ id: purchaseItems.id });
    return { count: deleted.length };
  }),
});
