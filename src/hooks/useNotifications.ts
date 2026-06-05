import { trpc } from '../utils/trpc';

/**
 * Централизованный хук для счётчиков уведомлений.
 * Используется в Layout (badge на иконках) и Dashboard (алерты).
 */
export function useNotifications() {
  // Истекающие продукты инвентаря (3 дня)
  const { data: expiring = [] } = trpc.inventory.getExpiring.useQuery(
    { days: 3 },
    { refetchInterval: 5 * 60 * 1000 }, // обновляем каждые 5 минут
  );

  // Истекающие заготовки (3 дня)
  const { data: allPreserves = [] } = trpc.preserves.list.useQuery(
    undefined,
    { refetchInterval: 5 * 60 * 1000 },
  );
  const expiringPreserves = allPreserves.filter((p) => {
    if (!p.expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(p.expiryDate + 'T00:00:00');
    const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 3;
  });

  // Продукты ниже минимума
  const { data: allInventory = [] } = trpc.inventory.list.useQuery(
    undefined,
    { refetchInterval: 5 * 60 * 1000 },
  );
  const belowMin = allInventory.filter((i) => {
    if (!i.minQuantity) return false;
    const qty = i.quantity ? parseFloat(i.quantity) : 0;
    const min = parseFloat(i.minQuantity);
    return !isNaN(min) && min > 0 && qty < min;
  });

  // Непрочитанные покупки
  const { data: shopping = [] } = trpc.shopping.list.useQuery(
    undefined,
    { refetchInterval: 5 * 60 * 1000 },
  );
  const pendingShopping = shopping.filter((s) => s.isChecked === 0).length;

  const expiringTotal = expiring.length + expiringPreserves.length;

  return {
    // Для badge на иконках
    inventoryBadge: expiringTotal + belowMin.length,
    shoppingBadge: pendingShopping,
    // Детали для Dashboard
    expiring,
    expiringPreserves,
    expiringTotal,
    belowMin,
    expiringNames: [
      ...expiring.map((e) => e.productName),
      ...expiringPreserves.map((p) => p.name),
    ],
  };
}
