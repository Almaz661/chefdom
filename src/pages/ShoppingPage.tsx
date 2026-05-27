import { useState, FormEvent } from "react";
import { ShoppingCart, Plus, Trash2, Loader2, Refrigerator, Snowflake, Package, PackagePlus } from "lucide-react";
import { trpc } from "../utils/trpc";

export function ShoppingPage() {
  const [newItem, setNewItem] = useState("");
  const [storePick, setStorePick] = useState<number | null>(null);
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

  const buyAndStore = trpc.shopping.buyAndStore.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      setStorePick(null);
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
      // После переноса — удаляем перенесённые товары из списка покупок
      clearChecked.mutate();
      alert(`Добавлено в инвентарь: ${data.added} товаров`);
    },
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newItem.trim();
    if (!trimmed) return;
    add.mutate({ productName: trimmed });
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
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink mb-6">
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
            <div className="mb-6">
              <div className="flex justify-between text-sm text-ink-soft mb-1.5">
                <span>
                  {checked} из {total} куплены
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2.5 bg-cream rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Список по категориям */}
          {total === 0 ? (
            <div className="bg-paper border border-line border-dashed rounded-2xl p-8 text-center">
              <ShoppingCart
                size={32}
                className="text-line-strong mx-auto mb-3"
                strokeWidth={1.5}
              />
              <p className="text-ink-soft text-sm">
                Список пуст. Добавьте продукты ниже.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {categories.map((cat) => (
                <section key={cat}>
                  <h3 className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2">
                    {cat}
                  </h3>
                  <ul className="space-y-1">
                    {grouped[cat].map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 bg-paper rounded-lg px-4 py-3 border border-line"
                      >
                        <button
                          onClick={() => toggle.mutate({ id: item.id })}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
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
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                            >
                              <path
                                d="M3 7l3 3 5-5"
                                stroke="white"
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
                            <span className="text-ink-muted ml-2">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => remove.mutate({ id: item.id })}
                          className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-alert transition-colors shrink-0"
                          aria-label="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {/* Кнопка очистить отмеченные */}
          {checked > 0 && (
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  const checkedItems = items.filter(i => i.isChecked === 1);
                  addBulkSmart.mutate({
                    items: checkedItems.map(i => ({
                      productName: i.productName,
                      quantity: i.quantity ? parseFloat(i.quantity) : null,
                      unit: i.unit,
                    })),
                  });
                }}
                disabled={addBulkSmart.isPending || clearChecked.isPending}
                className="flex items-center justify-center gap-2 h-10 px-4 bg-primary text-paper rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addBulkSmart.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <PackagePlus size={16} />
                )}
                <span className="text-sm font-medium">
                  Всё в инвентарь ({checked})
                </span>
              </button>
              <button
                onClick={() => clearChecked.mutate()}
                disabled={clearChecked.isPending || addBulkSmart.isPending}
                className="text-sm text-ink-muted hover:text-alert transition-colors disabled:opacity-50"
              >
                Очистить отмеченные
              </button>
            </div>
          )}

          {/* Форма добавления */}
          <form
            onSubmit={handleAdd}
            className="mt-6 flex gap-2"
          >
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Добавить покупку..."
              className="flex-1 h-12 px-4 bg-paper border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!newItem.trim() || add.isPending}
              className="w-12 h-12 rounded-lg bg-primary text-paper flex items-center justify-center hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Добавить"
            >
              <Plus size={20} />
            </button>
          </form>
        </>
      )}

      {/* Диалог выбора локации */}
      {storePick !== null && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setStorePick(null)}
        >
          <div
            className="bg-paper w-full sm:max-w-xs sm:rounded-2xl rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-semibold text-ink mb-4 text-center">
              Куда положить?
            </h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => buyAndStore.mutate({ id: storePick, storageType: 'fridge' })}
                disabled={buyAndStore.isPending}
                className="flex items-center gap-3 px-4 h-12 rounded-lg border border-line hover:border-primary hover:bg-cream transition-colors"
              >
                <Refrigerator size={20} className="text-primary" />
                <span className="text-sm font-medium text-ink">Холодильник</span>
              </button>
              <button
                onClick={() => buyAndStore.mutate({ id: storePick, storageType: 'freezer' })}
                disabled={buyAndStore.isPending}
                className="flex items-center gap-3 px-4 h-12 rounded-lg border border-line hover:border-primary hover:bg-cream transition-colors"
              >
                <Snowflake size={20} className="text-primary" />
                <span className="text-sm font-medium text-ink">Морозилка</span>
              </button>
              <button
                onClick={() => buyAndStore.mutate({ id: storePick, storageType: 'pantry' })}
                disabled={buyAndStore.isPending}
                className="flex items-center gap-3 px-4 h-12 rounded-lg border border-line hover:border-primary hover:bg-cream transition-colors"
              >
                <Package size={20} className="text-primary" />
                <span className="text-sm font-medium text-ink">Кладовая</span>
              </button>
            </div>
            <button
              onClick={() => setStorePick(null)}
              className="mt-4 w-full h-10 text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
