import { Refrigerator, Snowflake, Package } from 'lucide-react';

const TABS = [
  { key: 'fridge' as const, label: 'Холодильник', icon: Refrigerator },
  { key: 'freezer' as const, label: 'Морозилка', icon: Snowflake },
  { key: 'pantry' as const, label: 'Кладовая', icon: Package },
];

export function InventoryTabs({
  active,
  onChange,
}: {
  active: 'fridge' | 'freezer' | 'pantry';
  onChange: (tab: 'fridge' | 'freezer' | 'pantry') => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl border border-[var(--color-line)] bg-[var(--color-cream)]/60 shrink-0">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
            active === key
              ? 'bg-gradient-to-r from-[var(--color-primary)]/20 to-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-[0_0_12px_rgba(201,149,60,0.15)]'
              : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
          }`}
        >
          <Icon size={18} strokeWidth={1.7} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
