import { AlertTriangle, Trash2, Snowflake } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { getProductImageSrc } from '../../utils/productImages';

export type ViewItem = {
  id: number;
  source: 'inventory' | 'preserve';
  productName: string;
  quantity: string | null;
  unit: string | null;
  expiryDate: string | null;
  category: string | null;
  minQuantity: string | null;
  isBasic: boolean;
};

const EXPIRY_PERIODS = [
  { key: 3, label: '3 дня' },
  { key: 7, label: '7 дней' },
  { key: 14, label: '14 дней' },
  { key: 30, label: '30 дней' },
] as const;

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
  return `через ${days} дн.`;
}

export function InventoryExpiringSection({
  items,
  expiryPeriod,
  onExpiryPeriodChange,
  onRemove,
}: {
  items: ViewItem[];
  expiryPeriod: number;
  onExpiryPeriodChange: (period: number) => void;
  onRemove: (item: ViewItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-[#f97316] uppercase tracking-wider flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#f97316]/15 flex items-center justify-center">
            <AlertTriangle size={14} className="text-[#f97316]" />
          </div>
          Истекает в ближайшие
        </h3>
        <div className="flex gap-1">
          {EXPIRY_PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onExpiryPeriodChange(key)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                expiryPeriod === key
                  ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/30'
                  : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const days = daysUntilExpiry(item.expiryDate);
          const isExpired = days !== null && days < 0;
          const imgSrc = getProductImageSrc(item.productName, item.category);

          return (
            <li
              key={`${item.source}-${item.id}`}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-200 ${
                isExpired
                  ? 'bg-red-500/[0.06] border-red-500/20'
                  : 'bg-[#f97316]/[0.04] border-[#f97316]/15'
              }`}
            >
              <img
                src={imgSrc}
                alt={item.productName}
                width={48}
                height={48}
                className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/[0.06]"
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">
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
                <p className={`text-xs mt-0.5 ${isExpired ? 'text-red-400' : 'text-[#f97316]/80'}`}>
                  {expiryText(item.expiryDate)}
                  {item.expiryDate && (
                    <span className="text-white/25 ml-1">
                      ({new Date(item.expiryDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })})
                    </span>
                  )}
                  {item.source === 'preserve' && (
                    <span className="text-white/25"> · из заготовок</span>
                  )}
                </p>
              </div>

              <button
                onClick={() => onRemove(item)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 shrink-0"
                aria-label="Удалить"
              >
                <Trash2 size={15} />
              </button>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}
