import { ShoppingCart, CheckCircle2, Circle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

export function ShoppingKpiRow({
  total,
  checked,
  remaining,
}: {
  total: number;
  checked: number;
  remaining: number;
}) {
  const KPI_DATA = [
    { icon: ShoppingCart, value: String(total), label: 'Всего', accent: '#e8b94a' },
    { icon: CheckCircle2, value: String(checked), label: 'Куплено', accent: '#4ade80' },
    { icon: Circle, value: String(remaining), label: 'Осталось', accent: '#60a5fa' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 shrink-0">
      {KPI_DATA.map(({ icon: Icon, value, label, accent }) => (
        <GlassCard
          key={label}
          className="px-5 py-5 flex items-center gap-4 hover:border-white/[0.14] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-200"
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}20`, boxShadow: `0 0 24px ${accent}20` }}
          >
            <Icon size={20} style={{ color: accent }} strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-2xl leading-tight truncate">{value}</p>
            <p className="text-white/40 text-xs mt-0.5 truncate">{label}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
