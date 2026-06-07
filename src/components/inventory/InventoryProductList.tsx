import { Snowflake, Refrigerator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import { InventoryProductCard } from './InventoryProductCard';
import type { ViewItem } from './InventoryExpiringSection';

export function InventoryProductList({
  items,
  tab,
  onRemove,
  onToggleBasic,
}: {
  items: ViewItem[];
  tab: 'fridge' | 'freezer' | 'pantry';
  onRemove: (item: ViewItem) => void;
  onToggleBasic: (item: ViewItem) => void;
}) {
  if (items.length === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <Refrigerator
          size={36}
          className="text-white/15 mx-auto mb-4"
          strokeWidth={1.3}
        />
        <p className="text-white/40 text-sm">
          Пусто. Добавьте продукты кнопкой «Добавить» сверху.
        </p>
        {tab === 'freezer' && (
          <p className="text-white/25 text-xs mt-3">
            Котлеты, фарш, ягоды и другие заморозки удобнее заводить через раздел{' '}
            <Link to="/preserves" className="text-[var(--color-primary)] hover:underline">
              Заготовки
            </Link>
            {' '}— срок хранения подставится автоматически.
          </p>
        )}
      </GlassCard>
    );
  }

  // Group by category
  const grouped = items.reduce<Record<string, ViewItem[]>>((acc, item) => {
    const cat = item.category || 'Без категории';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === 'Заготовки') return -1;
    if (b === 'Заготовки') return 1;
    if (a === 'Без категории') return 1;
    if (b === 'Без категории') return -1;
    return a.localeCompare(b, 'ru');
  });

  // Все вкладки — единый простой список с заголовками категорий
  return (
    <div className="space-y-5 flex-1 min-h-0 overflow-y-auto">
      {categories.map((cat) => (
        <section key={cat}>
          <div className="flex items-center gap-2 mb-2.5">
            {cat === 'Заготовки' && (
              <Snowflake size={12} className="text-blue-400" />
            )}
            <h3 className="text-[11px] font-bold text-white/35 uppercase tracking-wider">
              {cat}
            </h3>
            {cat === 'Заготовки' && (
              <Link
                to="/preserves"
                className="ml-auto text-[11px] text-[var(--color-primary)]/60 hover:text-[var(--color-primary)] normal-case font-normal tracking-normal transition-colors"
              >
                в раздел →
              </Link>
            )}
          </div>
          <div className="space-y-1.5">
            {grouped[cat].map((item) => (
              <InventoryProductCard
                key={`${item.source}-${item.id}`}
                item={item}
                onRemove={() => onRemove(item)}
                onToggleBasic={
                  item.source === 'inventory'
                    ? () => onToggleBasic(item)
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
