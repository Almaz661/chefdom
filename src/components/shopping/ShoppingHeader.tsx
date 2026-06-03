import { PackagePlus } from 'lucide-react';
import { GoldButton } from '../ui/GoldButton';

export function ShoppingHeader({
  checkedCount,
  onAddToInventory,
  addToInventoryPending,
}: {
  checkedCount: number;
  onAddToInventory: () => void;
  addToInventoryPending: boolean;
}) {
  return (
    <div className="space-y-1 shrink-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">Покупки</h1>
          <p className="text-white/40 text-sm mt-0.5">Список продуктов для похода в магазин</p>
        </div>
        <div className="flex items-center gap-2">
          {checkedCount > 0 && (
            <GoldButton
              className="text-xs px-3 py-2"
              onClick={onAddToInventory}
            >
              <PackagePlus size={14} />
              {addToInventoryPending ? 'Переношу…' : `В инвентарь (${checkedCount})`}
            </GoldButton>
          )}
        </div>
      </div>
    </div>
  );
}
