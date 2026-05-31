import { useState, FormEvent } from "react";
import {
  Refrigerator, Snowflake, Package, Plus, ScanLine, Trash2,
  AlertTriangle, Loader2, Clock, ChefHat, TrendingUp, Lightbulb,
} from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc";
import { BarcodeScanner } from "../components/BarcodeScanner";

// ═══ Фото по категориям (Unsplash) ═══
const CATEGORY_PHOTOS: Record<string, string> = {
  "Мясо": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=200&fit=crop",
  "Птица": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=200&fit=crop",
  "Рыба": "https://images.unsplash.com/photo-1510130113-6a4e8f1f9349?w=400&h=200&fit=crop",
  "Молочное": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=200&fit=crop",
  "Овощи": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=200&fit=crop",
  "Фрукты": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=200&fit=crop",
  "Крупы": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=200&fit=crop",
  "Напитки": "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=200&fit=crop",
  "Заготовки": "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=200&fit=crop",
  "Специи": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=200&fit=crop",
  "Хлеб": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=200&fit=crop",
  "Сладости": "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=200&fit=crop",
  "Соусы": "https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400&h=200&fit=crop",
  "Без категории": "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=400&h=200&fit=crop",
};

function getCategoryPhoto(category: string | null): string {
  if (!category) return CATEGORY_PHOTOS["Без категории"];
  for (const [key, url] of Object.entries(CATEGORY_PHOTOS)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return url;
  }
  return CATEGORY_PHOTOS["Без категории"];
}

const TABS = [
  { key: "fridge" as const, label: "Холодильник", icon: Refrigerator },
  { key: "freezer" as const, label: "Морозилка", icon: Snowflake },
  { key: "pantry" as const, label: "Кладовая", icon: Package },
];

function daysUntilExpiry(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.floor((new Date(d+"T00:00:00").getTime()-t.getTime())/86400000);
}

function expiryText(d: string | null): string {
  const days = daysUntilExpiry(d);
  if (days === null) return "";
  if (days < 0) return "просрочен";
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days <= 7) return `${days} дн.`;
  return new Date(d!+"T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function expiryColor(d: string | null): string {
  const days = daysUntilExpiry(d);
  if (days === null) return "text-ink-muted";
  if (days < 0) return "text-alert";
  if (days <= 3) return "text-warning";
  return "text-ink-muted";
}

// Советы по хранению
const STORAGE_TIPS: Record<string, string[]> = {
  fridge: [
    "Храните мясо на нижней полке",
    "Овощи — в отдельном контейнере",
    "Не ставьте горячее в холодильник",
  ],
  freezer: [
    "Подпишите дату заморозки",
    "Не замораживайте повторно",
    "Порционируйте перед заморозкой",
  ],
  pantry: [
    "Храните крупы в герметичных банках",
    "Проверяйте сроки раз в месяц",
    "Новые продукты — назад, старые — вперёд",
  ],
};

