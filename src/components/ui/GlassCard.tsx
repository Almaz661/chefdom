import { ReactNode } from 'react';

export function GlassCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border border-white/[0.06] bg-[#0c1021]/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${className}`}
    >
      {children}
    </div>
  );
}
