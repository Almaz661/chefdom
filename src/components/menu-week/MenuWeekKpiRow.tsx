import { UtensilsCrossed, Banknote, Clock, Flame } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

const KPI_DATA = [
  {
    icon: UtensilsCrossed,
    value: '21',
    label: 'Блюд на неделе',
    accent: '#e8b94a',
  },
  {
    icon: Banknote,
    value: '€6.21',
    label: 'Средняя стоимость',
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
    <div className="grid grid-cols-4 gap-4 shrink-0">
      {KPI_DATA.map(({ icon: Icon, value, label, accent }) => (
        <GlassCard key={label} className="px-5 py-5 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}15`, boxShadow: `0 0 16px ${accent}10` }}
          >
            <Icon size={22} style={{ color: accent }} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-xl leading-tight truncate">{value}</p>
            <p className="text-white/35 text-xs mt-0.5 truncate">{label}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
