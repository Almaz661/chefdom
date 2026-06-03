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
    <div className="flex gap-1 p-1 rounded-2xl border border-white/[0.06] bg-[#080c18]/60 backdrop-blur-sm shrink-0">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
            active === key
              ? 'bg-gradient-to-r from-[#c9953c]/20 to-[#e8b94a]/10 text-[#e8b94a] border border-[#c9953c]/30 shadow-[0_0_12px_rgba(201,149,60,0.15)]'
              : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
          }`}
        >
          <Icon size={15} strokeWidth={1.7} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