export function InventoryPage() {
  const [tab, setTab] = useState<"fridge" | "freezer" | "pantry">("fridge");
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{ barcode: string } | null>(null);

  const utils = trpc.useUtils();
  const { data: allItems = [], isLoading } = trpc.inventory.list.useQuery();
  const { data: allPreserves = [] } = trpc.preserves.list.useQuery();

  const remove = trpc.inventory.remove.useMutation({ onSuccess: () => utils.inventory.list.invalidate() });
  const removePreserve = trpc.preserves.remove.useMutation({ onSuccess: () => utils.preserves.list.invalidate() });
  const toggleBasic = trpc.inventory.update.useMutation({ onSuccess: () => utils.inventory.list.invalidate() });
  const recalc = trpc.inventory.recalcExpiry.useMutation({
    onSuccess: (data) => { utils.inventory.list.invalidate(); alert(data.updated > 0 ? `Проставлено: ${data.updated}` : "Совпадений нет"); },
  });

  type ViewItem = {
    id: number; source: "inventory" | "preserve"; productName: string;
    quantity: string | null; unit: string | null; expiryDate: string | null;
    category: string | null; minQuantity: string | null; isBasic: boolean;
  };

  const inventoryView: ViewItem[] = allItems.filter(i => i.storageType === tab).map(i => ({
    id: i.id, source: "inventory" as const, productName: i.productName,
    quantity: i.quantity, unit: i.unit, expiryDate: i.expiryDate,
    category: i.category, minQuantity: i.minQuantity ?? null, isBasic: (i as any).isBasic === 1,
  }));

  const preservesView: ViewItem[] = tab === "freezer"
    ? allPreserves.filter(p => p.preserveType === "frozen").map(p => ({
        id: p.id, source: "preserve" as const, productName: p.name,
        quantity: p.quantity, unit: p.unit, expiryDate: p.expiryDate,
        category: "Заготовки", minQuantity: null, isBasic: false,
      }))
    : [];

  const items: ViewItem[] = [...inventoryView, ...preservesView];
  const handleRemove = (it: ViewItem) => it.source === "preserve" ? removePreserve.mutate({ id: it.id }) : remove.mutate({ id: it.id });

  // Статистика
  const totalCount = items.length;
  const expiringCount = items.filter(i => { const d = daysUntilExpiry(i.expiryDate); return d !== null && d <= 3; }).length;
  const freshCount = items.filter(i => { const d = daysUntilExpiry(i.expiryDate); return d === null || d > 7; }).length;

  // Группировка по категории
  const grouped = items.reduce<Record<string, ViewItem[]>>((acc, item) => {
    const cat = item.category || "Без категории";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === "Заготовки") return -1; if (b === "Заготовки") return 1;
    if (a === "Без категории") return 1; if (b === "Без категории") return -1;
    return a.localeCompare(b, "ru");
  });

  // Истекающие для правой колонки
  const expiringItems = items
    .filter(i => { const d = daysUntilExpiry(i.expiryDate); return d !== null && d <= 3; })
    .slice(0, 5);

  const atmosphereClass = tab === "freezer" ? "atmosphere-freezer" : tab === "pantry" ? "atmosphere-pantry" : "atmosphere-fridge";

  return (
    <div className={`min-h-screen ${atmosphereClass}`}>
      <div className="max-w-7xl mx-auto px-5 py-8 lg:py-10">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink">Инвентарь</h1>
            <p className="text-ink-muted text-xs mt-1">{TABS.find(t => t.key === tab)?.label} · {totalCount} продуктов</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => recalc.mutate()} disabled={recalc.isPending}
              className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-ink-muted hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50">
              {recalc.isPending ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs">📅</span>}
            </button>
            <button onClick={() => setShowScanner(!showScanner)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${showScanner ? "border-primary text-primary" : "border-line text-ink-muted hover:text-primary hover:border-primary/40"}`}>
              <ScanLine size={16} />
            </button>
            <button onClick={() => setShowAdd(true)}
              className="w-9 h-9 rounded-lg bg-primary text-paper flex items-center justify-center hover:bg-primary-dark transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="flex gap-0 border-b border-line mb-8">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key ? "text-primary border-primary" : "text-ink-muted border-transparent hover:text-ink-soft"
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* ═══ STATISTICS ROW ═══ */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-surface-elevated rounded-xl p-4 border border-line text-center">
            <p className="text-2xl font-bold text-primary">{totalCount}</p>
            <p className="text-[11px] text-ink-muted mt-1">Всего</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-4 border border-line text-center">
            <p className={`text-2xl font-bold ${expiringCount > 0 ? "text-warning" : "text-fresh"}`}>{expiringCount}</p>
            <p className="text-[11px] text-ink-muted mt-1">Истекает</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-4 border border-line text-center">
            <p className="text-2xl font-bold text-fresh">{Math.round(totalCount > 0 ? (freshCount / totalCount) * 100 : 100)}%</p>
            <p className="text-[11px] text-ink-muted mt-1">Свежесть</p>
          </div>
        </div>

        {/* Scanner */}
        {showScanner && (
          <div className="mb-6 rounded-xl border border-line p-4 bg-surface-elevated">
            <BarcodeScanner onDetected={(code) => { setScanResult({ barcode: code }); setShowScanner(false); }} />
          </div>
        )}

        {/* ═══ MAIN LAYOUT: content + sidebar ═══ */}
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-6">

          {/* LEFT: Product categories as cards */}
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-ink-muted" />
              </div>
            ) : items.length === 0 ? (
              <div className="bg-surface-elevated border border-dashed border-line rounded-2xl py-16 text-center">
                <Refrigerator size={32} className="text-ink-muted mx-auto mb-3" strokeWidth={1} />
                <p className="text-ink-muted text-sm">Пусто. Добавьте продукты кнопкой [+]</p>
              </div>
            ) : (
              <div className="space-y-6">
                {categories.map((cat) => (
                  <section key={cat} className="animate-reveal">
                    {/* Category label */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">{cat}</h3>
                      <span className="text-[11px] text-ink-muted">{grouped[cat].length}</span>
                    </div>
                    {/* Products grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {grouped[cat].map((item) => (
                        <div key={`${item.source}-${item.id}`}
                          className="item-card rounded-xl p-3 group relative animate-reveal">
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-sm font-medium text-ink leading-tight line-clamp-2 flex-1">
                              {item.isBasic && <span className="text-primary text-xs mr-1">📌</span>}
                              {item.productName}
                            </p>
                            <button onClick={() => handleRemove(item)}
                              className="w-6 h-6 flex items-center justify-center text-transparent group-hover:text-ink-muted hover:!text-alert transition-colors shrink-0 ml-1">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          {item.quantity && (
                            <p className="text-xs text-ink-soft">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</p>
                          )}
                          {item.expiryDate && (
                            <p className={`text-[11px] mt-1 font-medium ${expiryColor(item.expiryDate)}`}>
                              {expiryText(item.expiryDate)}
                            </p>
                          )}
                          {item.source === "inventory" && (
                            <button onClick={() => toggleBasic.mutate({ id: item.id, isBasic: !item.isBasic })}
                              className={`absolute top-2 right-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ${item.isBasic ? "opacity-100" : ""}`}
                              title={item.isBasic ? "Убрать из базовых" : "Базовый"}>
                              📌
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR — info panel */}
          <aside className="hidden lg:block space-y-5 mt-0">
            {/* Expiring soon */}
            <div className="bg-surface-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-warning" />
                <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Истекает скоро</h4>
              </div>
              {expiringItems.length === 0 ? (
                <p className="text-xs text-ink-muted">Всё свежее!</p>
              ) : (
                <ul className="space-y-2">
                  {expiringItems.map(item => (
                    <li key={`exp-${item.source}-${item.id}`} className="flex items-center justify-between">
                      <span className="text-xs text-ink truncate flex-1">{item.productName}</span>
                      <span className={`text-[11px] font-medium shrink-0 ml-2 ${expiryColor(item.expiryDate)}`}>
                        {expiryText(item.expiryDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Storage tips */}
            <div className="bg-surface-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={14} className="text-primary" />
                <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Советы</h4>
              </div>
              <ul className="space-y-2">
                {STORAGE_TIPS[tab].map((tip, i) => (
                  <li key={i} className="text-xs text-ink-muted flex items-start gap-2">
                    <span className="text-primary/60 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recipe ideas */}
            <div className="bg-surface-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <ChefHat size={14} className="text-primary" />
                <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Идеи</h4>
              </div>
              <Link to="/what-to-cook" className="flex items-center gap-2 text-xs text-primary hover:text-primary-dark transition-colors">
                <span>Что приготовить из имеющегося →</span>
              </Link>
            </div>

            {/* Freshness indicator */}
            <div className="bg-surface-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-fresh" />
                <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Свежесть</h4>
              </div>
              <div className="h-2 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-fresh rounded-full transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? (freshCount / totalCount) * 100 : 100}%` }} />
              </div>
              <p className="text-[11px] text-ink-muted mt-2">
                {freshCount} из {totalCount} продуктов в порядке
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Add dialog */}
      {showAdd && <AddDialog storageType={tab} onClose={() => setShowAdd(false)} />}
      {scanResult && <ScanDialog barcode={scanResult.barcode} storageType={tab} onClose={() => setScanResult(null)} />}
    </div>
  );
}



