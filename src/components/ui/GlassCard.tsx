import { ReactNode } from 'react';

/**
 * GlassCard → cd-card
 * Заменяет старый glassmorphism-вариант на чистую карточку из дизайн-системы.
 * backdrop-blur убран (тормозит на слабых устройствах).
 */
export function GlassCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`cd-card ${className}`}>
      {children}
    </div>
  );
}
