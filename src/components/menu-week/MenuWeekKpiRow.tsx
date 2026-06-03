import { UtensilsCrossed, Banknote, Clock, Flame } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

const KPI_DATA = [
  { icon: UtensilsCrossed, value: '21', label: 'Блюд на неделе', accent: '#e8b94a' },
  { icon: Banknote, value: '€6.21', label: 'Средняя стоимость', accent: '#4ade80' },
  { icon: Clock, value: '9ч 25м', label: 'Время на готовку', accent: '#60a5fa' },
  { icon: Flame, value: 'Сбалансировано', label: 'Пищевая ценность', accent: '#f472b6' },
];

export function MenuWeekKpiRow() {
  return (
    <div className="grid grid-cols-4 gap-4 shrink-0">
      {KPI_DATA.map(({ icon: Icon, value, label, accent }) => (
        <GlassCard key={label} className="px-5 py-5 flex items-center gap-4 hover:border-white/[0.12] transition-all duration-200">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}18`, boxShadow: `0 0 20px ${accent}15` }}
          >
            <Icon size={22} style={{ color: accent }} strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-xl leading-tight truncate">{value}</p>
            <p className="text-white/40 text-[11px] mt-0.5 truncate">{label}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
