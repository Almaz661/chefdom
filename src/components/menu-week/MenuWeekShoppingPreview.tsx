import { ShoppingCart, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { trpc } from '../../utils/trpc';

export function MenuWeekShoppingPreview() {
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery();
  const unchecked = shoppingItems.filter((i: any) => !i.isChecked).length;
  const displayItems = shoppingItems.slice(0, 5);

  if (shoppingItems.length === 0) return null;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.10] hover:bg-white/[0.05] transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#c9a84c]/10 flex items-center justify-center">
            <ShoppingCart size={15} className="text-[#c9a84c]" />
          </div>
          <h2 className="text-sm font-bold text-white/80">Список покупок</h2>
        </div>
        <div className="flex items-center gap-3">
          {unchecked > 0 && (
            <span className="text-xs text-white/30">{unchecked} позиций</span>
          )}
          <Link
            to="/shopping"
            className="flex items-center gap-1 text-xs text-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors font-semibold"
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
                  ? 'bg-[#c9a84c]/20 border-[#c9a84c]/50'
                  : 'border-white/[0.15]'
              }`}
            >
              {item.isChecked && (
                <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="#c9a84c" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
