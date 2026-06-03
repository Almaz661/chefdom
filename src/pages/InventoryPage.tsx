import { useState, FormEvent } from "react";
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
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { getProductImageSrc } from "../utils/productImages";

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
  if (days <= 7) return `через ${days} дн.`;
  if (days <= 30) return `через ${days} дн.`;
  return `ещё ${days} дн.`;
}

const EXPIRY_PERIODS = [
  { key: 3, label: "3 дня" },
  { key: 7, label: "7 дней" },
  { key: 14, label: "14 дней" },
  { key: 30, label: "30 дней" },
] as const;

// Кнопка «Пересчитать сроки» — проставляет сроки всем продуктам без даты
function RecalcExpiryButton() {
  const utils = trpc.useUtils();
  const recalc = trpc.inventory.recalcExpiry.useMutation({
    onSuccess: (data) => {
      utils.inventory.list.invalidate();
      if (data.updated > 0) {
        alert(`Готово! Проставлено сроков: ${data.updated} из ${data.total} продуктов без даты.`);
      } else {
        alert('У всех продуктов уже есть сроки, или не нашлось совпадений в справочнике.');
      }
    },
  });

  return (
    <button
      onClick={() => {
        if (confirm('Проставить сроки годности всем продуктам без даты?')) {
          recalc.mutate();
        }
      }}
      disabled={recalc.isPending}
      className="h-10 px-3 rounded-lg border border-line bg-paper text-ink-soft text-xs font-medium hover:border-primary hover:text-primary transition-colors disabled:opacity-50 flex items-center gap-1.5"
      title="Пересчитать сроки годности из справочника"
    >
      {recalc.isPending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <span>📅</span>
      )}
      <span className="hidden sm:inline">{recalc.isPending ? 'Считаю…' : 'Сроки'}</span>
    </button>
  );
}

