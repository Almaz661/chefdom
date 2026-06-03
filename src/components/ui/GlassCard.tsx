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
      className={`rounded-[20px] border border-white/[0.08] bg-[#0b0f1e]/75 backdrop-blur-2xl shadow-[0_12px_48px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}
