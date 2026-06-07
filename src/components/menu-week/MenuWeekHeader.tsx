import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';

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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      {/* Title */}
      <div>
        <h1 className="font-serif text-3xl text-white font-semibold">Меню недели</h1>
        <p className="text-white/50 text-sm mt-1">Планируйте питание, экономьте время и продукты</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Week navigation */}
        <div className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[var(--cd-line)] bg-white/[0.03]">
          <button
            onClick={onPrev}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-white/70 font-semibold px-2 min-w-[190px] text-center">
            {weekLabel}
          </span>
          <button
            onClick={onNext}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Today */}
        <button
          onClick={onToday}
          className="px-4 py-2 rounded-xl bg-white/[0.04] border border-[var(--cd-line)] text-white/60 text-sm font-semibold hover:border-white/[0.15] hover:text-white/80 transition-all duration-200"
        >
          Сегодня
        </button>

        {/* To shopping */}
        {hasMeals && (
          <button
            onClick={onToShopping}
            disabled={toShoppingPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--cd-gold)] text-[#0a0c10] text-sm font-semibold hover:bg-[var(--cd-gold-dark)] transition-colors disabled:opacity-60"
          >
            <ShoppingCart size={15} />
            {toShoppingPending ? 'Добавляю...' : 'В покупки'}
          </button>
        )}
      </div>
    </div>
  );
}
