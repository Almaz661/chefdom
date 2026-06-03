import { Search, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { GoldButton } from '../ui/GoldButton';

export function MenuWeekHeader() {
  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">Меню недели</h1>
          <p className="text-white/40 text-sm mt-0.5">Планируйте питание, экономьте время и продукты</p>
        </div>
        <div className="flex items-center gap-2">
          <GoldButton variant="outline" className="text-xs px-3 py-2">
            Сегодня
          </GoldButton>
          <GoldButton className="text-xs px-3 py-2">
            <Sparkles size={14} />
            Автоплан
          </GoldButton>
        </div>
      </div>

      {/* Search + Date range row */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder="Поиск блюд, ингредиентов..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-white/[0.06] bg-[#0c1021]/60 backdrop-blur-sm text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#c9953c]/40 transition-colors"
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/[0.06] bg-[#0c1021]/60 backdrop-blur-sm">
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-white/70 font-medium px-2 min-w-[160px] text-center">
            2 — 8 июня, 2026
          </span>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
