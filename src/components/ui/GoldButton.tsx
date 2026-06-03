import { ReactNode } from 'react';

export function GoldButton({
  children,
  onClick,
  variant = 'solid',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'solid' | 'outline';
  className?: string;
}) {
  const base = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2';
  const styles =
    variant === 'solid'
      ? 'bg-gradient-to-r from-[#c9953c] to-[#e8b94a] text-[#0a0c10] shadow-[0_4px_16px_rgba(201,149,60,0.3)] hover:shadow-[0_6px_24px_rgba(201,149,60,0.45)] hover:scale-[1.02] active:scale-[0.98]'
      : 'border border-[#c9953c]/40 text-[#e8b94a] hover:bg-[#c9953c]/10 hover:border-[#c9953c]/60';

  return (
    <button onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}
