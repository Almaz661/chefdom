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
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="7"
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 4px ${seg.color}40)` }}
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
            <div key={seg.label} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shadow-[0_0_6px]" style={{ backgroundColor: seg.color, boxShadow: `0 0 8px ${seg.color}50` }} />
              <span className="text-[12px] text-white/50 flex-1">{seg.label}</span>
              <span className="text-[12px] text-white/75 font-bold">{seg.percent}%</span>
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
    <GlassCard className="p-7">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#c9953c]/15 flex items-center justify-center">
            <ShoppingCart size={14} className="text-[#e8b94a]" />
          </div>
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Покупки</h3>
        </div>
        <span className="text-[11px] text-[#e8b94a]/60 font-semibold">{unchecked} позиций</span>
      </div>
      <ul className="space-y-2.5">
        {SHOPPING_ITEMS.map((item) => (
          <li key={item.name} className="flex items-center gap-3 py-1">
            <div className={`w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all ${
              item.checked
                ? 'bg-[#c9953c]/25 border-[#c9953c]/60'
                : 'border-white/20 hover:border-[#c9953c]/40'
            }`}>
              {item.checked && (
                <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="#e8b94a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-[12px] flex-1 ${item.checked ? 'text-white/25 line-through' : 'text-white/65'}`}>
              {item.name}
            </span>
            <span className="text-[11px] text-white/30 font-medium">{item.qty}</span>
          </li>
        ))}
      </ul>
      <button className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/[0.08] text-[11px] text-white/35 hover:text-[#e8b94a] hover:border-[#c9953c]/30 hover:bg-[#c9953c]/[0.03] transition-all duration-200">
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
    <GlassCard className="p-7">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[#c9953c]/15 flex items-center justify-center">
          <Lightbulb size={14} className="text-[#e8b94a]" />
        </div>
        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Советы</h3>
      </div>
      <ul className="space-y-3.5">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#e8b94a]/60 mt-2 shrink-0 shadow-[0_0_4px_rgba(232,185,74,0.4)]" />
            <p className="text-[12px] text-white/50 leading-relaxed">{tip}</p>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

// ─── Любимые блюда ───

const FAVORITES = [
  { name: 'Паста Карбонара', time: '25 мин', photo: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=100&h=100&fit=crop' },
  { name: 'Стейк Рибай', time: '20 мин', photo: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=100&h=100&fit=crop' },
  { name: 'Тирамису', time: '40 мин', photo: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=100&h=100&fit=crop' },
];

function WeekFavorites() {
  return (
    <GlassCard className="p-7">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[#c9953c]/15 flex items-center justify-center">
          <Heart size={14} className="text-[#e8b94a]" />
        </div>
        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Любимые блюда</h3>
      </div>
      <ul className="space-y-3">
        {FAVORITES.map((fav) => (
          <li key={fav.name} className="flex items-center gap-4 py-2 rounded-xl hover:bg-white/[0.03] transition-all duration-200 cursor-pointer px-2 -mx-2">
            <img
              src={fav.photo}
              alt={fav.name}
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/70 font-semibold truncate">{fav.name}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{fav.time}</p>
            </div>
            <button className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/20 hover:text-[#e8b94a] hover:border-[#c9953c]/30 hover:bg-[#c9953c]/5 transition-all duration-200">
              <Plus size={13} />
            </button>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

// ─── Правая панель ───

export function MenuWeekRightPanel() {
  return (
    <aside className="w-[360px] min-w-[360px] max-w-[360px] h-full flex flex-col gap-5 overflow-y-auto">
      <WeekSummaryChart />
      <WeekShoppingList />
      <WeekTips />
      <WeekFavorites />
    </aside>
  );
}
