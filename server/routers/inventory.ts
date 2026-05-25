import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, lte, isNotNull, sql as rawSql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { inventory, inventoryShelfLife } from '../db/schema';
import { translatePlainToRu } from '../services/translate';

const storageTypes = ['fridge', 'freezer', 'pantry'] as const;

/**
 * Если в названии есть латиница и нет кириллицы — переводим на русский.
 * Используется при добавлении в инвентарь (после штрих-кода / чека / руками),
 * чтобы во всех списках было единообразное русское название.
 *
 * translatePlainToRu сам обрабатывает: отсутствие DEEPL_API_KEY, ошибки сети,
 * слишком короткие строки. В худшем случае вернёт исходный текст.
 */
async function ensureRussianName(name: string): Promise<string> {
  const hasLatin = /[a-zA-Z]/.test(name);
  const hasCyrillic = /[а-яА-ЯёЁ]/.test(name);
  if (!hasLatin || hasCyrillic) return name;
  return translatePlainToRu(name);
}

export const inventoryRouter = router({
  // Весь инвентарь (userId=1)
  list: protectedProcedure.query(async () => {
    const items = await db
      .select()
      .from(inventory)
      .where(eq(inventory.userId, 1))
      .orderBy(inventory.productName);
    return items;
  }),

  // B.1 — продукты истекающие в ближайшие N дней (по умолчанию 3)
  getExpiring: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(30).default(3) }))
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

  // B.2 — продукты которые лежат в инвентаре давно (по умолчанию >30 дней).
  // Не учитываем те у которых явно указан срок годности — для них работает B.1.
  getStale: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);
      const items = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, 1),
            lte(inventory.addedAt, cutoffDate),
          )
        )
        .orderBy(inventory.addedAt);
      return items;
    }),

  // Добавить продукт
  add: protectedProcedure
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
      const productName = await ensureRussianName(input.productName);
      const [created] = await db
        .insert(inventory)
        .values({
          userId: 1,
          productName,
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
  update: protectedProcedure
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

  // Массовое добавление из чека (Чек → Инвентарь)
  addBulk: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            productName: z.string().min(1).max(200),
            quantity: z.number().positive().nullable().optional(),
            unit: z.string().max(50).nullable().optional(),
            storageType: z.enum(storageTypes).default('fridge'),
            expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            category: z.string().max(100).nullable().optional(),
          }),
        ).min(1).max(100),
      }),
    )
    .mutation(async ({ input }) => {
      // Параллельно переводим все названия с латиницей (одна сетевая поездка
      // на каждое имя, но мутации идут редко — оптимизировать не нужно).
      const translatedNames = await Promise.all(
        input.items.map((item) => ensureRussianName(item.productName)),
      );

      const created: { id: number; productName: string }[] = [];
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const [row] = await db
          .insert(inventory)
          .values({
            userId: 1,
            productName: translatedNames[i],
            quantity: item.quantity != null ? String(item.quantity) : null,
            unit: item.unit ?? null,
            storageType: item.storageType,
            expiryDate: item.expiryDate ?? null,
            category: item.category ?? null,
          })
          .returning({ id: inventory.id, productName: inventory.productName });
        created.push(row);
      }
      return { added: created.length, items: created };
    }),

  // Авто-подсказка срока хранения для инвентаря.
  // По названию продукта и типу хранилища ищет в справочнике inventory_shelf_life
  // подходящий ключ и возвращает рекомендованную дату «годен до».
  // Логика выбора: самый длинный совпавший keyword (специфичнее), при равной
  // длине — больший priority. Если ничего не найдено — { matched: false }.
  // storageType 'freezer' → делегируем в freezer_shelf_life (таблица заготовок).
  suggestExpiry: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        storageType: z.enum(['fridge', 'freezer', 'pantry']).default('fridge'),
      }),
    )
    .query(async ({ input }) => {
      const nameLower = input.name.toLowerCase().trim();
      if (nameLower.length === 0) return { matched: false as const };

      // Ищем записи где nameLower содержит keyword (name LIKE %keyword%)
      const rows = await db
        .select({
          keyword: inventoryShelfLife.keyword,
          days: inventoryShelfLife.days,
          priority: inventoryShelfLife.priority,
          description: inventoryShelfLife.description,
        })
        .from(inventoryShelfLife)
        .where(
          and(
            eq(inventoryShelfLife.storageType, input.storageType),
            rawSql`${nameLower} LIKE '%' || LOWER(${inventoryShelfLife.keyword}) || '%'`,
          ),
        );

      if (rows.length === 0) return { matched: false as const };

      // Лучшее совпадение: длиннее keyword → специфичнее; при равной длине — priority
      rows.sort((a, b) => {
        if (b.keyword.length !== a.keyword.length) return b.keyword.length - a.keyword.length;
        return b.priority - a.priority;
      });
      const best = rows[0];

      // Дата «годен до» = сегодня + days
      const expiry = new Date();
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

  // Удалить
  remove: protectedProcedure
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