// ═══ Add Dialog ═══
function AddDialog({ storageType, onClose }: { storageType: "fridge" | "freezer" | "pantry"; onClose: () => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const utils = trpc.useUtils();
  const add = trpc.inventory.add.useMutation({ onSuccess: () => { utils.inventory.list.invalidate(); onClose(); } });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-paper w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 border border-line" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-lg font-semibold text-ink mb-5">Добавить продукт</h3>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!name.trim()) return; add.mutate({ productName: name.trim(), quantity: quantity ? Number(quantity) : null, unit: unit.trim() || null, storageType, expiryDate: expiryDate || null, minQuantity: minQuantity ? Number(minQuantity) : null }); }} className="space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название продукта" autoFocus required
            className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
          <div className="flex gap-2">
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Кол-во" step="any" min="0"
              className="flex-1 h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="кг, л, шт"
              className="w-24 h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
          </div>
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
          <input type="number" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} placeholder="Мин. остаток (авто-докупка)" step="any" min="0"
            className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-lg border border-line text-ink-soft text-sm font-medium hover:bg-surface-hover transition-colors">Отмена</button>
            <button type="submit" disabled={!name.trim() || add.isPending} className="flex-1 h-11 rounded-lg bg-primary text-paper text-sm font-medium disabled:opacity-50 hover:bg-primary-dark transition-colors">Добавить</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══ Scan Dialog ═══
