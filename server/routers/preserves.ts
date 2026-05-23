import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, eq, sql as rawSql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { preserves, freezerShelfLife } from '../db/schema';

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

  // Этап D — авто-подсказка срока хранения для типа frozen.
  // По названию ('Свиные котлеты') ищет в справочнике freezer_shelf_life
  // подходящий ключ ('котлет' → 4 мес) и возвращает количество дней
  // и предполагаемую дату «годен до» = preparedAt + days.
  //
  // Логика выбора лучшего ключа:
  //  1. Берём все ключи где LOWER(name) LIKE '%LOWER(keyword)%'
  //  2. Сортируем: сначала длиннее keyword (специфичнее),
  //     потом больше priority (явное предпочтение).
  //  3. Возвращаем первый.
  // Если ни один ключ не совпал — вернём { matched: false } и фронт
  // оставит поле пустым.
  suggestExpiry: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        preparedAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const nameLower = input.name.toLowerCase().trim();
      if (nameLower.length === 0) return { matched: false as const };

      // SQL-запрос: ищем ключи, для которых nameLower содержит keyword.
      // ILIKE работает в обе стороны — нам нужно ${nameLower} LIKE %keyword%,
      // т.е. nameLower содержит keyword. Используем POSITION или просто
      // фильтруем на уровне приложения, чтобы не плодить SQL-инъекций.
      const all = await db
        .select({
          keyword: freezerShelfLife.keyword,
          days: freezerShelfLife.days,
          priority: freezerShelfLife.priority,
          description: freezerShelfLife.description,
        })
        .from(freezerShelfLife)
        .where(rawSql`${nameLower} LIKE '%' || LOWER(${freezerShelfLife.keyword}) || '%'`);

      if (all.length === 0) return { matched: false as const };

      // Лучшее совпадение: длиннее keyword > больше priority
      all.sort((a, b) => {
        if (b.keyword.length !== a.keyword.length) {
          return b.keyword.length - a.keyword.length;
        }
        return b.priority - a.priority;
      });
      const best = all[0];

      // Считаем дату «годен до»: preparedAt + days, либо просто days
      // от сегодня, если preparedAt не передан.
      const baseDate = input.preparedAt
        ? new Date(input.preparedAt + 'T00:00:00')
        : new Date();
      const expiry = new Date(baseDate);
      expiry.setDate(expiry.getDate() + best.days);
      const expiryDate = expiry.toISOString().slice(0, 10);

      return {
        matched: true as const,
        keyword: best.keyword,
        days: best.days,
        description: best.description,
        expiryDate,
      };
    }),
});
