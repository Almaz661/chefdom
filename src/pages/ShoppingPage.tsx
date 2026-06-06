import { useState } from 'react';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { trpc } from '../utils/trpc';
import { toast } from '../components/ui/Toast';
import { GlassCard } from '../components/ui/GlassCard';
import { ShoppingHeader } from '../components/shopping/ShoppingHeader';
import { ShoppingKpiRow } from '../components/shopping/ShoppingKpiRow';
import { ShoppingProgress } from '../components/shopping/ShoppingProgress';
import { ShoppingAddForm } from '../components/shopping/ShoppingAddForm';
import { ShoppingCategoryGroup } from '../components/shopping/ShoppingCategoryGroup';
import { ShoppingPreviewDialog } from '../components/shopping/ShoppingPreviewDialog';
import type { PreviewItem } from '../components/shopping/ShoppingPreviewDialog';

// --- Client-side storageType guessing (mirrors backend logic for preview) ---

const FREEZER_KEYWORDS = [
  'замороженн', 'заморож', 'мороженое', 'пельмен', 'вареник',
  'наггетс', 'фри', 'ice cream', 'frozen',
];
const PANTRY_KEYWORDS = [
  'крупа', 'рис', 'гречк', 'макарон', 'спагетти', 'лапша', 'мука',
  'сахар', 'соль', 'масло подсолн', 'масло растит', 'оливков',
  'консерв', 'горох', 'фасоль', 'чечевиц', 'нут',
  'чай', 'кофе', 'какао', 'специ', 'перец молот', 'корица',
  'уксус', 'соус', 'кетчуп', 'майонез', 'горчиц',
  'печенье', 'крекер', 'сухар', 'хлебц', 'вафл',
  'варенье', 'джем', 'мёд', 'мед', 'сироп',
];

type StorageType = 'fridge' | 'freezer' | 'pantry';

function guessStorageType(name: string): StorageType {
  const lower = name.toLowerCase();
  for (const kw of FREEZER_KEYWORDS) {
    if (lower.includes(kw)) return 'freezer';
  }
  for (const kw of PANTRY_KEYWORDS) {
    if (lower.includes(kw)) return 'pantry';
  }
  return 'fridge';
}

export function ShoppingPage() {
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);

  const utils = trpc.useUtils();

  const { data: items = [], isLoading } = trpc.shopping.list.useQuery();

  const add = trpc.shopping.add.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const toggle = trpc.shopping.toggle.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.shopping.remove.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const clearChecked = trpc.shopping.clearChecked.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const addBulkSmart = trpc.inventory.addBulkSmart.useMutation({
    onSuccess: (data) => {
      clearChecked.mutate();
      setShowPreview(false);
      toast.success(`Добавлено в инвентарь: ${data.added} товаров`);
    },
    onError: (err) => toast.error(err.message),
  });

  // --- Computed data ---

  const total = items.length;
  const checked = items.filter((i) => i.isChecked === 1).length;
  const remaining = total - checked;

  // Group by category
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.category || 'Без категории';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === 'Без категории') return 1;
    if (b === 'Без категории') return -1;
    return a.localeCompare(b, 'ru');
  });

  // --- Handlers ---

  const handleAdd = (productName: string) => {
    add.mutate({ productName });
  };

  const openPreview = () => {
    const checkedItems = items.filter((i) => i.isChecked === 1);
    const mapped = checkedItems.map((i) => ({
      productName: i.productName,
      quantity: i.quantity ? parseFloat(i.quantity) : null,
      unit: i.unit,
      storageType: guessStorageType(i.productName),
    }));
    setPreviewItems(mapped);
    setShowPreview(true);
  };

  const cycleStorage = (idx: number) => {
    setPreviewItems((prev) => {
      const next = [...prev];
      const current = next[idx].storageType;
      const order: StorageType[] = ['fridge', 'freezer', 'pantry'];
      const nextIdx = (order.indexOf(current) + 1) % 3;
      next[idx] = { ...next[idx], storageType: order[nextIdx] };
      return next;
    });
  };

  const confirmPreview = () => {
    addBulkSmart.mutate({
      items: previewItems.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unit: i.unit,
        storageType: i.storageType,
      })),
    });
  };

  return (
    <div className="h-[calc(100vh-2rem)] w-full bg-[#05070A] p-6 overflow-hidden">
      <div className="h-full max-w-5xl mx-auto flex flex-col gap-5">
        {/* Header */}
        <ShoppingHeader
          checkedCount={checked}
          onAddToInventory={openPreview}
          addToInventoryPending={addBulkSmart.isPending || clearChecked.isPending}
        />

        {/* KPI */}
        <ShoppingKpiRow
          total={total}
          checked={checked}
          remaining={remaining}
        />

        {/* Progress */}
        <ShoppingProgress total={total} checked={checked} />

        {/* Add form */}
        <ShoppingAddForm onAdd={handleAdd} isPending={add.isPending} />

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-[#c9a84c]" />
          </div>
        ) : total === 0 ? (
          <GlassCard className="p-10 text-center flex-1 flex flex-col items-center justify-center">
            <ShoppingCart
              size={36}
              className="text-white/15 mb-4"
              strokeWidth={1.3}
            />
            <p className="text-white/40 text-sm">
              Список пуст. Добавьте продукты выше или перенесите из меню.
            </p>
          </GlassCard>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
            {categories.map((cat) => (
              <ShoppingCategoryGroup
                key={cat}
                category={cat}
                items={grouped[cat]}
                onToggle={(id) => toggle.mutate({ id })}
                onRemove={(id) => remove.mutate({ id })}
              />
            ))}

            {/* Clear checked */}
            {checked > 0 && (
              <div className="shrink-0 pt-2 pb-4">
                <button
                  onClick={() => clearChecked.mutate()}
                  disabled={clearChecked.isPending || addBulkSmart.isPending}
                  className="text-sm text-white/30 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Очистить отмеченные ({checked})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      {showPreview && (
        <ShoppingPreviewDialog
          items={previewItems}
          onCycleStorage={cycleStorage}
          onConfirm={confirmPreview}
          onClose={() => setShowPreview(false)}
          isPending={addBulkSmart.isPending}
        />
      )}
    </div>
  );
}
