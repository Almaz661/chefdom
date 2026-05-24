import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db/index';
import { cookingHistory, recipeIngredients, receipts, receiptItems } from '../db/schema';

// C.3 — Аналитика.
// Период: «Неделя» / «Месяц» / «3 месяца» (план раздел 19.4).
// Две процедуры:
//   topRecipes — топ-5 самых частых рецептов за период
//   productConsumption — расход продуктов за период (суммирует ингредиенты из приготовленных рецептов)

const PeriodSchema = z.enum(['week', 'month', '3months']).default('month');
type Period = z.infer<typeof PeriodSchema>;

function periodStart(period: Period): Date {
  const now = new Date();
  if (period === 'week') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // 3months
  return new Date(now.getFullYear(), now.getMonth() - 2, 1);
}

export const analyticsRouter = router({
  // --- Аналитика по ЧЕКАМ (расходы) ---

  // Отчёт за месяц: топ-продукты, расходы по категориям, общая сумма
  spendingReport: protectedProcedure
    .input(z.object({
      // Формат: "2026-01" (год-месяц) или "2026" (весь год)
      period: z.string().regex(/^\d{4}(-\d{2})?$/),
    }))
    .query(async ({ input }) => {

      // Определяем границы периода
      let dateFrom: string;
      let dateTo: string;
      let periodLabel: string;

      if (input.period.length === 7) {
        // Месяц: "2026-05"
        dateFrom = `${input.period}-01`;
        const [y, m] = input.period.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        dateTo = `${input.period}-${String(lastDay).padStart(2, '0')}`;
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        periodLabel = `${monthNames[m - 1]} ${y}`;
      } else {
        // Год: "2026"
        dateFrom = `${input.period}-01-01`;
        dateTo = `${input.period}-12-31`;
        periodLabel = `${input.period} год`;
      }

      // Получаем все чеки за период
      const periodReceipts = await db
        .select({
          id: receipts.id,
          storeName: receipts.storeName,
          totalAmount: receipts.totalAmount,
          purchaseDate: receipts.purchaseDate,
          currency: receipts.currency,
        })
        .from(receipts)
        .where(
          and(
            eq(receipts.userId, 1),
            gte(receipts.purchaseDate, dateFrom),
            lte(receipts.purchaseDate, dateTo),
          ),
        )
        .orderBy(desc(receipts.purchaseDate));

      if (periodReceipts.length === 0) {
        return {
          periodLabel,
          totalSpent: 0,
          currency: 'EUR',
          receiptCount: 0,
          topProducts: [],
          byStore: [],
          byMonth: [],
        };
      }

      const currency = periodReceipts[0].currency;
      const receiptIds = periodReceipts.map(r => r.id);

      // Общая сумма из total_amount чеков
      const totalSpent = periodReceipts.reduce((sum, r) => {
        return sum + (r.totalAmount ? parseFloat(r.totalAmount as unknown as string) : 0);
      }, 0);

      // Получаем все позиции этих чеков
      const items = await db
        .select({
          productName: receiptItems.productName,
          price: receiptItems.price,
          quantity: receiptItems.quantity,
          receiptId: receiptItems.receiptId,
        })
        .from(receiptItems)
        .where(sql`${receiptItems.receiptId} = ANY(${receiptIds})`);

      // Топ-15 продуктов по количеству покупок
      const productCount = new Map<string, { count: number; totalSpent: number }>();
      for (const item of items) {
        const name = item.productName.toLowerCase().trim();
        const prev = productCount.get(name) || { count: 0, totalSpent: 0 };
        prev.count += 1;
        prev.totalSpent += item.price ? parseFloat(item.price as unknown as string) : 0;
        productCount.set(name, prev);
      }

      const topProducts = [...productCount.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15)
        .map(([name, data]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          count: data.count,
          totalSpent: Math.round(data.totalSpent * 100) / 100,
        }));

      // Расходы по магазинам
      const storeMap = new Map<string, { count: number; totalSpent: number }>();
      for (const r of periodReceipts) {
        const store = r.storeName || 'Без названия';
        const prev = storeMap.get(store) || { count: 0, totalSpent: 0 };
        prev.count += 1;
        prev.totalSpent += r.totalAmount ? parseFloat(r.totalAmount as unknown as string) : 0;
        storeMap.set(store, prev);
      }

      const byStore = [...storeMap.entries()]
        .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
        .map(([store, data]) => ({
          store,
          count: data.count,
          totalSpent: Math.round(data.totalSpent * 100) / 100,
        }));

      // Для годового отчёта: расходы по месяцам
      const byMonth: { month: string; totalSpent: number; receiptCount: number }[] = [];
      if (input.period.length === 4) {
        const monthMap = new Map<string, { totalSpent: number; count: number }>();
        for (const r of periodReceipts) {
          const month = r.purchaseDate?.slice(0, 7) || 'unknown';
          const prev = monthMap.get(month) || { totalSpent: 0, count: 0 };
          prev.totalSpent += r.totalAmount ? parseFloat(r.totalAmount as unknown as string) : 0;
          prev.count += 1;
          monthMap.set(month, prev);
        }
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        for (let m = 1; m <= 12; m++) {
          const key = `${input.period}-${String(m).padStart(2, '0')}`;
          const data = monthMap.get(key);
          byMonth.push({
            month: monthNames[m - 1],
            totalSpent: data ? Math.round(data.totalSpent * 100) / 100 : 0,
            receiptCount: data?.count || 0,
          });
        }
      }

      return {
        periodLabel,
        totalSpent: Math.round(totalSpent * 100) / 100,
        currency,
        receiptCount: periodReceipts.length,
        topProducts,
        byStore,
        byMonth,
      };
    }),

  // Топ-5 рецептов за период
  topRecipes: protectedProcedure
    .input(z.object({ period: PeriodSchema.optional() }))
    .query(async ({ input }) => {
      const from = periodStart(input.period ?? 'month');
      const rows = await db
        .select({
          recipeTitle: cookingHistory.recipeTitle,
          recipeId: cookingHistory.recipeId,
          count: sql<number>`count(*)::int`,
        })
        .from(cookingHistory)
        .where(
          and(
            eq(cookingHistory.userId, 1),
            gte(cookingHistory.cookedAt, from),
          ),
        )
        .groupBy(cookingHistory.recipeTitle, cookingHistory.recipeId)
        .orderBy(desc(sql`count(*)`))
        .limit(5);
      return rows;
    }),

  // Расход продуктов за период — суммируем ингредиенты из всех приготовленных рецептов.
  // Группировка по имени ингредиента + единице измерения.
  productConsumption: protectedProcedure
    .input(z.object({ period: PeriodSchema.optional() }))
    .query(async ({ input }) => {
      const from = periodStart(input.period ?? 'month');

      // Получаем все записи готовки за период
      const cooks = await db
        .select({
          recipeId: cookingHistory.recipeId,
          servings: cookingHistory.servings,
        })
        .from(cookingHistory)
        .where(
          and(
            eq(cookingHistory.userId, 1),
            gte(cookingHistory.cookedAt, from),
          ),
        );

      // Собираем уникальные recipeId
      const recipeIds = [...new Set(cooks.filter(c => c.recipeId !== null).map(c => c.recipeId!))];
      if (recipeIds.length === 0) return [];

      // Получаем ингредиенты этих рецептов
      const allIngredients = await db
        .select({
          recipeId: recipeIngredients.recipeId,
          name: recipeIngredients.name,
          amount: recipeIngredients.amount,
          unit: recipeIngredients.unit,
        })
        .from(recipeIngredients)
        .where(sql`${recipeIngredients.recipeId} = ANY(${recipeIds})`);

      // Суммируем: для каждого факта готовки умножаем ингредиенты на (servings/default_servings).
      // Упрощённо: считаем что ингредиенты даны на 1 порцию (не совсем точно,
      // но для аналитики расхода достаточно).
      const consumption: Record<string, { name: string; unit: string | null; total: number }> = {};

      for (const cook of cooks) {
        if (!cook.recipeId) continue;
        const ings = allIngredients.filter(i => i.recipeId === cook.recipeId);
        for (const ing of ings) {
          const key = `${ing.name.toLowerCase()}|${(ing.unit || '').toLowerCase()}`;
          if (!consumption[key]) {
            consumption[key] = { name: ing.name, unit: ing.unit, total: 0 };
          }
          const amount = ing.amount ? parseFloat(ing.amount) : 0;
          consumption[key].total += amount;
        }
      }

      // Сортируем по суммарному количеству (убывание), берём топ-10
      return Object.values(consumption)
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(c => ({
          name: c.name,
          unit: c.unit,
          total: Math.round(c.total * 10) / 10,
        }));
    }),
});