export function InventoryPage() {
  const [tab, setTab] = useState<"fridge" | "freezer" | "pantry">("fridge");
  const [showAdd, setShowAdd] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [expiryPeriod, setExpiryPeriod] = useState<number>(3);
  const [showAllExpiry, setShowAllExpiry] = useState(false);
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
  // Заготовки frozen физически лежат в морозилке — показываем их во
  // вкладке «Морозилка» вместе с обычными продуктами. Остальные типы
  // заготовок (preserved, opened) остаются только на странице /preserves.
  const { data: allPreserves = [] } = trpc.preserves.list.useQuery();

  const remove = trpc.inventory.remove.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
  });
  const removePreserve = trpc.preserves.remove.useMutation({
    onSuccess: () => utils.preserves.list.invalidate(),
  });
  const toggleBasic = trpc.inventory.update.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
  });

  // Универсальный тип карточки в списке. source различает обычный
  // инвентарь и заготовку — кнопка «Удалить» использует разный мутатор.
  type ViewItem = {
    id: number;
    source: "inventory" | "preserve";
    productName: string;
    quantity: string | null;
    unit: string | null;
    expiryDate: string | null;
    category: string | null;
    minQuantity: string | null;
    isBasic: boolean;
  };

  // Преобразуем оба источника к общему виду.
  const inventoryView: ViewItem[] = allItems
    .filter((i) => i.storageType === tab)
    .map((i) => ({
      id: i.id,
      source: "inventory" as const,
      productName: i.productName,
      quantity: i.quantity,
      unit: i.unit,
      expiryDate: i.expiryDate,
      category: i.category,
      minQuantity: i.minQuantity ?? null,
      isBasic: (i as any).isBasic === 1,
    }));

  // Заготовки frozen добавляем только во вкладке «Морозилка».
  const preservesView: ViewItem[] =
    tab === "freezer"
      ? allPreserves
          .filter((p) => p.preserveType === "frozen")
          .map((p) => ({
            id: p.id,
            source: "preserve" as const,
            productName: p.name,
            quantity: p.quantity,
            unit: p.unit,
            expiryDate: p.expiryDate,
            category: "Заготовки",
            minQuantity: null,
            isBasic: false,
          }))
      : [];

  const items: ViewItem[] = [...inventoryView, ...preservesView];

  // Удаление зависит от источника — выбираем нужный мутатор.
  const handleRemove = (it: ViewItem) => {
    if (it.source === "preserve") {
      removePreserve.mutate({ id: it.id });
    } else {
      remove.mutate({ id: it.id });
    }
  };

  // Скоро истекает (<=expiryPeriod дней) для текущего таба
  const expiring = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days !== null && days <= expiryPeriod;
  });

  // Остальные (не истекающие)
  const normal = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days === null || days > expiryPeriod;
  });

  // Все продукты со сроками — для вкладки «Все сроки»
  const allWithExpiry = items
    .filter((i) => i.expiryDate !== null)
    .sort((a, b) => {
      const dA = daysUntilExpiry(a.expiryDate) ?? 9999;
      const dB = daysUntilExpiry(b.expiryDate) ?? 9999;
      return dA - dB;
    });

  // Группировка по категории
  const grouped = normal.reduce<Record<string, typeof normal>>((acc, item) => {
    const cat = item.category || "Без категории";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort((a, b) => {
    // «Заготовки» всегда наверху, «Без категории» — внизу.
    if (a === "Заготовки") return -1;
    if (b === "Заготовки") return 1;
    if (a === "Без категории") return 1;
    if (b === "Без категории") return -1;
    return a.localeCompare(b, "ru");
  });

  const atmosphereClass = tab === "freezer" ? "atmosphere-freezer" : tab === "pantry" ? "atmosphere-pantry" : "atmosphere-fridge";

  return (
    <div className={`max-w-2xl mx-auto px-5 py-8 lg:py-12 min-h-screen ${atmosphereClass}`}>
      <div className="flex items-center justify-between mb-8 depth-front">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Инвентарь
        </h1>
        <div className="flex gap-1.5">
          <RecalcExpiryButton />
          <button
            onClick={() => setShowScanner(!showScanner)}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
              showScanner ? "border-primary text-primary" : "border-line text-ink-muted hover:border-primary/40 hover:text-primary"
            }`}
            aria-label="Сканировать штрих-код"
          >
            <ScanLine size={16} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-lg bg-primary text-cream flex items-center justify-center hover:bg-primary-dark transition-colors"
            aria-label="Добавить продукт"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Сканер (показывается по нажатию кнопки ScanLine) */}
      {showScanner && (
        <div className="mb-4 bg-paper border border-line rounded-xl p-4">
          <BarcodeScanner onDetected={(code) => {
            setScanResult({ found: false, barcode: code });
            setShowScanner(false);
          }} />
        </div>
      )}

      {/* Табы */}
      <div className="flex gap-px mb-8">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              tab === key
                ? "bg-surface-elevated text-primary border border-line"
                : "text-ink-muted hover:text-ink-soft"
            }`}
          >
            <Icon size={15} strokeWidth={1.5} />
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
          {/* Скоро истекает — с переключателем периода */}
          {expiring.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-warning uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={14} />
                  Истекает в ближайшие
                </h3>
                <div className="flex gap-1">
                  {EXPIRY_PERIODS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setExpiryPeriod(key)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        expiryPeriod === key
                          ? "bg-warning text-paper"
                          : "bg-surface-elevated text-ink-muted hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-1">
                {expiring.map((item) => {
                  const days = daysUntilExpiry(item.expiryDate);
                  const isExpired = days !== null && days < 0;
                  const imgSrc = getProductImageSrc(item.productName);
                  return (
                    <li
                      key={`${item.source}-${item.id}`}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 border item-card animate-reveal ${
                        isExpired
                          ? "bg-alert/5 border-alert/30"
                          : "bg-warning/5 border-warning/30"
                      }`}
                    >
                      {/* Фото продукта 64×64 */}
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={item.productName}
                          width={64}
                          height={64}
                          className="w-12 h-12 rounded-lg object-cover shrink-0 bg-surface-elevated"
                        />
                      ) : (
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isExpired ? "bg-alert" : "bg-warning"
                          }`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {item.source === "preserve" && (
                            <Snowflake
                              size={12}
                              className="inline-block mr-1 text-cool align-text-bottom"
                            />
                          )}
                          {item.productName}
                          {item.quantity && (
                            <span className="text-ink-muted ml-1">
                              {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                            </span>
                          )}
                          {item.minQuantity && (
                            <span className="text-xs text-primary/70 ml-1.5" title="Мин. остаток для авто-докупки">
                              (мин: {item.minQuantity})
                            </span>
                          )}
                        </p>
                        <p
                          className={`text-xs ${
                            isExpired ? "text-alert" : "text-warning"
                          }`}
                        >
                          {expiryText(item.expiryDate)}
                          {item.expiryDate && (
                            <span className="text-ink-muted ml-1">
                              ({new Date(item.expiryDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })})
                            </span>
                          )}
                          {item.source === "preserve" && (
                            <span className="text-ink-muted"> · из заготовок</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(item)}
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

          {/* Кнопка «Все сроки» */}
          {allWithExpiry.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowAllExpiry(!showAllExpiry)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  showAllExpiry
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-line bg-paper text-ink-soft hover:border-primary hover:text-primary"
                }`}
              >
                <span className="text-sm font-medium">
                  📋 Все сроки годности ({allWithExpiry.length})
                </span>
                <span className="text-xs">
                  {showAllExpiry ? "свернуть" : "показать"}
                </span>
              </button>

              {showAllExpiry && (
                <ul className="space-y-1 mt-2">
                  {allWithExpiry.map((item) => {
                    const days = daysUntilExpiry(item.expiryDate);
                    const isExpired = days !== null && days < 0;
                    const isSoon = days !== null && days <= expiryPeriod;
                    return (
                      <li
                        key={`exp-${item.source}-${item.id}`}
                        className={`flex items-center gap-3 rounded-lg px-4 py-2.5 border ${
                          isExpired
                            ? "bg-alert/5 border-alert/30"
                            : isSoon
                            ? "bg-warning/5 border-warning/30"
                            : "bg-paper border-line"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isExpired
                              ? "bg-alert"
                              : isSoon
                              ? "bg-warning"
                              : "bg-primary/40"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink truncate">
                            {item.productName}
                            {item.quantity && (
                              <span className="text-ink-muted ml-1 text-xs">
                                {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-medium ${
                            isExpired ? "text-alert" : isSoon ? "text-warning" : "text-ink-muted"
                          }`}>
                            {item.expiryDate && new Date(item.expiryDate).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <p className={`text-xs ${
                            isExpired ? "text-alert" : isSoon ? "text-warning" : "text-ink-muted"
                          }`}>
                            {expiryText(item.expiryDate)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
              {tab === "freezer" && (
                <p className="text-ink-soft text-xs mt-2">
                  Котлеты, фарш, ягоды и другие заморозки удобнее заводить
                  через раздел{" "}
                  <Link
                    to="/preserves"
                    className="text-primary underline"
                  >
                    Заготовки
                  </Link>
                  {" "}— срок хранения подставится автоматически.
                </p>
              )}
            </div>
          ) : normal.length > 0 ? (
            <div className="space-y-5">
              {categories.map((cat) => (
                <section key={cat}>
                  <h3 className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                    {cat === "Заготовки" && (
                      <Snowflake size={12} className="text-cool" />
                    )}
                    {cat}
                    {cat === "Заготовки" && (
                      <Link
                        to="/preserves"
                        className="ml-auto text-primary normal-case font-normal tracking-normal"
                      >
                        в раздел →
                      </Link>
                    )}
                  </h3>
                  <ul className="space-y-1">
                    {grouped[cat].map((item) => {
                      const imgSrc = getProductImageSrc(item.productName);
                      return (
                        <li
                          key={`${item.source}-${item.id}`}
                          className="flex items-center gap-3 rounded-lg px-4 py-3 item-card animate-reveal"
                        >
                          {/* Фото продукта 64×64 */}
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={item.productName}
                              width={64}
                              height={64}
                              className="w-12 h-12 rounded-lg object-cover shrink-0 bg-surface-elevated"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center text-ink-muted text-xl select-none">
                              🛒
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">
                              {item.isBasic && (
                                <span className="text-xs text-primary/70 mr-1" title="Базовый продукт — не попадает в покупки">📌</span>
                              )}
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
                          {item.source === "inventory" && (
                            <button
                              onClick={() => toggleBasic.mutate({ id: item.id, isBasic: !item.isBasic })}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
                                item.isBasic
                                  ? "text-primary bg-primary/10"
                                  : "text-ink-muted hover:text-primary hover:bg-primary/5"
                              }`}
                              title={item.isBasic ? "Убрать из базовых" : "Пометить как базовый (не попадает в покупки)"}
                              aria-label="Базовый продукт"
                            >
                              📌
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(item)}
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
  const [minQuantity, setMinQuantity] = useState("");

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
      minQuantity: minQuantity ? Number(minQuantity) : null,
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
            className="w-full h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Кол-во"
              step="any"
              min="0"
              className="flex-1 h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ед. (кг, л, шт)"
              className="w-28 h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
            />
          </div>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
          />
          <p className="text-xs text-ink-muted">Срок годности (необязательно)</p>
          <input
            type="number"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            placeholder="Мин. остаток (авто-докупка)"
            step="any"
            min="0"
            className="w-full h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
          />
          <p className="text-xs text-ink-muted">Когда остаток ниже — автоматически в покупки</p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-surface-hover transition-colors"
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

const STORAGE_OPTIONS: { key: "fridge" | "freezer" | "pantry"; label: string }[] = [
  { key: "fridge", label: "Холодильник" },
  { key: "freezer", label: "Морозилка" },
  { key: "pantry", label: "Кладовая" },
];

function ScanResultDialog({
  barcode,
  storageType: defaultStorage,
  onClose,
}: {
  barcode: string;
  storageType: "fridge" | "freezer" | "pantry";
  onClose: () => void;
}) {
  const [storageType, setStorageType] = useState<"fridge" | "freezer" | "pantry">(defaultStorage);
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
            <fieldset className="mb-3">
              <legend className="block text-xs text-ink-soft mb-1">Куда положить?</legend>
              <div className="inline-flex bg-surface-elevated rounded-lg p-0.5 w-full">
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
            <label className="block mb-4">
              <span className="block text-xs text-ink-soft mb-1">
                Срок годности (необязательно)
              </span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-surface-hover transition-colors"
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
              <fieldset>
                <legend className="block text-xs text-ink-soft mb-1">Куда положить?</legend>
                <div className="inline-flex bg-surface-elevated rounded-lg p-0.5 w-full">
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
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Название продукта"
                autoFocus
                className="w-full h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  placeholder="Кол-во"
                  step="any"
                  min="0"
                  className="flex-1 h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Ед."
                  className="w-24 h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
                />
              </div>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-ink-muted">Срок годности (необязательно)</p>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-surface-hover transition-colors"
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
