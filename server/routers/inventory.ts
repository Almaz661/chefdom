import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../db/index';
import { inventory } from '../db/schema';

const storageTypes = ['fridge', 'freezer', 'pantry'] as const;

export const inventoryRouter = router({
  // Весь инвентарь (userId=1)
  list: publicProcedure.query(async () => {
    const items = await db
      .select()
      .from(inventory)
      .where(eq(inventory.userId, 1))
      .orderBy(inventory.productName);
    return items;
  }),

  // B.1 — продукты истекающие в ближайшие N дней
  getExpiring: publicProcedure
    .input(z.object({ days: z.number().int().min(1).max(30).default(2) }))
    .query(async ({ input }) => {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + input.days);
      const limitStr = limitDate.toISOString().slice(0, 10);
      const items = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, 1),
            isNotNull(inventory.expiryDate),
            lte(inventory.expiryDate, limitStr),
          )
        )
        .orderBy(inventory.expiryDate);
      return items;
    }),

  // Добавить продукт
  add: publicProcedure
    .input(
      z.object({
        productName: z.string().min(1).max(200),
        quantity: z.number().positive().nullable().optional(),
        unit: z.string().max(50).nullable().optional(),
        storageType: z.enum(storageTypes).default('fridge'),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        category: z.string().max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [created] = await db
        .insert(inventory)
        .values({
          userId: 1,
          productName: input.productName,
          quantity: input.quantity != null ? String(input.quantity) : null,
          unit: input.unit ?? null,
          storageType: input.storageType,
          expiryDate: input.expiryDate ?? null,
          category: input.category ?? null,
        })
        .returning({ id: inventory.id });
      return { id: created.id };
    }),

  // Обновить (количество, срок, локация)
  update: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        productName: z.string().min(1).max(200).optional(),
        quantity: z.number().positive().nullable().optional(),
        unit: z.string().max(50).nullable().optional(),
        storageType: z.enum(storageTypes).optional(),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        category: z.string().max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;

      const [existing] = await db
        .select({ id: inventory.id })
        .from(inventory)
        .where(eq(inventory.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Продукт не найден' });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.productName !== undefined) updates.productName = fields.productName;
      if (fields.quantity !== undefined) updates.quantity = fields.quantity != null ? String(fields.quantity) : null;
      if (fields.unit !== undefined) updates.unit = fields.unit;
      if (fields.storageType !== undefined) updates.storageType = fields.storageType;
      if (fields.expiryDate !== undefined) updates.expiryDate = fields.expiryDate;
      if (fields.category !== undefined) updates.category = fields.category;

      await db.update(inventory).set(updates).where(eq(inventory.id, id));
      return { id };
    }),

  // Удалить
  remove: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await db
        .delete(inventory)
        .where(eq(inventory.id, input.id))
        .returning({ id: inventory.id });

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Продукт не найден' });
      }
      return { id: input.id };
    }),
});
