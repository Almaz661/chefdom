import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { preserves } from '../db/schema';

// Этап D — роутер заготовок. Три типа в одной таблице.
// list/listByType работают как у inventory: один SELECT, фильтр на клиенте
// или явная фильтрация по preserve_type.

const preserveTypes = ['frozen', 'preserved', 'opened'] as const;

// Опциональные поля дат — пустая строка приравнивается к null,
// чтобы фронт мог слать "" из необязательного <input type="date">.
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const preservesRouter = router({
  // Все заготовки пользователя (UI потом фильтрует по табу)
  list: protectedProcedure.query(async () => {
    return db
      .select()
      .from(preserves)
      .where(eq(preserves.userId, 1))
      .orderBy(preserves.preserveType, preserves.name);
  }),

  // Только указанного типа (для будущих экранов где нужен один тип)
  listByType: protectedProcedure
    .input(z.object({ type: z.enum(preserveTypes) }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(preserves)
        .where(
          and(
            eq(preserves.userId, 1),
            eq(preserves.preserveType, input.type),
          ),
        )
        .orderBy(preserves.name);
    }),

  // Создать заготовку. servings разрешён только для frozen
  // (для других не имеет смысла, но если придёт — игнорируем).
  add: protectedProcedure
    .input(
      z.object({
        preserveType: z.enum(preserveTypes),
        name: z.string().min(1).max(200),
        quantity: z.number().positive().nullable().optional(),
        unit: z.string().max(50).nullable().optional(),
        servings: z.number().int().positive().nullable().optional(),
        preparedAt: dateField,
        expiryDate: dateField,
        notes: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [created] = await db
        .insert(preserves)
        .values({
          userId: 1,
          preserveType: input.preserveType,
          name: input.name,
          quantity: input.quantity != null ? String(input.quantity) : null,
          unit: input.unit ?? null,
          // servings храним только для frozen, для других — null
          servings: input.preserveType === 'frozen' ? input.servings ?? null : null,
          preparedAt: input.preparedAt ?? null,
          expiryDate: input.expiryDate ?? null,
          notes: input.notes ?? null,
        })
        .returning({ id: preserves.id });
      return { id: created.id };
    }),

  // Обновить — все поля опциональны, что не передано, не трогаем.
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(200).optional(),
        quantity: z.number().positive().nullable().optional(),
        unit: z.string().max(50).nullable().optional(),
        servings: z.number().int().positive().nullable().optional(),
        preparedAt: dateField,
        expiryDate: dateField,
        notes: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.name !== undefined) updates.name = fields.name;
      if (fields.quantity !== undefined) {
        updates.quantity = fields.quantity != null ? String(fields.quantity) : null;
      }
      if (fields.unit !== undefined) updates.unit = fields.unit;
      if (fields.servings !== undefined) updates.servings = fields.servings;
      if (fields.preparedAt !== undefined) updates.preparedAt = fields.preparedAt;
      if (fields.expiryDate !== undefined) updates.expiryDate = fields.expiryDate;
      if (fields.notes !== undefined) updates.notes = fields.notes;

      const result = await db
        .update(preserves)
        .set(updates)
        .where(and(eq(preserves.id, id), eq(preserves.userId, 1)))
        .returning({ id: preserves.id });
      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Заготовка не найдена' });
      }
      return { id };
    }),

  // Удалить
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await db
        .delete(preserves)
        .where(and(eq(preserves.id, input.id), eq(preserves.userId, 1)))
        .returning({ id: preserves.id });
      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Заготовка не найдена' });
      }
      return { id: input.id };
    }),
});
