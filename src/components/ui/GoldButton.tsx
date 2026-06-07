import { ReactNode } from 'react';

export function GoldButton({
  children,
  onClick,
  disabled,
  variant = 'solid',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
  className?: string;
}) {
  const base = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2';
  const styles =
    variant === 'solid'
      ? 'btn-gold'
      : 'border border-[var(--color-primary)]/40 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/60';

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}
