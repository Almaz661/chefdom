import { UtensilsCrossed, Banknote, Clock, Flame } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

const KPI_DATA = [
  {
    icon: UtensilsCrossed,
    value: '21',
    label: 'Блюд',
    accent: '#e8b94a',
  },
  {
    icon: Banknote,
    value: '€6.21',
    label: 'Ср. стоимость',
    accent: '#4ade80',
  },
  {
    icon: Clock,
    value: '9ч 25м',
    label: 'Время на готовку',
    accent: '#60a5fa',
  },
  {
    icon: Flame,
    value: 'Сбалансировано',
    label: 'Пищевая ценность',
    accent: '#f472b6',
  },
];

export function MenuWeekKpiRow() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {KPI_DATA.map(({ icon: Icon, value, label, accent }) => (
        <GlassCard key={label} className="px-4 py-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}15`, boxShadow: `0 0 12px ${accent}10` }}
          >
            <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-base truncate">{value}</p>
            <p className="text-white/35 text-[11px] truncate">{label}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
