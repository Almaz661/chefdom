import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { receipts, receiptItems, users, products, priceHistory } from '../db/schema';
import { recognizeImage } from '../services/ocr';
import { parseReceiptText, ProductMasterEntry } from '../services/receiptParser';
import { translateBatchToRu } from '../services/translate';

// Валюта по умолчанию из настроек пользователя (Settings → Валюта).
// Используется когда currency не указан явно при создании чека и как
// fallback в парсере OCR для нераспознанных магазинов.
async function getUserDefaultCurrency(): Promise<'EUR' | 'RUB'> {
  const [user] = await db
    .select({ defaultCurrency: users.defaultCurrency })
    .from(users)
    .limit(1);
  return user?.defaultCurrency === 'RUB' ? 'RUB' : 'EUR';
}

// Product Master — загружает последние известные цены товаров из каталога.
// Используется для точной привязки цен в ALDI чеках с двухблочным форматом.
async function loadProductMaster(): Promise<ProductMasterEntry[]> {
  const rows = await db
    .select({ nameRu: products.nameRu, lastPrice: products.lastPrice })
    .from(products)
    .where(isNotNull(products.lastPrice));
  return rows.map(r => ({
    nameRu: r.nameRu,
    lastPrice: r.lastPrice ? parseFloat(r.lastPrice as unknown as string) : null,
  }));
}

// Product Master — обновляет/добавляет цены товаров после успешного парсинга чека.
// Записывает lastPrice, priceUpdatedAt, storeName и purchaseDate для каждого товара.
// Также сохраняет КАЖДУЮ цену в price_history для отслеживания динамики.
async function updateProductMasterPrices(
  parsedItems: Array<{ productName: string; price: number | null }>,
  storeName: string | null,
  purchaseDate: string | null,
): Promise<void> {
  for (const item of parsedItems) {
    if (item.price === null) continue;

    // 1. Обновляем/создаём запись в products (последняя цена)
    await db
      .insert(products)
      .values({
        nameRu: item.productName,
        lastPrice: String(item.price),
        priceUpdatedAt: new Date(),
        storeName: storeName ?? null,
        purchaseDate: purchaseDate ?? null,
      })
      .onConflictDoUpdate({
        target: products.nameRu,
        set: {
          lastPrice: String(item.price),
          priceUpdatedAt: new Date(),
          storeName: storeName ?? undefined,
          purchaseDate: purchaseDate ?? undefined,
        },
      })
      .catch(() => {/* игнорируем если нет уникального ключа на nameRu */});

    // 2. Записываем в историю цен (каждая покупка — отдельная строка)
    await db
      .insert(priceHistory)
      .values({
        productName: item.productName,
        price: String(item.price),
        storeName: storeName ?? null,
        purchaseDate: purchaseDate ?? null,
        currency: 'EUR',
      })
      .catch(() => {});
  }
}

// G.19 — роутер чеков.
// Сценарий: пользователь фотографирует бумажный чек из магазина,
// фото уходит в OCR.space, текст парсится в магазин/дату/позиции/итог,
// чек создаётся сразу. Если распознано плохо — пользователь удаляет
// чек и фотографирует заново.

const ItemInput = z.object({
  productName: z.string().min(1).max(300),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  price: z.number().nullable().optional(),
});

