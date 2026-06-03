import {
  Home,
  Refrigerator,
  Snowflake,
  Package,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  FlaskConical,
  BarChart3,
  Calendar,
  StickyNote,
  Crown,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: Home, label: 'Главная', href: '/' },
  { icon: Refrigerator, label: 'Холодильник', href: '/inventory' },
  { icon: Snowflake, label: 'Морозилка', href: '/inventory' },
  { icon: Package, label: 'Кладовая', href: '/inventory' },
  { icon: BookOpen, label: 'Рецепты', href: '/recipes' },
  { icon: CalendarDays, label: 'Меню недели', href: '/menu', active: true },
  { icon: ShoppingCart, label: 'Покупки', href: '/shopping' },
  { icon: FlaskConical, label: 'Заготовки', href: '/preserves' },
  { icon: BarChart3, label: 'Аналитика', href: '/analytics' },
  { icon: Calendar, label: 'Календарь', href: '/history' },
  { icon: StickyNote, label: 'Заметки', href: '#' },
];

export function AppSidebar() {
  return (
    <aside className="w-[280px] h-full flex flex-col rounded-[16px] border border-white/[0.04] bg-[#0a0e1a]/80 backdrop-blur-2xl overflow-hidden">
      {/* Logo */}
      <div className="px-6 pt-7 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c9953c] to-[#e8b94a] flex items-center justify-center shadow-[0_4px_12px_rgba(201,149,60,0.35)]">
            <span className="text-[#0a0c10] text-lg font-bold">Ш</span>
          </div>
          <div>
            <p className="text-white font-bold text-base tracking-tight">ШефДом</p>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Kitchen OS</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
            <li key={label}>
              <button
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  active
                    ? 'bg-[#c9953c]/10 text-[#e8b94a] border border-[#c9953c]/20 shadow-[0_2px_8px_rgba(201,149,60,0.1)]'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]'
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={1.6}
                  className={active ? 'text-[#e8b94a]' : 'text-white/40 group-hover:text-white/60'}
                />
                <span className="flex-1 text-left">{label}</span>
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e8b94a] shadow-[0_0_6px_rgba(232,185,74,0.6)]" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* User Card */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1a2a4a] to-[#0f1a30] border border-white/[0.08] flex items-center justify-center">
            <span className="text-white/70 text-xs font-bold">О</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-sm font-medium truncate">Ольга</p>
            <p className="text-white/30 text-[11px]">Домашний шеф</p>
          </div>
          <ChevronRight size={14} className="text-white/20" />
        </div>
      </div>

      {/* Premium Card */}
      <div className="px-4 pb-5">
        <div className="relative overflow-hidden rounded-xl border border-[#c9953c]/20 bg-gradient-to-br from-[#c9953c]/10 via-[#0c1021] to-[#c9953c]/5 p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#c9953c]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-2 mb-2">
            <Crown size={14} className="text-[#e8b94a]" />
            <span className="text-[#e8b94a] text-xs font-bold uppercase tracking-wider">Premium</span>
          </div>
          <p className="text-white/50 text-[11px] leading-relaxed">
            Автоплан меню, AI-рекомендации, расширенная аналитика
          </p>
        </div>
      </div>
    </aside>
  );
}
