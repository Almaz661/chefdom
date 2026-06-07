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
      className={`rounded-[var(--cd-r-xl,20px)] border border-[var(--color-line)] bg-[var(--color-paper)]/75 shadow-[0_12px_48px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}
