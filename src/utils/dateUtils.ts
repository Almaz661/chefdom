/**
 * Общие утилиты для работы с датами.
 * Выведены из дублированного кода в InventoryPage, PreservesPage,
 * InventoryAllExpiry, InventoryExpiringSection, InventoryProductCard.
 */

/**
 * Возвращает количество дней до истечения срока годности.
 * Отрицательное значение = уже истёк.
 * null = срок не указан.
 */
export function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate + 'T00:00:00');
  return Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Возвращает цвет и текст статуса срока годности.
 */
export function expiryStatus(days: number | null): {
  color: string;
  label: string;
} {
  if (days === null) return { color: 'text-white/30', label: 'Срок не указан' };
  if (days < 0) return { color: 'text-red-400', label: `Истёк ${Math.abs(days)} дн. назад` };
  if (days === 0) return { color: 'text-red-400', label: 'Истекает сегодня' };
  if (days === 1) return { color: 'text-orange-400', label: 'Истекает завтра' };
  if (days <= 3) return { color: 'text-yellow-400', label: `${days} дн.` };
  if (days <= 7) return { color: 'text-white/60', label: `${days} дн.` };
  return { color: 'text-white/40', label: `${days} дн.` };
}
