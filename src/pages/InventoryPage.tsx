import { useState, useRef, FormEvent } from "react";
import {
  Refrigerator,
  Snowflake,
  Package,
  Plus,
  ScanLine,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { trpc } from "../utils/trpc";
import { BrowserMultiFormatReader } from "@zxing/library";

const TABS = [
  { key: "fridge" as const, label: "Холодильник", icon: Refrigerator },
  { key: "freezer" as const, label: "Морозилка", icon: Snowflake },
  { key: "pantry" as const, label: "Кладовая", icon: Package },
];

/** Сколько дней до истечения срока */
function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate + "T00:00:00");
  return Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Текст срока */
function expiryText(expiryDate: string | null): string {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return "";
  if (days < 0) return "просрочен";
  if (days === 0) return "истекает сегодня";
  if (days === 1) return "истекает завтра";
  if (days <= 3) return `истекает через ${days} дн.`;
  return `ещё ${days} дн.`;
}

export function InventoryPage() {
  const [tab, setTab] = useState<"fridge" | "freezer" | "pantry">("fridge");
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [scanResult, setScanResult] = useState<{
    found: boolean;
    name?: string;
    brand?: string;
    packageQuantity?: string | null;
    packageUnit?: string | null;
    barcode: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: allItems = [], isLoading } = trpc.inventory.list.useQuery();

  const remove = trpc.inventory.remove.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
  });

  // Фильтр по табу
  const items = allItems.filter((i) => i.storageType === tab);

  // Скоро истекает (<=2 дней) для текущего таба
  const expiring = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days !== null && days <= 2;
  });

  // Остальные (не истекающие)
  const normal = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days === null || days > 2;
  });

  // Группировка по категории
  const grouped = normal.reduce<Record<string, typeof normal>>((acc, item) => {
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink">
          Инвентарь
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => barcodeInputRef.current?.click()}
            className="w-10 h-10 rounded-lg border border-line bg-paper text-ink-soft flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
            aria-label="Сканировать штрих-код"
            title="Сфотографировать штрих-код"
          >
            <ScanLine size={20} />
          </button>
          <input
            ref={barcodeInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setScanError(null);
              try {
                const reader = new BrowserMultiFormatReader();
                const img = document.createElement("img");
                const url = URL.createObjectURL(file);
                img.src = url;
                await new Promise((resolve) => { img.onload = resolve; });
                const result = await reader.decodeFromImageElement(img);
                URL.revokeObjectURL(url);
                if (result) {
                  setScanResult({ found: false, barcode: result.getText() });
                } else {
                  setScanError("Штрих-код не распознан. Попробуй сфотографировать ближе и ровнее.");
                }
              } catch {
                setScanError("Штрих-код не распознан на фото. Попробуй ещё раз — ближе, без бликов.");
              }
            }}
          />
          <button
            onClick={() => setShowAdd(true)}
            className="w-10 h-10 rounded-lg bg-primary text-paper flex items-center justify-center hover:bg-primary-dark transition-colors"
            aria-label="Добавить продукт"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Табы */}
      <div className="flex gap-1 bg-cream rounded-lg p-1 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-paper text-primary shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={18} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Скоро истекает */}
          {expiring.length > 0 && (
            <section className="mb-6">
              <h3 className="text-xs font-medium text-warning uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={14} />
                Скоро истекает
              </h3>
              <ul className="space-y-1">
                {expiring.map((item) => {
                  const days = daysUntilExpiry(item.expiryDate);
                  const isExpired = days !== null && days < 0;
                  return (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 border ${
                        isExpired
                          ? "bg-alert/5 border-alert/30"
                          : "bg-warning/5 border-warning/30"
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isExpired ? "bg-alert" : "bg-warning"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {item.productName}
                          {item.quantity && (
                            <span className="text-ink-muted ml-1">
                              {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                            </span>
                          )}
                        </p>
                        <p
                          className={`text-xs ${
                            isExpired ? "text-alert" : "text-warning"
                          }`}
                        >
                          {expiryText(item.expiryDate)}
                        </p>
                      </div>
                      <button
                        onClick={() => remove.mutate({ id: item.id })}
                        className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-alert transition-colors shrink-0"
                        aria-label="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Основной список */}
          {items.length === 0 ? (
            <div className="bg-paper border border-line border-dashed rounded-2xl p-8 text-center">
              <Refrigerator
                size={32}
                className="text-line-strong mx-auto mb-3"
                strokeWidth={1.5}
              />
              <p className="text-ink-soft text-sm">
                Пусто. Добавьте продукты кнопкой [+] сверху.
              </p>
            </div>
          ) : normal.length > 0 ? (
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {item.productName}
                            {item.quantity && (
                              <span className="text-ink-muted ml-1">
                                {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                              </span>
                            )}
                          </p>
                          {item.expiryDate && (
                            <p className="text-xs text-ink-muted">
                              {expiryText(item.expiryDate)}
                            </p>
                          )}
                        </div>
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
          ) : null}
        </>
      )}

      {/* Диалог добавления */}
      {showAdd && (
        <AddInventoryDialog
          storageType={tab}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Ошибка сканирования */}
      {scanError && (
        <p className="text-sm text-alert bg-paper border border-alert rounded-lg p-3 mx-4 -mt-4">
          {scanError}
        </p>
      )}

      {/* Результат сканирования */}
      {scanResult && (
        <ScanResultDialog
          barcode={scanResult.barcode}
          storageType={tab}
          onClose={() => setScanResult(null)}
        />
      )}
    </div>
  );
}

// --- Диалог добавления ---

function AddInventoryDialog({
  storageType,
  onClose,
}: {
  storageType: "fridge" | "freezer" | "pantry";
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const utils = trpc.useUtils();

  const add = trpc.inventory.add.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    add.mutate({
      productName: name.trim(),
      quantity: quantity ? Number(quantity) : null,
      unit: unit.trim() || null,
      storageType,
      expiryDate: expiryDate || null,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-paper w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-semibold text-ink mb-4">
          Добавить продукт
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название продукта"
            autoFocus
            required
            className="w-full h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Кол-во"
              step="any"
              min="0"
              className="flex-1 h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ед. (кг, л, шт)"
              className="w-28 h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
            />
          </div>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
          />
          <p className="text-xs text-ink-muted">Срок годности (необязательно)</p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim() || add.isPending}
              className="flex-1 h-12 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



// --- Диалог результата сканирования штрих-кода ---

function ScanResultDialog({
  barcode,
  storageType,
  onClose,
}: {
  barcode: string;
  storageType: "fridge" | "freezer" | "pantry";
  onClose: () => void;
}) {
  const [expiryDate, setExpiryDate] = useState("");
  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState("");
  const [customUnit, setCustomUnit] = useState("");

  const utils = trpc.useUtils();

  // Ищем товар по штрих-коду в каталоге products
  const lookup = trpc.products.getByBarcode.useQuery(
    { barcode },
    { retry: false },
  );

  const add = trpc.inventory.add.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
    },
  });

  const product = lookup.data;
  const notFound = lookup.isError || (lookup.isSuccess && !product);
  const isLoading = lookup.isLoading;

  const handleAdd = () => {
    if (product) {
      add.mutate({
        productName: product.brand
          ? `${product.brand} ${product.nameRu}`
          : product.nameRu,
        quantity: product.packageQuantity
          ? Number(product.packageQuantity)
          : null,
        unit: product.packageUnit || null,
        storageType,
        expiryDate: expiryDate || null,
      });
    } else if (customName.trim()) {
      add.mutate({
        productName: customName.trim(),
        quantity: customQty ? Number(customQty) : null,
        unit: customUnit.trim() || null,
        storageType,
        expiryDate: expiryDate || null,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-paper w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={28} className="animate-spin text-primary" />
            <span className="ml-3 text-ink-soft">Ищу товар…</span>
          </div>
        )}

        {product && !isLoading && (
          <>
            <h3 className="font-serif text-lg font-semibold text-ink mb-1">
              Товар найден
            </h3>
            <p className="text-sm text-ink mb-1">
              <span className="font-medium">
                {product.brand
                  ? `${product.brand} ${product.nameRu}`
                  : product.nameRu}
              </span>
            </p>
            {(product.packageQuantity || product.packageUnit) && (
              <p className="text-xs text-ink-muted mb-3">
                {product.packageQuantity} {product.packageUnit}
              </p>
            )}
            <p className="text-xs text-ink-muted mb-3">
              Штрих-код: {barcode}
            </p>
            <label className="block mb-4">
              <span className="block text-xs text-ink-soft mb-1">
                Срок годности (необязательно)
              </span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={add.isPending}
                className="flex-1 h-12 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {add.isPending ? "Добавляю…" : "В инвентарь"}
              </button>
            </div>
          </>
        )}

        {notFound && !isLoading && (
          <>
            <h3 className="font-serif text-lg font-semibold text-ink mb-2">
              Товар не найден в каталоге
            </h3>
            <p className="text-xs text-ink-muted mb-3">
              Штрих-код: {barcode}. Добавьте вручную:
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Название продукта"
                autoFocus
                className="w-full h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  placeholder="Кол-во"
                  step="any"
                  min="0"
                  className="flex-1 h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Ед."
                  className="w-24 h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
                />
              </div>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-12 px-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-ink-muted">Срок годности (необязательно)</p>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!customName.trim() || add.isPending}
                className="flex-1 h-12 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {add.isPending ? "Добавляю…" : "Добавить"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
