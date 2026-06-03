import { ShoppingCart, Lightbulb, Heart, ChevronRight, Plus } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

// ─── Круговая диаграмма итогов недели ───

function WeekSummaryChart() {
  const segments = [
    { label: 'Белки', percent: 28, color: '#e8b94a' },
    { label: 'Жиры', percent: 32, color: '#60a5fa' },
    { label: 'Углеводы', percent: 40, color: '#4ade80' },
  ];

  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <GlassCard className="p-6">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-5">Итоги недели</h3>
      <div className="flex items-center gap-5">
        <div className="relative w-28 h-28 shrink-0">
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
                  strokeWidth="7"
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="opacity-80"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white font-bold text-lg">2 150</span>
            <span className="text-white/30 text-[10px]">kcal/день</span>
          </div>
        </div>
        <div className="space-y-3 flex-1">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-white/50 flex-1">{seg.label}</span>
              <span className="text-xs text-white/70 font-semibold">{seg.percent}%</span>
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
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <ShoppingCart size={15} className="text-[#e8b94a]" />
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Покупки</h3>
        </div>
        <span className="text-[11px] text-white/30 font-medium">{unchecked} позиций</span>
      </div>
      <ul className="space-y-2">
        {SHOPPING_ITEMS.map((item) => (
          <li key={item.name} className="flex items-center gap-3 py-1.5">
            <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
              item.checked
                ? 'bg-[#c9953c]/20 border-[#c9953c]/50'
                : 'border-white/15 hover:border-[#c9953c]/30'
            }`}>
              {item.checked && (
                <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="#e8b94a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-xs flex-1 ${item.checked ? 'text-white/25 line-through' : 'text-white/60'}`}>
              {item.name}
            </span>
            <span className="text-[11px] text-white/25">{item.qty}</span>
          </li>
        ))}
      </ul>
      <button className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/[0.06] text-xs text-white/30 hover:text-[#e8b94a] hover:border-[#c9953c]/20 transition-colors">
        Открыть все <ChevronRight size={13} />
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
    <GlassCard className="p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Lightbulb size={15} className="text-[#e8b94a]" />
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Советы</h3>
      </div>
      <ul className="space-y-3">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#c9953c]/50 mt-1.5 shrink-0" />
            <p className="text-xs text-white/45 leading-relaxed">{tip}</p>
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
    <GlassCard className="p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Heart size={15} className="text-[#e8b94a]" />
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Любимые блюда</h3>
      </div>
      <ul className="space-y-2.5">
        {FAVORITES.map((fav) => (
          <li key={fav.name} className="flex items-center gap-3.5 py-2 rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer px-2 -mx-2">
            <img
              src={fav.photo}
              alt={fav.name}
              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/[0.06]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/65 font-semibold truncate">{fav.name}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{fav.time}</p>
            </div>
            <button className="w-7 h-7 rounded-lg border border-white/[0.06] flex items-center justify-center text-white/15 hover:text-[#e8b94a] hover:border-[#c9953c]/30 transition-colors">
              <Plus size={12} />
            </button>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

// ─── Экспорт правой панели ───

export function MenuWeekRightPanel() {
  return (
    <aside className="w-[360px] min-w-[360px] max-w-[360px] h-full flex flex-col gap-4 overflow-y-auto">
      <WeekSummaryChart />
      <WeekShoppingList />
      <WeekTips />
      <WeekFavorites />
    </aside>
  );
}
