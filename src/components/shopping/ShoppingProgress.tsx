import { GlassCard } from '../ui/GlassCard';

export function ShoppingProgress({
  total,
  checked,
}: {
  total: number;
  checked: number;
}) {
  if (total === 0) return null;

  const progress = Math.round((checked / total) * 100);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashLength = (progress / 100) * circumference;

  return (
    <GlassCard className="p-5 flex items-center gap-6 shrink-0">
      {/* Ring */}
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {/* Background track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none" stroke="white" strokeWidth="6" strokeOpacity="0.06"
          />
          {/* Progress */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none" stroke="url(#goldGrad)" strokeWidth="6"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px rgba(232,185,74,0.4))' }}
          />
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-primary)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white font-semibold text-xl">{progress}%</span>
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-white/70 text-base font-bold">
          {checked} из {total} куплены
        </p>
        <p className="text-white/30 text-sm font-medium mt-1">
          {total - checked === 0
            ? 'Всё куплено! Можно переносить в инвентарь.'
            : `Осталось ${total - checked} позиций`}
        </p>
      </div>
    </GlassCard>
  );
}
