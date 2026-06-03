import { Trash2, Snowflake } from 'lucide-react';
import { getProductImageSrc } from '../../utils/productImages';
import type { ViewItem } from './InventoryExpiringSection';

function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate + 'T00:00:00');
  return Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryText(expiryDate: string | null): string {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return '';
  if (days < 0) return 'просрочен';
  if (days === 0) return 'истекает сегодня';
  if (days === 1) return 'истекает завтра';
  if (days <= 30) return `через ${days} дн.`;
  return `ещё ${days} дн.`;
}

export function InventoryProductCard({
  item,
  onRemove,
  onToggleBasic,
}: {
  item: ViewItem;
  onRemove: () => void;
  onToggleBasic?: () => void;
}) {
  const imgSrc = getProductImageSrc(item.productName, item.category);

  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-200 group">
      {/* Category image — Kitchen Atelier */}
      <img
        src={imgSrc}
        alt={item.productName}
        width={48}
        height={48}
        className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/[0.06]"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 truncate">
          {item.isBasic && (
            <span className="text-[#e8b94a]/70 mr-1 text-xs" title="Базовый продукт — не попадает в покупки">📌</span>
          )}
          {item.source === 'preserve' && (
            <Snowflake size={12} className="inline-block mr-1 text-blue-400 align-text-bottom" />
          )}
          {item.productName}
          {item.quantity && (
            <span className="text-white/30 ml-1.5 text-xs">
              {item.quantity}{item.unit ? ` ${item.unit}` : ''}
            </span>
          )}
          {item.minQuantity && (
            <span className="text-[#e8b94a]/60 ml-1.5 text-xs" title="Мин. остаток для авто-докупки">
              (мин: {item.minQuantity})
            </span>
          )}
        </p>
        {item.expiryDate && (
          <p className="text-xs text-white/30 mt-0.5">{expiryText(item.expiryDate)}</p>
        )}
      </div>

      {/* Basic toggle */}
      {item.source === 'inventory' && onToggleBasic && (
        <button
          onClick={onToggleBasic}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 shrink-0 ${
            item.isBasic
              ? 'text-[#e8b94a] bg-[#e8b94a]/10 border border-[#c9953c]/20'
              : 'text-white/20 hover:text-[#e8b94a] hover:bg-[#e8b94a]/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
          title={item.isBasic ? 'Убрать из базовых' : 'Пометить как базовый (не попадает в покупки)'}
          aria-label="Базовый продукт"
        >
          📌
        </button>
      )}

      {/* Delete */}
      <button
        onClick={onRemove}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Удалить"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
