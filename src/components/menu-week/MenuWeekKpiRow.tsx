import { UtensilsCrossed, Clock, Flame } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

export function MenuWeekKpiRow({
  totalMeals,
  totalTime,
}: {
  totalMeals: number;
  totalTime: string;
}) {
  const KPI_DATA = [
    { icon: UtensilsCrossed, value: String(totalMeals), label: 'Блюд на неделе', accent: '#c9a84c' },
    { icon: Clock, value: totalTime || '—', label: 'Время на готовку', accent: '#60a5fa' },
    { icon: Flame, value: totalMeals > 14 ? 'Сбалансировано' : totalMeals > 0 ? 'Частично' : '—', label: 'Пищевая ценность', accent: '#f472b6' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 shrink-0">
      {KPI_DATA.map(({ icon: Icon, value, label, accent }) => (
        <GlassCard key={label} className="px-5 py-6 flex items-center gap-4 hover:border-white/[0.14] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-200">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}20`, boxShadow: `0 0 24px ${accent}20` }}
          >
            <Icon size={28} style={{ color: accent }} strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-extrabold text-3xl leading-tight truncate">{value}</p>
            <p className="text-white/40 text-sm font-semibold mt-0.5 truncate">{label}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
