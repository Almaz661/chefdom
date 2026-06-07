import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InventoryProductCard } from './InventoryProductCard';
import type { ViewItem } from './InventoryExpiringSection';

/** Mapping категории → изображение из public/images/ingredients/ */
const CATEGORY_IMAGES: Record<string, string> = {
  'Крупы': '/images/ingredients/grains.webp',
  'Крупы и бобовые': '/images/ingredients/grains.webp',
  'Зерновые': '/images/ingredients/grains.webp',
  'Макароны': '/images/ingredients/grains.webp',
  'Специи': '/images/ingredients/spices.webp',
  'Специи и травы': '/images/ingredients/spices.webp',
  'Приправы': '/images/ingredients/spices.webp',
  'Масла': '/images/ingredients/oils.webp',
  'Масла и уксусы': '/images/ingredients/oils.webp',
  'Соусы': '/images/ingredients/sauces.webp',
  'Консервы': '/images/ingredients/preserves.webp',
  'Заготовки': '/images/ingredients/preserves.webp',
  'Орехи': '/images/ingredients/nuts.webp',
  'Орехи и семена': '/images/ingredients/nuts.webp',
  'Сухофрукты': '/images/ingredients/nuts.webp',
  'Выпечка': '/images/ingredients/bakery.webp',
  'Хлеб': '/images/ingredients/bakery.webp',
  'Напитки': '/images/ingredients/beverages.webp',
  'Сладкое': '/images/ingredients/sweets.webp',
  'Сладости': '/images/ingredients/sweets.webp',
  'Молочные': '/images/ingredients/dairy.webp',
  'Мясо': '/images/ingredients/meat.webp',
  'Рыба': '/images/ingredients/fish.webp',
  'Овощи': '/images/ingredients/vegetables.webp',
  'Фрукты': '/images/ingredients/fruits.webp',
  'Зелень': '/images/ingredients/greens.webp',
  'Заморозка': '/images/ingredients/frozen.webp',
};

function getCategoryImage(category: string): string {
  // Exact match
  if (CATEGORY_IMAGES[category]) return CATEGORY_IMAGES[category];
  // Partial match
  const lower = category.toLowerCase();
  for (const [key, src] of Object.entries(CATEGORY_IMAGES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return src;
    }
  }
  return '/images/ingredients/kitchen.webp';
}

export function InventoryCategoryCard({
  category,
  items,
  onRemove,
  onToggleBasic,
}: {
  category: string;
  items: ViewItem[];
  onRemove: (item: ViewItem) => void;
  onToggleBasic: (item: ViewItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const imageSrc = getCategoryImage(category);

  return (
    <div className="rounded-[var(--cd-r-xl,20px)] border border-[var(--color-line)] transition-all duration-300 hover:border-white/[0.12]">
      {/* Category header card */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full relative h-[100px] flex items-end p-5 text-left group cursor-pointer rounded-[20px] overflow-hidden"
      >
        {/* Background image */}
        <img
          src={imageSrc}
          alt={category}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-cream)]/90 via-[var(--color-cream)]/50 to-[var(--color-cream)]/20 group-hover:from-[var(--color-cream)]/85 group-hover:via-[var(--color-cream)]/40 transition-all duration-300" />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-between w-full">
          <div>
            <h3 className="text-white font-semibold text-lg">{category}</h3>
            <p className="text-white/40 text-sm font-semibold mt-0.5">
              {items.length} {items.length === 1 ? 'продукт' : items.length < 5 ? 'продукта' : 'продуктов'}
            </p>
          </div>
          <div className={`w-8 h-8 rounded-lg bg-white/[0.08] border border-[var(--color-line)] flex items-center justify-center transition-all duration-200 ${isOpen ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30' : ''}`}>
            {isOpen ? (
              <ChevronUp size={16} className="text-[var(--color-primary)]" />
            ) : (
              <ChevronDown size={16} className="text-white/40 group-hover:text-white/60" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded product list */}
      {isOpen && (
        <div className="bg-[var(--color-paper)]/60 border-t border-[var(--color-line)] p-3 space-y-1.5">
          {items.map((item) => (
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
      )}
    </div>
  );
}
