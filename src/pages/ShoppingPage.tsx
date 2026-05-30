import { useState, FormEvent } from "react";
import { ShoppingCart, Plus, Trash2, Loader2, Refrigerator, Snowflake, Package, PackagePlus } from "lucide-react";
import { trpc } from "../utils/trpc";

// Ключевые слова для авто-определения storageType (дублирует логику бэкенда для превью)
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

function guessStorageType(name: string): 'fridge' | 'freezer' | 'pantry' {
  const lower = name.toLowerCase();
  for (const kw of FREEZER_KEYWORDS) {
    if (lower.includes(kw)) return 'freezer';
  }
  for (const kw of PANTRY_KEYWORDS) {
    if (lower.includes(kw)) return 'pantry';
  }
  return 'fridge';
}

const STORAGE_LABELS = {
  fridge: { label: 'Холодильник', icon: Refrigerator },
  freezer: { label: 'Морозилка', icon: Snowflake },
  pantry: { label: 'Кладовая', icon: Package },
} as const;

type StorageType = 'fridge' | 'freezer' | 'pantry';

export function ShoppingPage() {
  const [newItem, setNewItem] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<{ productName: string; quantity: number | null; unit: string | null; storageType: StorageType }[]>([]);
  const utils = trpc.useUtils();

  const { data: items = [], isLoading } = trpc.shopping.list.useQuery();

  const add = trpc.shopping.add.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      setNewItem("");
    },
  });

  const toggle = trpc.shopping.toggle.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
    },
  });

  const remove = trpc.shopping.remove.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
    },
  });

  const clearChecked = trpc.shopping.clearChecked.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
    },
  });

  const addBulkSmart = trpc.inventory.addBulkSmart.useMutation({
    onSuccess: (data) => {
      clearChecked.mutate();
      setShowPreview(false);
      alert(`Добавлено в инвентарь: ${data.added} товаров`);
    },
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newItem.trim();
    if (!trimmed) return;
    add.mutate({ productName: trimmed });
  };

  // Открыть превью с авто-раскладкой
  const openPreview = () => {
    const checkedItems = items.filter(i => i.isChecked === 1);
    const mapped = checkedItems.map(i => ({
      productName: i.productName,
      quantity: i.quantity ? parseFloat(i.quantity) : null,
      unit: i.unit,
      storageType: guessStorageType(i.productName),
    }));
    setPreviewItems(mapped);
    setShowPreview(true);
  };

  // Переключить storageType для элемента в превью (тап по иконке)
  const cycleStorage = (idx: number) => {
    setPreviewItems(prev => {
      const next = [...prev];
      const current = next[idx].storageType;
      const order: StorageType[] = ['fridge', 'freezer', 'pantry'];
      const nextIdx = (order.indexOf(current) + 1) % 3;
      next[idx] = { ...next[idx], storageType: order[nextIdx] };
      return next;
    });
  };

  // Подтвердить и отправить на бэкенд
  const confirmPreview = () => {
    addBulkSmart.mutate({
      items: previewItems.map(i => ({
        productName: i.productName,
        quantity: i.quantity,
        unit: i.unit,
        storageType: i.storageType,
      })),
    });
  };

  const total = items.length;
  const checked = items.filter((i) => i.isChecked === 1).length;
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  // Группировка по категории
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.category || "Без категории";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === "Без категории") return 1;
    if (b === "Без категории") return -1;
    return a.localeCompare(b, "ru");
  });

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 lg:py-12">
      <h1 className="font-serif text-2xl font-semibold text-ink mb-8">
        Покупки
      </h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Прогресс-бар */}
          {total > 0 && (
            <div className="mb-8">
              <div className="flex justify-between text-xs text-ink-muted mb-1.5">
                <span>{checked} из {total}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 bg-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Список по категориям */}
          {total === 0 ? (
            <div className="bg-paper border border-dashed border-line rounded-xl py-14 text-center">
              <ShoppingCart
                size={24}
                className="text-ink-muted mx-auto mb-3"
                strokeWidth={1}
              />
              <p className="text-ink-muted text-sm">
                Список пуст
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => (
                <section key={cat}>
                  <h3 className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-2">
                    {cat}
                  </h3>
                  <ul className="space-y-px">
                    {grouped[cat].map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-elevated transition-colors group"
                      >
                        <button
                          onClick={() => toggle.mutate({ id: item.id })}
                          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            item.isChecked === 1
                              ? "bg-primary border-primary"
                              : "border-line-strong hover:border-primary"
                          }`}
                          aria-label={
                            item.isChecked === 1
                              ? "Отметить как не купленное"
                              : "Отметить как купленное"
                          }
                        >
                          {item.isChecked === 1 && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 14 14"
                              fill="none"
                            >
                              <path
                                d="M3 7l3 3 5-5"
                                stroke="#0f0f0f"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                        <span
                          className={`flex-1 text-sm ${
                            item.isChecked === 1
                              ? "line-through text-ink-muted"
                              : "text-ink"
                          }`}
                        >
                          {item.productName}
                          {item.quantity && (
                            <span className="text-ink-muted ml-1.5 text-xs">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => remove.mutate({ id: item.id })}
                          className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-alert opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          aria-label="Удалить"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {/* Действия с купленными */}
          {checked > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                onClick={openPreview}
                disabled={addBulkSmart.isPending || clearChecked.isPending}
                className="flex items-center justify-center gap-2 h-10 px-4 bg-primary text-cream rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors text-xs font-medium"
              >
                <PackagePlus size={14} />
                В инвентарь ({checked})
              </button>
              <button
                onClick={() => clearChecked.mutate()}
                disabled={clearChecked.isPending || addBulkSmart.isPending}
                className="text-xs text-ink-muted hover:text-alert transition-colors px-2"
              >
                Очистить
              </button>
            </div>
          )}

          {/* Форма добавления */}
          <form
            onSubmit={handleAdd}
            className="mt-8 flex gap-2"
          >
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Добавить..."
              className="flex-1 h-10 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-primary/40"
            />
            <button
              type="submit"
              disabled={!newItem.trim() || add.isPending}
              className="w-10 h-10 rounded-lg bg-primary text-cream flex items-center justify-center hover:bg-primary-dark disabled:opacity-40 transition-colors"
              aria-label="Добавить"
            >
              <Plus size={16} />
            </button>
          </form>
        </>
      )}

      {/* Диалог превью раскладки */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-line">
              <h3 className="font-serif text-lg font-semibold text-ink text-center">
                Раскладываем по местам
              </h3>
              <p className="text-xs text-ink-muted text-center mt-1">
                Нажми на иконку чтобы изменить место хранения
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {previewItems.map((item, idx) => {
                  const storage = STORAGE_LABELS[item.storageType];
                  const Icon = storage.icon;
                  return (
                    <li
                      key={idx}
                      className="flex items-center gap-3 bg-cream rounded-lg px-4 py-3"
                    >
                      <button
                        onClick={() => cycleStorage(idx)}
                        className="w-9 h-9 rounded-lg border border-line bg-paper flex items-center justify-center shrink-0 hover:border-primary transition-colors"
                        title={`Сейчас: ${storage.label}. Нажми чтобы изменить`}
                      >
                        <Icon size={18} className="text-primary" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-ink-muted">
                          → {storage.label}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="p-4 border-t border-line flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmPreview}
                disabled={addBulkSmart.isPending}
                className="flex-1 h-12 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {addBulkSmart.isPending ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  `Подтвердить (${previewItems.length})`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