export const receiptsRouter = router({
  // Список чеков (для ReceiptsPage)
  list: protectedProcedure.query(async () => {
    const rows = await db
      .select({
        id: receipts.id,
        storeName: receipts.storeName,
        purchaseDate: receipts.purchaseDate,
        totalAmount: receipts.totalAmount,
        currency: receipts.currency,
        status: receipts.status,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .where(eq(receipts.userId, 1))
      .orderBy(desc(receipts.createdAt))
      .limit(100);
    return rows;
  }),

  // Один чек со всеми позициями (для ReceiptDetailPage)
  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [receipt] = await db
        .select()
        .from(receipts)
        .where(and(eq(receipts.id, input.id), eq(receipts.userId, 1)))
        .limit(1);
      if (!receipt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Чек не найден' });
      }
      const items = await db
        .select()
        .from(receiptItems)
        .where(eq(receiptItems.receiptId, input.id))
        .orderBy(asc(receiptItems.sortOrder), asc(receiptItems.id));
      return { receipt, items };
    }),

  // Создать пустой чек вручную (на случай если OCR не работает / нет фото).
  // Если currency не передан — берём валюту по умолчанию из настроек.
  create: protectedProcedure
    .input(
      z.object({
        storeName: z.string().max(200).optional(),
        purchaseDate: z.string().max(20).optional(),
        currency: z.enum(['EUR', 'RUB']).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const currency = input.currency ?? (await getUserDefaultCurrency());
      const [created] = await db
        .insert(receipts)
        .values({
          userId: 1,
          storeName: input.storeName ?? null,
          purchaseDate: input.purchaseDate ?? null,
          currency,
        })
        .returning({ id: receipts.id });
      return { id: created.id };
    }),

  // G.19 — главный сценарий. Принимает фото чека (base64),
  // вызывает OCR, парсит текст, создаёт чек со всеми распознанными
  // позициями. Возвращает id созданного чека и краткую статистику.
  // Если хотя бы что-то распозналось — чек создаётся. Если не получилось
  // вытащить даже одну позицию — чек всё равно создаётся (пустой,
  // пользователь добавит вручную).
  createFromPhoto: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string().min(100), // base64 фото
        // Подсказка для OCR. По умолчанию eng (латиница NL/EN).
        // Если у пользователя русские чеки — фронт пришлёт 'rus'.
        language: z.string().max(10).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // 1. OCR
      let recognized: { text: string };
      try {
        recognized = await recognizeImage(input.imageBase64, {
          language: input.language ?? 'eng',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'неизвестная ошибка';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Не удалось распознать фото: ${msg}. Попробуй сфотографировать чек ровнее, при хорошем освещении.`,
        });
      }

      if (!recognized.text || recognized.text.trim().length < 10) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Текст на фото не распознался. Сфотографируй ровно, без бликов и теней, чтобы все строки были чёткими.',
        });
      }

      // 2. Парсинг (если магазин не распознан — берём валюту из настроек)
      const userDefaultCurrency = await getUserDefaultCurrency();
      const pm = await loadProductMaster();
      const parsed = parseReceiptText(recognized.text, userDefaultCurrency, pm);

      // 3. Переводим названия товаров NL→RU (DeepL, best-effort)
      if (parsed.items.length > 0) {
        const names = parsed.items.map(it => it.productName);
        const translated = await translateBatchToRu(names, parsed.sourceLang ?? 'NL');
        for (let i = 0; i < parsed.items.length; i++) {
          parsed.items[i].productName = translated[i];
        }
      }

      // 4. Создаём чек + позиции в одной транзакции. Без транзакции при
      // сбое после INSERT receipts но до INSERT receiptItems оставался бы
      // пустой чек-«призрак» в БД.
      const created = await db.transaction(async (tx) => {
        const [receipt] = await tx
          .insert(receipts)
          .values({
            userId: 1,
            storeName: parsed.storeName,
            purchaseDate: parsed.purchaseDate,
            totalAmount:
              parsed.totalAmount !== null ? String(parsed.totalAmount) : null,
            currency: parsed.currency,
            notes: null,
            ocrRaw: recognized.text,
          })
          .returning({ id: receipts.id });

        if (parsed.items.length > 0) {
          await tx.insert(receiptItems).values(
            parsed.items.map((it, idx) => ({
              receiptId: receipt.id,
              productName: it.productName,
              price: it.price !== null ? String(it.price) : null,
              sortOrder: idx,
            })),
          );
        }

        return receipt;
      });

      // 5. Обновляем Product Master — сохраняем цены для будущих чеков
      await updateProductMasterPrices(parsed.items, parsed.storeName, parsed.purchaseDate);

      return {
        id: created.id,
        recognizedItemsCount: parsed.items.length,
        storeDetected: parsed.storeName !== null,
        dateDetected: parsed.purchaseDate !== null,
        totalDetected: parsed.totalAmount !== null,
      };
    }),

  // G.19 — перепарсить уже сохранённый чек.
  // Берёт сырой OCR-текст из БД, прогоняет через парсер заново
  // (без повторного запроса в OCR.space), удаляет старые позиции,
  // вставляет новые. Полезно после улучшения парсера или ручной правки
  // ocr_raw в БД (например через Neon SQL Console).
  // Шапка чека (магазин/дата/итог/валюта) тоже обновляется.
  reparse: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const [receipt] = await db
        .select()
        .from(receipts)
        .where(and(eq(receipts.id, input.id), eq(receipts.userId, 1)))
        .limit(1);
      if (!receipt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Чек не найден' });
      }
      if (!receipt.ocrRaw) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'У этого чека нет сохранённого текста OCR. Перепарсить можно только чеки, созданные через «Сфотографировать чек».',
        });
      }

      const userDefaultCurrency = await getUserDefaultCurrency();
      const pm = await loadProductMaster();
      const parsed = parseReceiptText(receipt.ocrRaw, userDefaultCurrency, pm);

      // Переводим названия товаров NL→RU
      if (parsed.items.length > 0) {
        const names = parsed.items.map(it => it.productName);
        const translated = await translateBatchToRu(names, parsed.sourceLang ?? 'NL');
        for (let i = 0; i < parsed.items.length; i++) {
          parsed.items[i].productName = translated[i];
        }
      }

      // Обновляем шапку + удаляем старые позиции + вставляем новые —
      // в одной транзакции. Без неё при сбое между DELETE и INSERT
      // терялись бы все позиции чека.
      await db.transaction(async (tx) => {
        await tx
          .update(receipts)
          .set({
            storeName: parsed.storeName,
            purchaseDate: parsed.purchaseDate,
            totalAmount:
              parsed.totalAmount !== null ? String(parsed.totalAmount) : null,
            currency: parsed.currency,
          })
          .where(eq(receipts.id, input.id));

        await tx
          .delete(receiptItems)
          .where(eq(receiptItems.receiptId, input.id));

        if (parsed.items.length > 0) {
          await tx.insert(receiptItems).values(
            parsed.items.map((it, idx) => ({
              receiptId: input.id,
              productName: it.productName,
              price: it.price !== null ? String(it.price) : null,
              sortOrder: idx,
            })),
          );
        }
      });

      // Обновляем Product Master — сохраняем цены для будущих чеков
      await updateProductMasterPrices(parsed.items, parsed.storeName, parsed.purchaseDate);

      return {
        id: input.id,
        recognizedItemsCount: parsed.items.length,
      };
    }),

  // Обновить «шапку» чека
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        storeName: z.string().max(200).nullable().optional(),
        purchaseDate: z.string().max(20).nullable().optional(),
        totalAmount: z.number().nullable().optional(),
        currency: z.enum(['EUR', 'RUB']).optional(),
        status: z.enum(['draft', 'final']).optional(),
        notes: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const updateData: Record<string, unknown> = {};
      if (rest.storeName !== undefined) updateData.storeName = rest.storeName;
      if (rest.purchaseDate !== undefined) updateData.purchaseDate = rest.purchaseDate;
      if (rest.totalAmount !== undefined) {
        updateData.totalAmount = rest.totalAmount === null ? null : String(rest.totalAmount);
      }
      if (rest.currency !== undefined) updateData.currency = rest.currency;
      if (rest.status !== undefined) updateData.status = rest.status;
      if (rest.notes !== undefined) updateData.notes = rest.notes;

      const result = await db
        .update(receipts)
        .set(updateData)
        .where(and(eq(receipts.id, id), eq(receipts.userId, 1)))
        .returning({ id: receipts.id });
      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Чек не найден' });
      }
      return { id };
    }),

  // Удалить чек (cascade удалит позиции — FK ON DELETE CASCADE)
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await db
        .delete(receipts)
        .where(and(eq(receipts.id, input.id), eq(receipts.userId, 1)))
        .returning({ id: receipts.id });
      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Чек не найден' });
      }
      return { id: input.id };
    }),

  // Добавить позицию вручную (если OCR что-то пропустил)
  addItem: protectedProcedure
    .input(z.object({ receiptId: z.number().int().positive(), item: ItemInput }))
    .mutation(async ({ input }) => {
      const [created] = await db
        .insert(receiptItems)
        .values({
          receiptId: input.receiptId,
          productName: input.item.productName,
          quantity:
            input.item.quantity !== null && input.item.quantity !== undefined
              ? String(input.item.quantity)
              : null,
          unit: input.item.unit ?? null,
          price:
            input.item.price !== null && input.item.price !== undefined
              ? String(input.item.price)
              : null,
        })
        .returning({ id: receiptItems.id });
      return { id: created.id };
    }),

  // Редактировать позицию (название / количество / единица / цена)
  updateItem: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        productName: z.string().min(1).max(300).optional(),
        quantity: z.number().nullable().optional(),
        unit: z.string().max(50).nullable().optional(),
        price: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const updateData: Record<string, unknown> = {};
      if (rest.productName !== undefined) updateData.productName = rest.productName;
      if (rest.quantity !== undefined) {
        updateData.quantity =
          rest.quantity === null ? null : String(rest.quantity);
      }
      if (rest.unit !== undefined) updateData.unit = rest.unit;
      if (rest.price !== undefined) {
        updateData.price = rest.price === null ? null : String(rest.price);
      }
      const result = await db
        .update(receiptItems)
        .set(updateData)
        .where(eq(receiptItems.id, id))
        .returning({ id: receiptItems.id });
      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Позиция не найдена' });
      }
      return { id };
    }),

  // Удалить позицию
  deleteItem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.delete(receiptItems).where(eq(receiptItems.id, input.id));
      return { id: input.id };
    }),

  // Синхронизировать все товары из всех чеков в каталог «Продукты».
  // Проходит по всем позициям всех чеков, добавляет/обновляет в products
  // с ценой, магазином и датой покупки.
  syncAllToProducts: protectedProcedure
    .mutation(async () => {
      const allItems = await db
        .select({
          productName: receiptItems.productName,
          price: receiptItems.price,
          storeName: receipts.storeName,
          purchaseDate: receipts.purchaseDate,
        })
        .from(receiptItems)
        .innerJoin(receipts, eq(receiptItems.receiptId, receipts.id));

      let synced = 0;
      for (const item of allItems) {
        const price = item.price ? parseFloat(item.price as unknown as string) : null;
        await db
          .insert(products)
          .values({
            nameRu: item.productName,
            lastPrice: price !== null ? String(price) : null,
            priceUpdatedAt: price !== null ? new Date() : null,
            storeName: item.storeName ?? null,
            purchaseDate: item.purchaseDate ?? null,
          })
          .onConflictDoUpdate({
            target: products.nameRu,
            set: {
              ...(price !== null ? {
                lastPrice: String(price),
                priceUpdatedAt: new Date(),
              } : {}),
              storeName: item.storeName ?? undefined,
              purchaseDate: item.purchaseDate ?? undefined,
            },
          })
          .catch(() => {/* игнорируем конфликты */});
        synced++;
      }

      return { synced };
    }),
});
