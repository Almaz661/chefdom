import { Trash2 } from 'lucide-react';

export interface ShoppingItemData {
  id: number;
  productName: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  isChecked: number;
  recipeSource: string | null;
}

export function ShoppingItem({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingItemData;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const isChecked = item.isChecked === 1;

  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-200 group">
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
          isChecked
            ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)] border-[var(--color-primary)] shadow-[0_0_8px_rgba(201,149,60,0.3)]'
            : 'border-white/20 hover:border-[var(--color-primary)]/60'
        }`}
        aria-label={isChecked ? 'Отметить как не купленное' : 'Отметить как купленное'}
      >
        {isChecked && (
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 7l3 3 5-5"
              stroke="#0a0c10"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-base font-semibold truncate transition-colors ${
          isChecked ? 'line-through text-white/25' : 'text-white/90'
        }`}>
          {item.productName}
          {item.quantity && (
            <span className={`ml-2 text-sm font-normal ${isChecked ? 'text-white/15' : 'text-white/40'}`}>
              {item.quantity}{item.unit ? ` ${item.unit}` : ''}
            </span>
          )}
        </p>
        {item.recipeSource && (
          <p className="text-xs font-medium text-white/25 mt-0.5 truncate">
            из: {item.recipeSource}
          </p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={onRemove}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Удалить"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
