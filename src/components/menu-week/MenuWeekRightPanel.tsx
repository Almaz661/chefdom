import { ShoppingCart, Lightbulb, Heart, ChevronRight } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

// ─── Круговая диаграмма итогов недели ───

function WeekSummaryChart() {
  // SVG donut chart — БЖУ баланс
  const segments = [
    { label: 'Белки', percent: 28, color: '#e8b94a' },
    { label: 'Жиры', percent: 32, color: '#60a5fa' },
    { label: 'Углеводы', percent: 40, color: '#4ade80' },
  ];

  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <GlassCard className="p-5">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Итоги недели</h3>
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {segments.map((seg) => {
              const dashLength = (seg.percent / 100) * circumference;
              const dashOffset = -(offset / 100) * circumference;
              offset += seg.percent;
              return (
                <circle
                  key={seg.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="8"
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="opacity-80"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white font-bold text-sm">2 150</span>
            <span className="text-white/30 text-[9px]">kcal/день</span>
          </div>
        </div>
        {/* Legend */}
        <div className="space-y-2">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-[11px] text-white/50">{seg.label}</span>
              <span className="text-[11px] text-white/70 font-medium ml-auto">{seg.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Список покупок ───

const SHOPPING_ITEMS = [
  { name: 'Лосось филе', qty: '500 г', checked: false },
  { name: 'Сливки 33%', qty: '200 мл', checked: false },
  { name: 'Шпинат', qty: '150 г', checked: true },
  { name: 'Рис басмати', qty: '400 г', checked: false },
  { name: 'Куриное филе', qty: '600 г', checked: false },
  { name: 'Авокадо', qty: '2 шт', checked: true },
];

function WeekShoppingList() {
  const unchecked = SHOPPING_ITEMS.filter(i => !i.checked).length;
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart size={14} className="text-[#e8b94a]" />
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Покупки</h3>
        </div>
        <span className="text-[10px] text-white/30 font-medium">{unchecked} позиций</span>
      </div>
      <ul className="space-y-1.5">
        {SHOPPING_ITEMS.map((item) => (
          <li key={item.name} className="flex items-center gap-2.5 py-1">
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
              item.checked
                ? 'bg-[#c9953c]/20 border-[#c9953c]/40'
                : 'border-white/15 hover:border-[#c9953c]/30'
            }`}>
              {item.checked && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="#e8b94a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-[11px] flex-1 ${item.checked ? 'text-white/25 line-through' : 'text-white/60'}`}>
              {item.name}
            </span>
            <span className="text-[10px] text-white/25">{item.qty}</span>
          </li>
        ))}
      </ul>
      <button className="mt-3 w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-white/[0.05] text-[11px] text-white/30 hover:text-[#e8b94a] hover:border-[#c9953c]/20 transition-colors">
        Открыть все <ChevronRight size={12} />
      </button>
    </GlassCard>
  );
}

// ─── Советы на неделю ───

const TIPS = [
  'Используйте шпинат до среды — истекает через 2 дня',
  'Курицу можно заменить индейкой для разнообразия',
  'Бульон от борща заморозьте на следующую неделю',
];

function WeekTips() {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={14} className="text-[#e8b94a]" />
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Советы</h3>
      </div>
      <ul className="space-y-2.5">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex gap-2">
            <div className="w-1 h-1 rounded-full bg-[#c9953c]/50 mt-1.5 shrink-0" />
            <p className="text-[11px] text-white/45 leading-relaxed">{tip}</p>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

// ─── Любимые блюда ───

const FAVORITES = [
  { name: 'Паста Карбонара', time: '25 мин', photo: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=80&h=80&fit=crop' },
  { name: 'Стейк Рибай', time: '20 мин', photo: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=80&h=80&fit=crop' },
  { name: 'Тирамису', time: '40 мин', photo: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=80&h=80&fit=crop' },
];

function WeekFavorites() {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Heart size={14} className="text-[#e8b94a]" />
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Любимые блюда</h3>
      </div>
      <ul className="space-y-2">
        {FAVORITES.map((fav) => (
          <li key={fav.name} className="flex items-center gap-3 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer px-1 -mx-1">
            <img
              src={fav.photo}
              alt={fav.name}
              className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/[0.05]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/60 font-medium truncate">{fav.name}</p>
              <p className="text-[9px] text-white/25">{fav.time}</p>
            </div>
            <button className="text-white/15 hover:text-[#e8b94a] transition-colors">
              <Plus size={12} />
            </button>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

// ─── Для импорта Plus в WeekFavorites ───
import { Plus } from 'lucide-react';

// ─── Экспорт правой панели ───

export function MenuWeekRightPanel() {
  return (
    <aside className="w-[360px] h-full flex flex-col gap-4 overflow-y-auto pr-1">
      <WeekSummaryChart />
      <WeekShoppingList />
      <WeekTips />
      <WeekFavorites />
    </aside>
  );
}
