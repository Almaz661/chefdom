import { Search, ChevronLeft, ChevronRight, Sparkles, ShoppingCart } from 'lucide-react';
import { GoldButton } from '../ui/GoldButton';

export function MenuWeekHeader({
  weekLabel,
  onPrev,
  onNext,
  onToday,
  onToShopping,
  toShoppingPending,
  hasMeals,
}: {
  weekLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToShopping: () => void;
  toShoppingPending: boolean;
  hasMeals: boolean;
}) {
  return (
    <div className="space-y-4 shrink-0">
      {/* Title row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-extrabold text-white tracking-tight">Меню недели</h1>
          <p className="text-white/40 text-base font-medium mt-0.5">Планируйте питание, экономьте время и продукты</p>
        </div>
        <div className="flex items-center gap-2">
          <GoldButton variant="outline" className="text-sm font-bold px-4 py-2.5" onClick={onToday}>
            Сегодня
          </GoldButton>
          {hasMeals && (
            <GoldButton
              className="text-sm font-bold px-4 py-2.5"
              onClick={onToShopping}
            >
              <ShoppingCart size={16} />
              {toShoppingPending ? 'Добавляю...' : 'В покупки'}
            </GoldButton>
          )}
        </div>
      </div>

      {/* Date range row */}
      <div className="flex items-center gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/[0.06] bg-[#0c1021]/60 backdrop-blur-sm">
          <button
            onClick={onPrev}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-base text-white/70 font-bold px-2 min-w-[200px] text-center">
            {weekLabel}
          </span>
          <button
            onClick={onNext}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
