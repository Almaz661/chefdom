import { GlassCard } from '../ui/GlassCard';
import { ShoppingItem } from './ShoppingItem';
import type { ShoppingItemData } from './ShoppingItem';

export function ShoppingCategoryGroup({
  category,
  items,
  onToggle,
  onRemove,
}: {
  category: string;
  items: ShoppingItemData[];
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-2.5 ml-1">
        {category}
      </h3>
      <GlassCard className="p-3">
        <div className="space-y-1.5">
          {items.map((item) => (
            <ShoppingItem
              key={item.id}
              item={item}
              onToggle={() => onToggle(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
