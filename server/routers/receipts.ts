import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../db/index';
import { receipts, receiptItems, products } from '../db/schema';

// G.19 — роутер чеков.
// CRUD по чекам + добавление товара в чек по штрих-коду
// (находим в каталоге products через products.barcode).

const ItemInput = z.object({
  productName: z.string().min(1).max(300),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  price: z.number().nullable().optional(),
  barcode: z.string().max(50).nullable().optional(),
  matchedProductId: z.number().int().positive().nullable().optional(),
});

export const receiptsRouter = router({
  // Список чеков (для ReceiptsPage)
  list: publicProcedure.query(async () => {
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
  getById: publicProcedure
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

  // Создать пустой чек. Дальше пользователь добавляет позиции вручную
  // или по штрих-коду через addItem / addItemByBarcode.
  create: publicProcedure
    .input(
      z.object({
        storeName: z.string().max(200).optional(),
        purchaseDate: z.string().max(20).optional(),
        currency: z.enum(['EUR', 'RUB']).default('EUR'),
      }),
    )
    .mutation(async ({ input }) => {
      const [created] = await db
        .insert(receipts)
        .values({
          userId: 1,
          storeName: input.storeName ?? null,
          purchaseDate: input.purchaseDate ?? null,
          currency: input.currency,
        })
        .returning({ id: receipts.id });
      return { id: created.id };
    }),

  // Обновить «шапку» чека
  update: publicProcedure
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
  delete: publicProcedure
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

  // Добавить позицию вручную
  addItem: publicProcedure
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
          barcode: input.item.barcode ?? null,
          matchedProductId: input.item.matchedProductId ?? null,
        })
        .returning({ id: receiptItems.id });
      return { id: created.id };
    }),

  // G.19 — добавить позицию по штрих-коду.
  // Ищем товар в products. Если найден — берём из него name + brand,
  // привязываем matched_product_id. Если не найден — возвращаем ошибку,
  // фронт предложит добавить вручную.
  addItemByBarcode: publicProcedure
    .input(
      z.object({
        receiptId: z.number().int().positive(),
        barcode: z.string().min(1).max(50),
        quantity: z.number().nullable().optional(),
        price: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [product] = await db
        .select({
          id: products.id,
          nameRu: products.nameRu,
          brand: products.brand,
          packageQuantity: products.packageQuantity,
          packageUnit: products.packageUnit,
        })
        .from(products)
        .where(eq(products.barcode, input.barcode))
        .limit(1);

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Товар не найден в каталоге. Добавьте вручную.',
        });
      }

      const productName = product.brand
        ? `${product.brand} ${product.nameRu}`
        : product.nameRu;

      const [created] = await db
        .insert(receiptItems)
        .values({
          receiptId: input.receiptId,
          productName,
          quantity:
            input.quantity !== null && input.quantity !== undefined
              ? String(input.quantity)
              : product.packageQuantity,
          unit: product.packageUnit,
          price:
            input.price !== null && input.price !== undefined
              ? String(input.price)
              : null,
          barcode: input.barcode,
          matchedProductId: product.id,
        })
        .returning({ id: receiptItems.id });

      return { id: created.id, productName, matchedProductId: product.id };
    }),

  // Удалить позицию
  deleteItem: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.delete(receiptItems).where(eq(receiptItems.id, input.id));
      return { id: input.id };
    }),
});
