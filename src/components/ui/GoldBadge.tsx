import { ReactNode } from 'react';

export function GoldBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#c9953c]/15 text-[#e8b94a] border border-[#c9953c]/20">
      {children}
    </span>
  );
}
