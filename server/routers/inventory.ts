import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, lte, isNotNull, sql as rawSql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { inventory, shelfLife } from '../db/schema';
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

  // Пересчитать сроки — проставить expiryDate всем продуктам где сейчас пусто.
  // Ищет по справочнику shelf_life для каждого продукта по storageType+name.
  recalcExpiry: protectedProcedure
    .mutation(async () => {
      // Берём все продукты без срока годности
      const itemsWithoutExpiry = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, 1),
          )
        );

      const noExpiry = itemsWithoutExpiry.filter(i => !i.expiryDate);
      if (noExpiry.length === 0) return { updated: 0 };

      let updated = 0;
      for (const item of noExpiry) {
        const nameLower = item.productName.toLowerCase().trim();
        if (!nameLower) continue;

        const matches = await db
          .select({
            keyword: shelfLife.keyword,
            days: shelfLife.days,
            priority: shelfLife.priority,
          })
          .from(shelfLife)
          .where(
            and(
              eq(shelfLife.storageType, item.storageType),
              rawSql`${nameLower} LIKE '%' || LOWER(${shelfLife.keyword}) || '%'`
            )
          );

        if (matches.length === 0) continue;

        // Лучшее совпадение
        matches.sort((a, b) => {
          if (b.keyword.length !== a.keyword.length) return b.keyword.length - a.keyword.length;
          return b.priority - a.priority;
        });
        const best = matches[0];

        // Считаем дату от addedAt
        const baseDate = new Date(item.addedAt);
        baseDate.setDate(baseDate.getDate() + best.days);
        const expiryDate = baseDate.toISOString().slice(0, 10);

        await db
          .update(inventory)
          .set({ expiryDate })
          .where(eq(inventory.id, item.id));

        updated++;
      }

      return { updated, total: noExpiry.length };
    }),

  // Авто-подсказка срока годности для любого типа хранения.
  // По названию продукта и типу хранения (fridge/freezer/pantry)
  // ищет в справочнике shelf_life подходящий ключ и возвращает
  // рекомендованную дату «годен до».
  //
  // Логика выбора лучшего ключа:
  //  1. Берём все ключи где LOWER(name) LIKE '%LOWER(keyword)%'
  //  2. Сортируем: сначала длиннее keyword (специфичнее),
  //     потом больше priority (явное предпочтение).
  //  3. Возвращаем первый.
  // Если ни один ключ не совпал — вернём { matched: false }.
  suggestExpiry: protectedProcedure
    .input(
      z.object({
        productName: z.string().min(1).max(200),
        storageType: z.enum(storageTypes),
        purchaseDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const nameLower = input.productName.toLowerCase().trim();
      if (nameLower.length === 0) return { matched: false as const };

      // Ищем все записи для данного типа хранения, где название содержит keyword
      const all = await db
        .select({
          keyword: shelfLife.keyword,
          days: shelfLife.days,
          priority: shelfLife.priority,
          description: shelfLife.description,
        })
        .from(shelfLife)
        .where(
          and(
            eq(shelfLife.storageType, input.storageType),
            rawSql`${nameLower} LIKE '%' || LOWER(${shelfLife.keyword}) || '%'`
          )
        );

      if (all.length === 0) return { matched: false as const };

      // Лучшее совпадение: длиннее keyword > больше priority
      all.sort((a, b) => {
        if (b.keyword.length !== a.keyword.length) {
          return b.keyword.length - a.keyword.length;
        }
        return b.priority - a.priority;
      });
      const best = all[0];

      // Считаем дату «годен до»: purchaseDate + days, либо от сегодня
      const baseDate = input.purchaseDate
        ? new Date(input.purchaseDate + 'T00:00:00')
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
