import { UtensilsCrossed, Clock } from 'lucide-react';

export function MenuWeekKpiRow({
  totalMeals,
  totalTime,
}: {
  totalMeals: number;
  totalTime: string;
}) {
  const KPI_DATA = [
    {
      icon: UtensilsCrossed,
      value: String(totalMeals),
      label: 'Блюд на неделе',
      accent: '#c9a84c',
    },
    {
      icon: Clock,
      value: totalTime || '—',
      label: 'Время на готовку',
      accent: '#60a5fa',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {KPI_DATA.map(({ icon: Icon, value, label, accent }) => (
        <div
          key={label}
          className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4 hover:border-white/[0.10] hover:bg-white/[0.05] transition-all duration-200"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}18` }}
          >
            <Icon size={22} style={{ color: accent }} strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-extrabold text-2xl leading-tight">{value}</p>
            <p className="text-white/50 text-xs font-medium mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
