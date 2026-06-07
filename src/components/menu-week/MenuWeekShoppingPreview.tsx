import { ShoppingCart, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { trpc } from '../../utils/trpc';

export function MenuWeekShoppingPreview() {
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery();
  const unchecked = shoppingItems.filter((i: any) => !i.isChecked).length;
  const displayItems = shoppingItems.slice(0, 5);

  if (shoppingItems.length === 0) return null;

  return (
    <div className="card-dark p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
            <ShoppingCart size={15} className="text-[var(--color-primary)]" />
          </div>
          <h2 className="text-sm font-bold text-white/80">Список покупок</h2>
        </div>
        <div className="flex items-center gap-3">
          {unchecked > 0 && (
            <span className="text-xs text-white/30">{unchecked} позиций</span>
          )}
          <Link
            to="/shopping"
            className="flex items-center gap-1 text-xs text-[var(--color-primary)]/70 hover:text-[var(--color-primary)] transition-colors font-semibold"
          >
            Все <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-2">
        {displayItems.map((item: any) => (
          <li key={item.id} className="flex items-center gap-3">
            {/* Checkbox indicator */}
            <div
              className={`w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 ${
                item.isChecked
                  ? 'bg-[var(--color-primary)]/20 border-[var(--color-primary)]/50'
                  : 'border-[var(--color-line-strong)]'
              }`}
            >
              {item.isChecked && (
                <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="var(--color-primary)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            <span
              className={`text-sm flex-1 ${
                item.isChecked ? 'text-white/25 line-through' : 'text-white/70'
              }`}
            >
              {item.productName}
            </span>

            {item.quantity && (
              <span className="text-xs text-white/30 shrink-0">
                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