function ScanDialog({ barcode, storageType: defaultStorage, onClose }: { barcode: string; storageType: "fridge" | "freezer" | "pantry"; onClose: () => void }) {
  const [storageType, setStorageType] = useState(defaultStorage);
  const [expiryDate, setExpiryDate] = useState("");
  const [customName, setCustomName] = useState("");
  const utils = trpc.useUtils();
  const lookup = trpc.products.getByBarcode.useQuery({ barcode }, { retry: false });
  const add = trpc.inventory.add.useMutation({ onSuccess: () => { utils.inventory.list.invalidate(); onClose(); } });
  const product = lookup.data;

  const handleAdd = () => {
    const name = product ? (product.brand ? `${product.brand} ${product.nameRu}` : product.nameRu) : customName.trim();
    if (!name) return;
    add.mutate({ productName: name, quantity: product?.packageQuantity ? Number(product.packageQuantity) : null, unit: product?.packageUnit || null, storageType, expiryDate: expiryDate || null });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-paper w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 border border-line" onClick={(e) => e.stopPropagation()}>
        {lookup.isLoading && <div className="py-8 text-center"><Loader2 size={24} className="animate-spin text-primary mx-auto" /></div>}
        {product && !lookup.isLoading && (
          <>
            <p className="text-sm font-medium text-ink mb-3">{product.brand ? `${product.brand} ${product.nameRu}` : product.nameRu}</p>
            <div className="flex gap-1 mb-3">
              {(["fridge", "freezer", "pantry"] as const).map(k => (
                <button key={k} onClick={() => setStorageType(k)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${storageType === k ? "bg-primary text-paper" : "text-ink-muted border border-line"}`}>
                  {k === "fridge" ? "Холодильник" : k === "freezer" ? "Морозилка" : "Кладовая"}
                </button>
              ))}
            </div>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink mb-4 focus:outline-none focus:border-primary" />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-11 rounded-lg border border-line text-ink-soft text-sm font-medium hover:bg-surface-hover transition-colors">Отмена</button>
              <button onClick={handleAdd} disabled={add.isPending} className="flex-1 h-11 rounded-lg bg-primary text-paper text-sm font-medium disabled:opacity-50 hover:bg-primary-dark transition-colors">Добавить</button>
            </div>
          </>
        )}
        {lookup.isError && !lookup.isLoading && (
          <>
            <p className="text-sm text-ink mb-3">Товар не найден. Введите название:</p>
            <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Название" autoFocus
              className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink mb-3 focus:outline-none focus:border-primary" />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-11 rounded-lg border border-line text-ink-soft text-sm font-medium hover:bg-surface-hover transition-colors">Отмена</button>
              <button onClick={handleAdd} disabled={!customName.trim() || add.isPending} className="flex-1 h-11 rounded-lg bg-primary text-paper text-sm font-medium disabled:opacity-50 hover:bg-primary-dark transition-colors">Добавить</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
