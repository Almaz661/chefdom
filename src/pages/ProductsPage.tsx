import { useState } from "react";
import { Search, Package, Barcode, Plus, Check, Store, Calendar, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { trpc } from "../utils/trpc";
import { BarcodeScanner } from "../components/BarcodeScanner";

const STORAGE_OPTIONS: { key: "fridge" | "freezer" | "pantry"; label: string }[] = [
  { key: "fridge", label: "Холодильник" },
  { key: "freezer", label: "Морозилка" },
  { key: "pantry", label: "Кладовая" },
];

// Кнопка «Удалить все» — очищает весь каталог продуктов
function DeleteAllButton() {
  const utils = trpc.useUtils();
  const deleteAll = trpc.products.deleteAll.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.products.search.invalidate();
    },
  });

  return (
    <button
      onClick={() => {
        if (confirm('Удалить ВСЕ товары из каталога? Это действие нельзя отменить.')) {
          deleteAll.mutate({ confirm: true });
        }
      }}
      disabled={deleteAll.isPending}
      className="h-10 px-3 rounded-lg border border-red-200 bg-paper text-red-500 text-xs font-medium hover:border-red-400 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
      title="Удалить все товары"
    >
      <Trash2 size={14} />
      <span className="hidden sm:inline">{deleteAll.isPending ? 'Удаляю…' : 'Очистить'}</span>
    </button>
  );
}

// Кнопка «Загрузить из чеков» — синхронизирует все товары из чеков в каталог
function SyncFromReceiptsButton() {
  const utils = trpc.useUtils();
  const sync = trpc.receipts.syncAllToProducts.useMutation({
    onSuccess: (data) => {
      utils.products.list.invalidate();
      utils.products.search.invalidate();
      alert(`Готово! Загружено ${data.synced} товаров из чеков в каталог.`);
    },
  });

  return (
    <button
      onClick={() => {
        if (confirm('Загрузить все товары из чеков в каталог «Продукты»?')) {
          sync.mutate();
        }
      }}
      disabled={sync.isPending}
      className="h-10 px-3 rounded-lg border border-line bg-paper text-ink-soft text-xs font-medium hover:border-primary hover:text-primary transition-colors disabled:opacity-50 flex items-center gap-1.5"
      title="Загрузить все товары из чеков в каталог"
    >
      {sync.isPending ? '⏳' : '📥'}
      <span className="hidden sm:inline">{sync.isPending ? 'Загружаю…' : 'Из чеков'}</span>
    </button>
  );
}

