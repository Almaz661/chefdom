import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, lte, isNotNull, isNull, sql as rawSql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { inventory, shelfLife, products } from '../db/schema';
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
  // Весь инвентарь
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await db
      .select()
      .from(inventory)
      .where(eq(inventory.userId, ctx.userId))
      .orderBy(inventory.productName);
    return items;
  }),

  // B.1 — продукты истекающие в ближайшие N дней (по умолчанию 3)
  getExpiring: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(30).default(3) }))
    .query(async ({ input, ctx }) => {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + input.days);
      const limitStr = limitDate.toISOString().slice(0, 10);
      const items = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, ctx.userId),
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
    .query(async ({ input, ctx }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);
      const items = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, ctx.userId),
            lte(inventory.addedAt, cutoffDate),
            isNull(inventory.expiryDate),
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
        minQuantity: z.number().positive().nullable().optional(),
        category: z.string().max(100).nullable().optional(),
        isBasic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const productName = await ensureRussianName(input.productName);
      const [created] = await db
        .insert(inventory)
        .values({
          userId: ctx.userId,
          productName,
          quantity: input.quantity != null ? String(input.quantity) : null,
          unit: input.unit ?? null,
          storageType: input.storageType,
          expiryDate: input.expiryDate ?? null,
          minQuantity: input.minQuantity != null ? String(input.minQuantity) : null,
          category: input.category ?? null,
          isBasic: input.isBasic ? 1 : 0,
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
        minQuantity: z.number().positive().nullable().optional(),
        category: z.string().max(100).nullable().optional(),
        isBasic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;

      const [existing] = await db
        .select({ id: inventory.id })
        .from(inventory)
        .where(and(eq(inventory.id, id), eq(inventory.userId, ctx.userId)))
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
      if (fields.minQuantity !== undefined) updates.minQuantity = fields.minQuantity != null ? String(fields.minQuantity) : null;
      if (fields.category !== undefined) updates.category = fields.category;
      if (fields.isBasic !== undefined) updates.isBasic = fields.isBasic ? 1 : 0;

      await db.update(inventory).set(updates).where(and(eq(inventory.id, id), eq(inventory.userId, ctx.userId)));
      return { id };
    }),

  // Массовое добавление из чека (Чек → Инвентарь + Каталог продуктов)
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
            price: z.number().nullable().optional(),
          }),
        ).min(1).max(100),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Параллельно переводим все названия с латиницей (одна сетевая поездка
      // на каждое имя, но мутации идут редко — оптимизировать не нужно).
      const translatedNames = await Promise.all(
        input.items.map((item) => ensureRussianName(item.productName)),
      );

      const created: { id: number; productName: string }[] = [];
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const productName = translatedNames[i];

        // 1. Добавляем в инвентарь
        const [row] = await db
          .insert(inventory)
          .values({
            userId: ctx.userId,
            productName,
            quantity: item.quantity != null ? String(item.quantity) : null,
            unit: item.unit ?? null,
            storageType: item.storageType,
            expiryDate: item.expiryDate ?? null,
            category: item.category ?? null,
          })
          .returning({ id: inventory.id, productName: inventory.productName });
        created.push(row);

        // 2. Сохраняем/обновляем в каталоге products (с ценой)
        await db
          .insert(products)
          .values({
            nameRu: productName,
            lastPrice: item.price != null ? String(item.price) : null,
            priceUpdatedAt: item.price != null ? new Date() : null,
          })
          .onConflictDoUpdate({
            target: products.nameRu,
            set: {
              ...(item.price != null ? {
                lastPrice: String(item.price),
                priceUpdatedAt: new Date(),
              } : {}),
            },
          })
          .catch(() => {/* игнорируем если нет уникального ключа */});
      }
      return { added: created.length, items: created };
    }),

  // Удалить
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db
        .delete(inventory)
        .where(and(eq(inventory.id, input.id), eq(inventory.userId, ctx.userId)))
        .returning({ id: inventory.id });

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Продукт не найден' });
      }
      return { id: input.id };
    }),

  // Пересчитать сроки — проставить expiryDate всем продуктам где сейчас пусто.
  // Ищет по справочнику shelf_life для каждого продукта по storageType+name.
  recalcExpiry: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Берём все продукты без срока годности
      const itemsWithoutExpiry = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, ctx.userId),
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

  // Проверить все продукты с minQuantity и добавить в покупки те,
  // которые ниже минимума. Вызывается вручную (кнопка) или автоматически.
  checkMinQuantity: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { purchaseItems } = await import('../db/schema');
      const { ilike } = await import('drizzle-orm');

      const allItems = await db
        .select()
        .from(inventory)
        .where(eq(inventory.userId, ctx.userId));

      let added = 0;
      for (const item of allItems) {
        if (!item.minQuantity) continue;
        const qty = item.quantity ? parseFloat(item.quantity) : 0;
        const minQty = parseFloat(item.minQuantity);
        if (isNaN(minQty) || minQty <= 0) continue;
        if (qty >= minQty) continue;

        // Проверяем нет ли уже в покупках
        const exists = await db
          .select({ id: purchaseItems.id })
          .from(purchaseItems)
          .where(
            and(
              eq(purchaseItems.userId, ctx.userId),
              ilike(purchaseItems.productName, item.productName),
            ),
          )
          .limit(1);

        if (exists.length === 0) {
          await db.insert(purchaseItems).values({
            userId: ctx.userId,
            productName: item.productName,
            quantity: String(minQty),
            unit: item.unit,
          });
          added++;
        }
      }

      return { added };
    }),

  // Умный массовый перенос товаров в инвентарь (из чека или покупок).
  // Для каждого товара авто-определяет:
  //   - storageType по ключевым словам в названии (замороженное → freezer, крупа → pantry, и т.д.)
  //   - expiryDate через справочник shelf_life
  // Пользователь может переопределить любое значение на фронте перед отправкой.
  addBulkSmart: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            productName: z.string().min(1).max(200),
            quantity: z.number().positive().nullable().optional(),
            unit: z.string().max(50).nullable().optional(),
            // Если передан — используем как есть. Если null/undefined — авто-определяем.
            storageType: z.enum(['fridge', 'freezer', 'pantry']).nullable().optional(),
            expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            category: z.string().max(100).nullable().optional(),
            price: z.number().nullable().optional(),
          }),
        ).min(1).max(100),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Ключевые слова для авто-определения storageType
      const FREEZER_KEYWORDS = [
        'замороженн', 'заморож', 'мороженое', 'пельмен', 'вареник',
        'наггетс', 'фри', 'ice cream', 'frozen', 'bevroren',
      ];
      const PANTRY_KEYWORDS = [
        'крупа', 'рис', 'гречк', 'макарон', 'спагетти', 'лапша', 'мука',
        'сахар', 'соль', 'масло подсолн', 'масло растит', 'оливков',
        'консерв', 'горох', 'фасоль', 'чечевиц', 'нут',
        'чай', 'кофе', 'какао', 'специ', 'перец молот', 'корица',
        'уксус', 'соус', 'кетчуп', 'майонез', 'горчиц',
        'печенье', 'крекер', 'сухар', 'хлебц', 'вафл',
        'варенье', 'джем', 'мёд', 'мед', 'сироп',
        'pasta', 'rijst', 'suiker', 'zout', 'olie', 'azijn',
        'thee', 'koffie', 'saus', 'mosterd', 'peper',
      ];

      function guessStorageType(name: string): 'fridge' | 'freezer' | 'pantry' {
        const lower = name.toLowerCase();
        for (const kw of FREEZER_KEYWORDS) {
          if (lower.includes(kw)) return 'freezer';
        }
        for (const kw of PANTRY_KEYWORDS) {
          if (lower.includes(kw)) return 'pantry';
        }
        return 'fridge'; // по умолчанию — холодильник
      }

      const translatedNames = await Promise.all(
        input.items.map((item) => ensureRussianName(item.productName)),
      );

      const created: { id: number; productName: string; storageType: string; expiryDate: string | null }[] = [];

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const productName = translatedNames[i];

        // Определяем storageType
        const storageType = item.storageType ?? guessStorageType(productName);

        // Определяем expiryDate
        let expiryDate = item.expiryDate ?? null;
        if (!expiryDate) {
          // Ищем в справочнике shelf_life
          const nameLower = productName.toLowerCase().trim();
          if (nameLower.length > 0) {
            const shelfMatches = await db
              .select({
                keyword: shelfLife.keyword,
                days: shelfLife.days,
                priority: shelfLife.priority,
              })
              .from(shelfLife)
              .where(
                and(
                  eq(shelfLife.storageType, storageType),
                  rawSql`${nameLower} LIKE '%' || LOWER(${shelfLife.keyword}) || '%'`
                )
              );

            if (shelfMatches.length > 0) {
              shelfMatches.sort((a, b) => {
                if (b.keyword.length !== a.keyword.length) return b.keyword.length - a.keyword.length;
                return b.priority - a.priority;
              });
              const best = shelfMatches[0];
              const expiry = new Date();
              expiry.setDate(expiry.getDate() + best.days);
              expiryDate = expiry.toISOString().slice(0, 10);
            }
          }
        }

        // Добавляем в инвентарь
        const [row] = await db
          .insert(inventory)
          .values({
            userId: ctx.userId,
            productName,
            quantity: item.quantity != null ? String(item.quantity) : null,
            unit: item.unit ?? null,
            storageType,
            expiryDate,
            category: item.category ?? null,
          })
          .returning({ id: inventory.id, productName: inventory.productName });

        created.push({ ...row, storageType, expiryDate });

        // Обновляем каталог products (с ценой)
        if (item.price != null) {
          await db
            .insert(products)
            .values({
              nameRu: productName,
              lastPrice: String(item.price),
              priceUpdatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: products.nameRu,
              set: {
                lastPrice: String(item.price),
                priceUpdatedAt: new Date(),
              },
            })
            .catch(() => {});
        }
      }

      return { added: created.length, items: created };
    }),
});
