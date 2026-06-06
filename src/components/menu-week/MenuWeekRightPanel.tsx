import { ShoppingCart, Lightbulb, Heart, ChevronRight, Plus } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { trpc } from '../../utils/trpc';

// ─── Круговая диаграмма итогов недели ───

function WeekSummaryChart({ totalMeals }: { totalMeals: number }) {
  const segments = [
    { label: 'Белки', percent: 28, color: '#c9a84c' },
    { label: 'Жиры', percent: 32, color: '#60a5fa' },
    { label: 'Углеводы', percent: 40, color: '#4ade80' },
  ];

  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <GlassCard className="p-7">
      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-5">Итоги недели</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {segments.map((seg) => {
              const dashLength = (seg.percent / 100) * circumference;
              const dashOffset = -(offset / 100) * circumference;
              offset += seg.percent;
              return (
                <circle
                  key={seg.label}
                  cx="50" cy="50" r={radius}
                  fill="none" stroke={seg.color} strokeWidth="7"
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset} strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 4px ${seg.color}40)` }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white font-bold text-lg">{totalMeals}</span>
            <span className="text-white/30 text-[10px]">блюд</span>
          </div>
        </div>
        <div className="space-y-3 flex-1">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color, boxShadow: `0 0 8px ${seg.color}50` }} />
              <span className="text-[12px] text-white/50 flex-1">{seg.label}</span>
              <span className="text-[12px] text-white/75 font-bold">{seg.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Список покупок (реальные данные) ───

function WeekShoppingList() {
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery();
  const unchecked = shoppingItems.filter((i: any) => !i.isChecked).length;
  const displayItems = shoppingItems.slice(0, 6);

  return (
    <GlassCard className="p-7">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#c9a84c]/15 flex items-center justify-center">
            <ShoppingCart size={14} className="text-[#c9a84c]" />
          </div>
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Покупки</h3>
        </div>
        <span className="text-[11px] text-[#c9a84c]/60 font-semibold">{unchecked} позиций</span>
      </div>
      {displayItems.length === 0 ? (
        <p className="text-[11px] text-white/30 text-center py-3">Список пуст</p>
      ) : (
        <ul className="space-y-2.5">
          {displayItems.map((item: any) => (
            <li key={item.id} className="flex items-center gap-3 py-1">
              <div className={`w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 ${
                item.isChecked ? 'bg-[#c9a84c]/25 border-[#c9a84c]/60' : 'border-white/20'
              }`}>
                {item.isChecked && (
                  <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="#c9a84c" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className={`text-[12px] flex-1 ${item.isChecked ? 'text-white/25 line-through' : 'text-white/65'}`}>
                {item.productName}
              </span>
              {item.quantity && (
                <span className="text-[11px] text-white/30">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <a href="/shopping" className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/[0.08] text-[11px] text-white/35 hover:text-[#c9a84c] hover:border-[#c9a84c]/30 transition-all duration-200">
        Открыть все <ChevronRight size={13} />
      </a>
    </GlassCard>
  );
}

// ─── Советы ───

function WeekTips() {
  const TIPS = [
    'Используйте истекающие продукты в первую очередь',
    'Добавьте разнообразия — попробуйте новый рецепт',
    'Заморозьте остатки бульона на следующую неделю',
  ];
  return (
    <GlassCard className="p-7">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[#c9a84c]/15 flex items-center justify-center">
          <Lightbulb size={14} className="text-[#c9a84c]" />
        </div>
        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Советы</h3>
      </div>
      <ul className="space-y-3.5">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]/60 mt-2 shrink-0 shadow-[0_0_4px_rgba(232,185,74,0.4)]" />
            <p className="text-[12px] text-white/50 leading-relaxed">{tip}</p>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

// ─── Правая панель ───

export function MenuWeekRightPanel({ totalMeals }: { totalMeals: number }) {
  return (
    <aside className="w-[360px] min-w-[360px] max-w-[360px] h-full flex flex-col gap-5 overflow-y-auto">
      <WeekSummaryChart totalMeals={totalMeals} />
      <WeekShoppingList />
      <WeekTips />
    </aside>
  );
}