// Карточка товара с ценой, магазином, датой, удалением и историей цен
function ProductCard({ product }: { product: { id: number; nameRu: string; brand?: string | null; lastPrice?: string | null; storeName?: string | null; purchaseDate?: string | null } }) {
  const [showHistory, setShowHistory] = useState(false);
  const price = product.lastPrice ? parseFloat(product.lastPrice as unknown as string) : null;
  const utils = trpc.useUtils();
  const deleteMut = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.products.search.invalidate();
    },
  });
  const historyQuery = trpc.products.getPriceHistory.useQuery(
    { productName: product.nameRu },
    { enabled: showHistory }
  );

  return (
    <li className="bg-paper border border-line rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
          <p className="text-sm font-medium text-ink truncate">{product.nameRu}</p>
          {product.brand && <p className="text-xs text-ink-muted">{product.brand}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {product.storeName && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <Store size={12} className="shrink-0" />
                {product.storeName}
              </span>
            )}
            {product.purchaseDate && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <Calendar size={12} className="shrink-0" />
                {product.purchaseDate}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {price !== null && (
            <span className="text-sm font-semibold text-ink tabular-nums whitespace-nowrap">
              €{price.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          <button
            onClick={() => deleteMut.mutate({ id: product.id })}
            disabled={deleteMut.isPending}
            className="p-1.5 rounded-md text-ink-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Удалить"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {/* История цен */}
      {showHistory && historyQuery.data && historyQuery.data.length > 1 && (
        <div className="mt-2 pt-2 border-t border-line">
          <p className="text-xs font-medium text-ink-soft mb-1">История цен:</p>
          <div className="space-y-0.5">
            {historyQuery.data.slice(0, 10).map((h, i) => {
              const prev = historyQuery.data![i + 1];
              const curr = parseFloat(h.price as unknown as string);
              const prevPrice = prev ? parseFloat(prev.price as unknown as string) : null;
              const diff = prevPrice !== null ? curr - prevPrice : 0;
              return (
                <div key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">
                    {h.purchaseDate || '—'} {h.storeName ? `· ${h.storeName}` : ''}
                  </span>
                  <span className={`font-medium tabular-nums ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-600' : 'text-ink'}`}>
                    €{curr.toFixed(2)}
                    {diff !== 0 && (
                      <span className="ml-1 text-[10px]">
                        {diff > 0 ? '↑' : '↓'}{Math.abs(diff).toFixed(2)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {showHistory && historyQuery.data && historyQuery.data.length <= 1 && (
        <div className="mt-2 pt-2 border-t border-line">
          <p className="text-xs text-ink-muted">Пока только одна покупка. История появится после следующей.</p>
        </div>
      )}
    </li>
  );
}

export function ProductsPage() {
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [mode, setMode] = useState<"search" | "barcode">("search");
  const [showAddToInventory, setShowAddToInventory] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [storageType, setStorageType] = useState<"fridge" | "freezer" | "pantry">("fridge");
  const [expiryDate, setExpiryDate] = useState("");

  const searchResults = trpc.products.search.useQuery(
    { query },
    { enabled: query.length >= 2 }
  );

  // Полный список всех товаров — показываем сразу
  const allProducts = trpc.products.list.useQuery();

  const barcodeResult = trpc.products.getByBarcode.useQuery(
    { barcode },
    { enabled: barcode.length >= 4, retry: false }
  );

  const utils = trpc.useUtils();
  const addToInventory = trpc.inventory.add.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      setShowAddToInventory(false);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);
    },
  });

  const handleAddToInventory = () => {
    const product = barcodeResult.data;
    if (!product) return;
    addToInventory.mutate({
      productName: product.brand
        ? `${product.brand} ${product.nameRu}`
        : product.nameRu,
      quantity: product.packageQuantity ? Number(product.packageQuantity) : null,
      unit: product.packageUnit || null,
      storageType,
      expiryDate: expiryDate || null,
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink">
          Продукты
        </h1>
        <div className="flex items-center gap-2">
          <DeleteAllButton />
          <SyncFromReceiptsButton />
        </div>
      </div>

      {/* Переключатель режимов */}
      <div className="flex gap-1 bg-cream rounded-lg p-1 mb-6">
        <button
          onClick={() => setMode("search")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            mode === "search" ? "bg-paper text-primary shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Search size={18} />
          По названию
        </button>
        <button
          onClick={() => setMode("barcode")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            mode === "barcode" ? "bg-paper text-primary shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Barcode size={18} />
          По штрих-коду
        </button>
      </div>

      {mode === "search" && (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти продукт..."
            className="w-full h-12 px-4 bg-paper border border-line rounded-lg text-ink focus:outline-none focus:border-primary mb-4"
          />
          {searchResults.data && searchResults.data.length > 0 ? (
            <ul className="space-y-2">
              {searchResults.data.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ul>
          ) : query.length >= 2 && !searchResults.isLoading ? (
            <div className="text-center py-8 text-ink-muted text-sm">
              Ничего не найдено
            </div>
          ) : query.length < 2 && allProducts.data && allProducts.data.length > 0 ? (
            <ul className="space-y-2">
              {allProducts.data.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ul>
          ) : !allProducts.isLoading ? (
            <div className="bg-paper border border-line border-dashed rounded-2xl p-8 text-center">
              <Package size={32} className="text-line-strong mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-ink-soft text-sm">Каталог пуст. Товары появятся автоматически после сканирования чеков.</p>
            </div>
          ) : null}
        </>
      )}

      {mode === "barcode" && (
        <>
          {/* Фото-сканер */}
          <div className="mb-4">
            <BarcodeScanner onDetected={(code) => {
              setBarcode(code);
              setShowAddToInventory(false);
              setAddedSuccess(false);
            }} />
          </div>

          {/* Ручной ввод */}
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-xs">или вручную:</span>
            <input
              type="text"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setShowAddToInventory(false);
                setAddedSuccess(false);
              }}
              placeholder="Введите штрих-код..."
              inputMode="numeric"
              className="w-full h-12 pl-24 pr-4 bg-paper border border-line rounded-lg text-ink focus:outline-none focus:border-primary font-mono"
            />
          </div>

          {/* Результат */}
          {barcodeResult.data ? (
            <div className="bg-paper border border-line rounded-xl px-4 py-4">
              <p className="text-base font-medium text-ink mb-1">{barcodeResult.data.nameRu}</p>
              {barcodeResult.data.brand && <p className="text-sm text-ink-muted">{barcodeResult.data.brand}</p>}
              {barcodeResult.data.packageQuantity && (
                <p className="text-sm text-ink-muted">
                  {barcodeResult.data.packageQuantity} {barcodeResult.data.packageUnit}
                </p>
              )}
              <p className="text-xs text-ink-muted font-mono mt-2">{barcodeResult.data.barcode}</p>

              {/* Кнопка "Добавить в инвентарь" */}
              {!showAddToInventory && !addedSuccess && (
                <button
                  onClick={() => setShowAddToInventory(true)}
                  className="mt-3 w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-primary text-paper font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                  <Plus size={18} />
                  Добавить в инвентарь
                </button>
              )}

              {/* Успех */}
              {addedSuccess && (
                <div className="mt-3 flex items-center gap-2 justify-center text-green-700 bg-green-50 border border-green-200 rounded-lg py-2.5">
                  <Check size={18} />
                  <span className="text-sm font-medium">Добавлено в инвентарь!</span>
                </div>
              )}

              {/* Форма выбора места хранения */}
              {showAddToInventory && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  <fieldset>
                    <legend className="block text-xs text-ink-soft mb-1">Куда положить?</legend>
                    <div className="inline-flex bg-cream rounded-lg p-0.5 w-full">
                      {STORAGE_OPTIONS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setStorageType(key)}
                          className={`flex-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${
                            storageType === key
                              ? "bg-primary text-paper"
                              : "text-ink-soft hover:text-ink"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="block">
                    <span className="block text-xs text-ink-soft mb-1">Срок годности (необязательно)</span>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full h-10 px-3 bg-cream border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-primary"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddToInventory(false)}
                      className="flex-1 h-10 rounded-lg border border-line text-ink-soft text-sm font-medium hover:bg-cream transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={handleAddToInventory}
                      disabled={addToInventory.isPending}
                      className="flex-1 h-10 rounded-lg bg-primary text-paper text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {addToInventory.isPending ? "Добавляю…" : "Добавить"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : barcodeResult.isError ? (
            <div className="text-center py-8 text-ink-muted text-sm">
              Товар не найден по этому штрих-коду
            </div>
          ) : barcode.length < 4 ? (
            <div className="bg-paper border border-line border-dashed rounded-2xl p-8 text-center">
              <Barcode size={32} className="text-line-strong mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-ink-soft text-sm">Сфотографируйте или введите штрих-код</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
