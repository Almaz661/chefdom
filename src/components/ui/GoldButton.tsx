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
      : 'border border-[#c9a84c]/40 text-[#c9a84c] hover:bg-[#c9a84c]/10 hover:border-[#c9a84c]/60';

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}
