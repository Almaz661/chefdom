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
  const cls = variant === 'solid' ? 'cd-btn-primary' : 'cd-btn-ghost';
  return (
    <button onClick={onClick} disabled={disabled} className={`${cls} ${className}`}>
      {children}
    </button>
  );
}
