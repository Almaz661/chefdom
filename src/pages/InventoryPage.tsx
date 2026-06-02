import { useState, FormEvent } from "react";
import {
  Refrigerator,
  Snowflake,
  Package,
  Plus,
  ScanLine,
  Trash2,
  Pencil,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { getProductImageSrc } from "../utils/productImages";

const TABS = [
  { key: "fridge" as const, label: "Холодильник", emoji: "\u{1F9CA}", icon: Refrigerator },
  { key: "freezer" as const, label: "Морозилка", emoji: "\u2744\uFE0F", icon: Snowflake },
  { key: "pantry" as const, label: "Кладовая", emoji: "\u{1F4E6}", icon: Package },
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
  if (days === null) return "Срок не указан";
  if (days < 0) return "Просрочен";
  if (days === 0) return "Истекает сегодня";
  if (days === 1) return "Истекает завтра";
  return `Истекает через ${days} дн.`;
}

/** Цвет статуса по дням */
function expiryColor(expiryDate: string | null): string {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return "text-[#a0a9b8]"; // серый
  if (days <= 1) return "text-[#ef4444] font-semibold"; // красный
  if (days <= 3) return "text-[#f59e0b]"; // жёлтый
  return "text-[#4ade80]"; // зелёный (15+ но даже 4+ дня тоже зелёный)
}

/** Склонение "продуктов" */
function pluralProducts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} продукт`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} продукта`;
  return `${n} продуктов`;
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
      className="h-10 px-3 rounded-lg border border-[#3a4558] bg-[#232b3b] text-[#a0a9b8] text-xs font-medium hover:border-[#d4a574] hover:text-[#d4a574] transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
  const [editItem, setEditItem] = useState<number | null>(null);
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

  // Универсальный тип карточки
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

  const handleRemove = (it: ViewItem) => {
    if (it.source === "preserve") {
      removePreserve.mutate({ id: it.id });
    } else {
      remove.mutate({ id: it.id });
    }
  };

  // Алерт: товары с expiryDate <= 3 дня (фиксированный порог для алерта)
  const alertItems = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days !== null && days <= 3;
  });

  // Скоро истекает (<=expiryPeriod дней) для раздела «все сроки»
  const expiring = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days !== null && days <= expiryPeriod;
  });

  const normal = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days === null || days > expiryPeriod;
  });

  const allWithExpiry = items
    .filter((i) => i.expiryDate !== null)
    .sort((a, b) => {
      const dA = daysUntilExpiry(a.expiryDate) ?? 9999;
      const dB = daysUntilExpiry(b.expiryDate) ?? 9999;
      return dA - dB;
    });

  // Группировка: «Заготовки» — отдельная секция внизу (только freezer)
  const normalWithoutPreserves = normal.filter(i => i.category !== "Заготовки");
  const preserveItems = normal.filter(i => i.category === "Заготовки");

  const grouped = normalWithoutPreserves.reduce<Record<string, ViewItem[]>>((acc, item) => {
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

  const atmosphereClass = tab === "freezer" ? "atmosphere-freezer" : tab === "pantry" ? "atmosphere-pantry" : "atmosphere-fridge";

  const currentTab = TABS.find(t => t.key === tab)!;

  return (
    <div className={`max-w-2xl mx-auto px-5 py-8 lg:py-12 min-h-screen ${atmosphereClass}`}>
      {/* Заголовок */}
      <div className="mb-6 depth-front">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-serif text-[32px] font-bold text-white">
            Инвентарь
          </h1>
          <div className="flex gap-1.5">
            <RecalcExpiryButton />
            <button
              onClick={() => setShowScanner(!showScanner)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                showScanner ? "border-[#d4a574] text-[#d4a574]" : "border-[#3a4558] text-[#a0a9b8] hover:border-[#d4a574] hover:text-[#d4a574]"
              }`}
              aria-label="Сканировать штрих-код"
            >
              <ScanLine size={16} />
            </button>
          </div>
        </div>
        {/* Изменение 6: Подтекст */}
        <p className="text-sm text-[#a0a9b8]">
          {currentTab.label} • {pluralProducts(items.length)}
        </p>
      </div>

      {/* Сканер */}
      {showScanner && (
        <div className="mb-4 bg-[#232b3b] border border-[#3a4558] rounded-xl p-4">
          <BarcodeScanner onDetected={(code) => {
            setScanResult({ found: false, barcode: code });
            setShowScanner(false);
          }} />
        </div>
      )}

      {/* Изменение 1: Вкладки с иконками + золотистое подчеркивание */}
      <div className="flex border-b border-[#3a4558] mb-6">
        {TABS.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
              tab === key
                ? "text-white"
                : "text-[#a0a9b8] hover:text-[#d4a574]"
            }`}
          >
            <span className="text-base">{emoji}</span>
            <span className="hidden sm:inline">{label}</span>
            {tab === key && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#d4a574]" />
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#d4a574]" />
        </div>
      ) : (
        <>
          {/* Изменение 4: Алерт — фиксированный, если есть товары ≤ 3 дня */}
          {alertItems.length > 0 && (
            <section className="mb-6 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
              <h3 className="text-xs font-semibold text-[#ef4444] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Использовать в ближайшие 3 дня
              </h3>
              <ul className="divide-y divide-[#ef4444]/20">
                {alertItems.map((item) => (
                  <li key={`alert-${item.source}-${item.id}`} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <span className="text-sm text-white truncate">
                      {item.productName}
                      {item.quantity && (
                        <span className="text-[#a0a9b8] ml-1 text-xs">
                          {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                        </span>
                      )}
                    </span>
                    <span className={`text-xs shrink-0 ml-2 ${expiryColor(item.expiryDate)}`}>
                      {expiryText(item.expiryDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Изменение 5: Кнопка добавления — 100% ширина, 48px, золотистая */}
          <button
            onClick={() => setShowAdd(true)}
            className="w-full h-12 rounded-lg bg-[#d4a574] text-white text-sm font-semibold flex items-center justify-center gap-2 mb-6 hover:bg-[#c99d63] hover:shadow-[0_4px_12px_rgba(212,165,116,0.3)] active:bg-[#b88d53] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] transition-all"
          >
            <Plus size={18} />
            Добавить продукт
          </button>

          {/* Пустое состояние */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-5xl mb-4">{currentTab.emoji}</span>
              <p className="text-lg font-semibold text-white mb-1">
                {currentTab.label} пуст{tab === "pantry" ? "а" : tab === "freezer" ? "а" : ""}
              </p>
              <p className="text-sm text-[#a0a9b8] mb-6">
                Добавьте первый продукт
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="h-12 px-8 rounded-lg bg-[#d4a574] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#c99d63] transition-colors"
              >
                <Plus size={18} />
                Добавить продукт
              </button>
              {tab === "freezer" && (
                <p className="text-[#a0a9b8] text-xs mt-4 max-w-xs">
                  Котлеты, фарш, ягоды и другие заморозки удобнее заводить
                  через{" "}
                  <Link to="/preserves" className="text-[#d4a574] underline">
                    Заготовки
                  </Link>
                  {" "} — срок подставится автоматически.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Все карточки по категориям — показываем ВСЕ продукты */}
              {(() => {
                // Группируем ВСЕ items (не только normal) кроме заготовок
                const allWithoutPreserves = items.filter(i => i.category !== "Заготовки");
                const allPreserveItems = items.filter(i => i.category === "Заготовки");
                const allGrouped = allWithoutPreserves.reduce<Record<string, ViewItem[]>>((acc, item) => {
                  const cat = item.category || "Без категории";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {});
                const allCategories = Object.keys(allGrouped).sort((a, b) => {
                  if (a === "Без категории") return 1;
                  if (b === "Без категории") return -1;
                  return a.localeCompare(b, "ru");
                });

                return (
                  <>
                    {allCategories.map((cat) => (
                      <section key={cat}>
                        <h3 className="text-xs font-medium text-[#a0a9b8] uppercase tracking-wider mb-2">
                          {cat}
                        </h3>
                        <ul className="space-y-3">
                          {allGrouped[cat].map((item) => (
                            <InventoryCard
                              key={`${item.source}-${item.id}`}
                              item={item}
                              tabEmoji={currentTab.emoji}
                              onRemove={() => handleRemove(item)}
                              onEdit={() => setEditItem(item.id)}
                              onToggleBasic={() => toggleBasic.mutate({ id: item.id, isBasic: !item.isBasic })}
                            />
                          ))}
                        </ul>
                      </section>
                    ))}

                    {/* Группа «Заготовки» в Морозилке — отдельная секция */}
                    {tab === "freezer" && allPreserveItems.length > 0 && (
                      <section className="pt-6 border-t border-[#3a4558]">
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span>❄️</span> Заготовки
                          <Link
                            to="/preserves"
                            className="ml-auto text-xs text-[#d4a574] normal-case font-normal tracking-normal"
                          >
                            в раздел →
                          </Link>
                        </h3>
                        <ul className="space-y-3">
                          {allPreserveItems.map((item) => (
                            <InventoryCard
                              key={`${item.source}-${item.id}`}
                              item={item}
                              tabEmoji="❄️"
                              onRemove={() => handleRemove(item)}
                              onEdit={() => {}}
                              onToggleBasic={() => {}}
                              isPreserve
                            />
                          ))}
                        </ul>
                      </section>
                    )}
                  </>
                );
              })()}
            </div>
          )}
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
        <p className="text-sm text-[#ef4444] bg-[#232b3b] border border-[#ef4444] rounded-lg p-3 mx-4 -mt-4">
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

// ─── Изменение 2+3: Карточка продукта ───

function InventoryCard({
  item,
  tabEmoji,
  onRemove,
  onEdit,
  onToggleBasic,
  isPreserve = false,
}: {
  item: {
    id: number;
    source: "inventory" | "preserve";
    productName: string;
    quantity: string | null;
    unit: string | null;
    expiryDate: string | null;
    minQuantity: string | null;
    isBasic: boolean;
  };
  tabEmoji: string;
  onRemove: () => void;
  onEdit: () => void;
  onToggleBasic: () => void;
  isPreserve?: boolean;
}) {
  const imgSrc = getProductImageSrc(item.productName);

  return (
    <li className="rounded-lg border border-[#3a4558] bg-[#232b3b] p-4 hover:border-[#4a5568] transition-colors item-card animate-reveal">
      {/* Шапка: иконка + название + кнопки */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={item.productName}
              width={64}
              height={64}
              className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[#1a1f2e]"
            />
          ) : (
            <span className="text-lg shrink-0">{tabEmoji}</span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {item.isBasic && (
                <span className="text-xs text-[#d4a574] mr-1" title="Базовый продукт">📌</span>
              )}
              {item.productName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.source === "inventory" && !isPreserve && (
            <button
              onClick={onToggleBasic}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-xs ${
                item.isBasic
                  ? "text-[#d4a574] bg-[#d4a574]/10"
                  : "text-[#a0a9b8] hover:text-[#d4a574]"
              }`}
              title={item.isBasic ? "Убрать из базовых" : "Базовый (не в покупки)"}
            >
              📌
            </button>
          )}
          {item.source === "inventory" && !isPreserve && (
            <button
              onClick={onEdit}
              className="w-7 h-7 flex items-center justify-center text-[#a0a9b8] hover:text-[#d4a574] transition-colors rounded"
              aria-label="Редактировать"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center text-[#a0a9b8] hover:text-[#ef4444] transition-colors rounded"
            aria-label="Удалить"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Количество */}
      {item.quantity && (
        <p className="text-xs text-[#a0a9b8] mt-1.5 ml-8">
          {item.quantity}{item.unit ? ` ${item.unit}` : ""}
          {item.minQuantity && (
            <span className="text-[#d4a574]/70 ml-2">(мин: {item.minQuantity})</span>
          )}
        </p>
      )}

      {/* Изменение 3: Статус срока — цветной текст */}
      <p className={`text-xs mt-1 ml-8 ${expiryColor(item.expiryDate)}`}>
        {expiryText(item.expiryDate)}
        {item.expiryDate && daysUntilExpiry(item.expiryDate) !== null && (
          <span className="text-[#a0a9b8] ml-1.5">
            ({new Date(item.expiryDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })})
          </span>
        )}
        {isPreserve && (
          <span className="text-[#a0a9b8] ml-1.5">· заготовка</span>
        )}
      </p>
    </li>
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
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#232b3b] w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 border border-[#3a4558]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-semibold text-white mb-4">
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
            className="w-full h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white placeholder:text-[#a0a9b8] focus:outline-none focus:border-[#d4a574]"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Кол-во"
              step="any"
              min="0"
              className="flex-1 h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white placeholder:text-[#a0a9b8] focus:outline-none focus:border-[#d4a574]"
            />
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ед. (кг, л, шт)"
              className="w-28 h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white placeholder:text-[#a0a9b8] focus:outline-none focus:border-[#d4a574]"
            />
          </div>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white focus:outline-none focus:border-[#d4a574]"
          />
          <p className="text-xs text-[#a0a9b8]">Срок годности (необязательно)</p>
          <input
            type="number"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            placeholder="Мин. остаток (авто-докупка)"
            step="any"
            min="0"
            className="w-full h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white placeholder:text-[#a0a9b8] focus:outline-none focus:border-[#d4a574]"
          />
          <p className="text-xs text-[#a0a9b8]">Когда остаток ниже — автоматически в покупки</p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-lg border border-[#3a4558] text-[#a0a9b8] font-medium hover:bg-[#2a3548] transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim() || add.isPending}
              className="flex-1 h-12 rounded-lg bg-[#d4a574] text-white font-medium hover:bg-[#c99d63] disabled:opacity-50 transition-colors"
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
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#232b3b] w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 border border-[#3a4558]"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={28} className="animate-spin text-[#d4a574]" />
            <span className="ml-3 text-[#a0a9b8]">Ищу товар…</span>
          </div>
        )}

        {product && !isLoading && (
          <>
            <h3 className="font-serif text-lg font-semibold text-white mb-1">
              Товар найден
            </h3>
            <p className="text-sm text-white mb-1">
              <span className="font-medium">
                {product.brand
                  ? `${product.brand} ${product.nameRu}`
                  : product.nameRu}
              </span>
            </p>
            {(product.packageQuantity || product.packageUnit) && (
              <p className="text-xs text-[#a0a9b8] mb-3">
                {product.packageQuantity} {product.packageUnit}
              </p>
            )}
            <p className="text-xs text-[#a0a9b8] mb-3">
              Штрих-код: {barcode}
            </p>
            <fieldset className="mb-3">
              <legend className="block text-xs text-[#a0a9b8] mb-1">Куда положить?</legend>
              <div className="inline-flex bg-[#1a1f2e] rounded-lg p-0.5 w-full">
                {STORAGE_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStorageType(key)}
                    className={`flex-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${
                      storageType === key
                        ? "bg-[#d4a574] text-white"
                        : "text-[#a0a9b8] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block mb-4">
              <span className="block text-xs text-[#a0a9b8] mb-1">
                Срок годности (необязательно)
              </span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white focus:outline-none focus:border-[#d4a574]"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-lg border border-[#3a4558] text-[#a0a9b8] font-medium hover:bg-[#2a3548] transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={add.isPending}
                className="flex-1 h-12 rounded-lg bg-[#d4a574] text-white font-medium hover:bg-[#c99d63] disabled:opacity-50 transition-colors"
              >
                {add.isPending ? "Добавляю…" : "В инвентарь"}
              </button>
            </div>
          </>
        )}

        {notFound && !isLoading && (
          <>
            <h3 className="font-serif text-lg font-semibold text-white mb-2">
              Товар не найден в каталоге
            </h3>
            <p className="text-xs text-[#a0a9b8] mb-3">
              Штрих-код: {barcode}. Добавьте вручную:
            </p>
            <div className="space-y-3">
              <fieldset>
                <legend className="block text-xs text-[#a0a9b8] mb-1">Куда положить?</legend>
                <div className="inline-flex bg-[#1a1f2e] rounded-lg p-0.5 w-full">
                  {STORAGE_OPTIONS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStorageType(key)}
                      className={`flex-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${
                        storageType === key
                          ? "bg-[#d4a574] text-white"
                          : "text-[#a0a9b8] hover:text-white"
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
                className="w-full h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white placeholder:text-[#a0a9b8] focus:outline-none focus:border-[#d4a574]"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  placeholder="Кол-во"
                  step="any"
                  min="0"
                  className="flex-1 h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white placeholder:text-[#a0a9b8] focus:outline-none focus:border-[#d4a574]"
                />
                <input
                  type="text"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Ед."
                  className="w-24 h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white placeholder:text-[#a0a9b8] focus:outline-none focus:border-[#d4a574]"
                />
              </div>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-12 px-4 bg-[#1a1f2e] border border-[#3a4558] rounded-lg text-white focus:outline-none focus:border-[#d4a574]"
              />
              <p className="text-xs text-[#a0a9b8]">Срок годности (необязательно)</p>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-lg border border-[#3a4558] text-[#a0a9b8] font-medium hover:bg-[#2a3548] transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!customName.trim() || add.isPending}
                className="flex-1 h-12 rounded-lg bg-[#d4a574] text-white font-medium hover:bg-[#c99d63] disabled:opacity-50 transition-colors"
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
