import { ChevronDown, ChevronUp } from 'lucide-react';
import { daysUntilExpiry } from '../../utils/dateUtils';
import { GlassCard } from '../ui/GlassCard';
import type { ViewItem } from './InventoryExpiringSection';


function expiryText(expiryDate: string | null): string {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return '';
  if (days < 0) return 'просрочен';
  if (days === 0) return 'истекает сегодня';
  if (days === 1) return 'истекает завтра';
  return `через ${days} дн.`;
}

export function InventoryAllExpiry({
  items,
  expiryPeriod,
  isOpen,
  onToggle,
}: {
  items: ViewItem[];
  expiryPeriod: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="shrink-0">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all duration-200 ${
          isOpen
            ? 'border-[#c9a84c]/30 bg-[#c9a84c]/[0.06] text-[#c9a84c]'
            : 'border-white/[0.06] bg-[#080c18]/60 text-white/50 hover:text-[#c9a84c] hover:border-[#c9a84c]/20'
        }`}
      >
        <span className="text-base font-bold">
          📋 Все сроки годности ({items.length})
        </span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <GlassCard className="mt-2 p-4 max-h-[300px] overflow-y-auto">
          <ul className="space-y-1.5">
            {items.map((item) => {
              const days = daysUntilExpiry(item.expiryDate);
              const isExpired = days !== null && days < 0;
              const isSoon = days !== null && days <= expiryPeriod;

              return (
                <li
                  key={`exp-${item.source}-${item.id}`}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border transition-all duration-200 ${
                    isExpired
                      ? 'bg-red-500/[0.05] border-red-500/15'
                      : isSoon
                      ? 'bg-[#f97316]/[0.04] border-[#f97316]/15'
                      : 'bg-white/[0.02] border-white/[0.04]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isExpired
                        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'
                        : isSoon
                        ? 'bg-[#f97316] shadow-[0_0_6px_rgba(249,115,22,0.5)]'
                        : 'bg-[#c9a84c]/40'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-white/70 truncate">
                      {item.productName}
                      {item.quantity && (
                        <span className="text-white/30 ml-1.5 text-sm font-normal">
                          {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${
                      isExpired ? 'text-red-400' : isSoon ? 'text-[#f97316]' : 'text-white/40'
                    }`}>
                      {item.expiryDate && new Date(item.expiryDate).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    <p className={`text-xs font-medium ${
                      isExpired ? 'text-red-400/70' : isSoon ? 'text-[#f97316]/70' : 'text-white/25'
                    }`}>
                      {expiryText(item.expiryDate)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
