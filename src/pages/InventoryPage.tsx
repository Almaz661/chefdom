import { useState, FormEvent } from "react";
import {
  Refrigerator, Snowflake, Package, Plus, ScanLine,
  Trash2, AlertTriangle, Loader2, ChefHat, TrendingUp, Lightbulb,
} from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { getProductImageUrl } from "../utils/productImages";

const TABS = [
  { key: "fridge" as const, label: "Холодильник", icon: Refrigerator },
  { key: "freezer" as const, label: "Морозилка", icon: Snowflake },
  { key: "pantry" as const, label: "Кладовая", icon: Package },
];

function daysUntilExpiry(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.floor((new Date(d + "T00:00:00").getTime() - t.getTime()) / 86400000);
}

function expiryText(d: string | null): string {
  const days = daysUntilExpiry(d);
  if (days === null) return "Срок не указан";
  if (days < 0) return "Просрочен";
  if (days === 0) return "Истекает сегодня";
  if (days === 1) return "Истекает завтра";
  if (days <= 7) return `Истекает через ${days} дн.`;
  if (days <= 30) return `Истекает через ${days} дн.`;
  return `Истекает через ${days} дн.`;
}

function expiryColor(d: string | null): string {
  const days = daysUntilExpiry(d);
  if (days === null) return "text-ink-muted";
  if (days < 0) return "text-alert";
  if (days <= 3) return "text-warning";
  if (days <= 7) return "text-warning";
  return "text-fresh";
}

const STORAGE_TIPS: Record<string, string[]> = {
  fridge: ["Мясо — на нижней полке", "Молочное — в дверце", "Овощи — в ящике внизу"],
  freezer: ["Подпишите дату заморозки", "Не замораживайте повторно", "Порционируйте заранее"],
  pantry: ["Крупы — в герметичных банках", "Проверяйте раз в месяц", "Новые — назад, старые — вперёд"],
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
    onSuccess: (d) => { utils.inventory.list.invalidate(); alert(d.updated > 0 ? `Проставлено: ${d.updated}` : "Совпадений нет"); },
  });

  type ViewItem = {
    id: number; source: "inventory" | "preserve"; productName: string;
    quantity: string | null; unit: string | null; expiryDate: string | null;
    category: string | null; minQuantity: string | null; isBasic: boolean;
  };

  const tabItems: ViewItem[] = allItems.filter(i => i.storageType === tab).map(i => ({
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

  const items: ViewItem[] = [...tabItems, ...preservesView];

  const handleRemove = (it: ViewItem) =>
    it.source === "preserve" ? removePreserve.mutate({ id: it.id }) : remove.mutate({ id: it.id });

  const totalCount = items.length;
  const expiringCount = items.filter(i => { const d = daysUntilExpiry(i.expiryDate); return d !== null && d <= 3; }).length;
  const freshCount = items.filter(i => { const d = daysUntilExpiry(i.expiryDate); return d === null || d > 7; }).length;
  const expiringItems = items.filter(i => { const d = daysUntilExpiry(i.expiryDate); return d !== null && d <= 3; }).slice(0, 5);

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

  const tabLabel = TABS.find(t => t.key === tab)?.label ?? "";
  const atmosphereClass = tab === "freezer" ? "atmosphere-freezer" : tab === "pantry" ? "atmosphere-pantry" : "atmosphere-fridge";

  return (
    <div className={`min-h-screen ${atmosphereClass}`}>
      <div className="max-w-7xl mx-auto px-5 py-8 lg:py-10">

        {/* HEADER */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink">Инвентарь</h1>
            <p className="text-ink-muted text-sm mt-1">
              {tabLabel} · {totalCount} {totalCount === 1 ? "продукт" : totalCount < 5 ? "продукта" : "продуктов"}
            </p>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => recalc.mutate()} disabled={recalc.isPending}
              className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-ink-muted hover:text-primary hover:border-primary/40 transition-colors"
              title="Пересчитать сроки">
              {recalc.isPending ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs">📅</span>}
            </button>
            <button onClick={() => setShowScanner(!showScanner)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${showScanner ? "border-primary text-primary" : "border-line text-ink-muted hover:text-primary hover:border-primary/40"}`}>
              <ScanLine size={16} />
            </button>
            <button onClick={() => setShowAdd(true)}
              className="w-9 h-9 rounded-lg bg-primary text-cream flex items-center justify-center hover:bg-primary-dark transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-0 border-b border-line mb-6 mt-5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === key ? "text-primary border-primary" : "text-ink-muted border-transparent hover:text-ink-soft"
              }`}>
              <Icon size={15} strokeWidth={1.5} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface-elevated rounded-xl p-3 border border-line text-center">
            <p className="text-xl font-bold text-primary">{totalCount}</p>
            <p className="text-[11px] text-ink-muted mt-0.5">Всего</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3 border border-line text-center">
            <p className={`text-xl font-bold ${expiringCount > 0 ? "text-warning" : "text-fresh"}`}>{expiringCount}</p>
            <p className="text-[11px] text-ink-muted mt-0.5">Истекает</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3 border border-line text-center">
            <p className="text-xl font-bold text-fresh">{Math.round(totalCount > 0 ? (freshCount / totalCount) * 100 : 100)}%</p>
            <p className="text-[11px] text-ink-muted mt-0.5">Свежесть</p>
          </div>
        </div>

        {/* Scanner */}
        {showScanner && (
          <div className="mb-5 rounded-xl border border-line p-4 bg-surface-elevated">
            <BarcodeScanner onDetected={(code) => { setScanResult({ barcode: code }); setShowScanner(false); }} />
          </div>
        )}

        {/* MAIN LAYOUT */}
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-6">

          {/* LEFT: список продуктов */}
          <div>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={24} className="animate-spin text-ink-muted" />
              </div>
            ) : items.length === 0 ? (
              <div className="bg-surface-elevated border border-dashed border-line rounded-2xl py-16 text-center">
                <Refrigerator size={28} className="text-ink-muted mx-auto mb-3" strokeWidth={1} />
                <p className="text-ink-muted text-sm">Пусто. Добавьте продукты кнопкой [+]</p>
              </div>
            ) : (
              <div className="space-y-5">
                {categories.map((cat) => (
                  <section key={cat}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.15em]">{cat}</h3>
                      <span className="text-[10px] text-ink-muted">{grouped[cat].length}</span>
                    </div>
                    {/* Список карточек — горизонтальный layout по промту */}
                    <div className="space-y-2">
                      {grouped[cat].map((item) => (
                        <ProductCard
                          key={`${item.source}-${item.id}`}
                          item={item}
                          onRemove={() => handleRemove(item)}
                          onToggleBasic={() => item.source === "inventory" && toggleBasic.mutate({ id: item.id, isBasic: !item.isBasic })}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="hidden lg:block space-y-4 mt-0">
            {/* Истекает скоро */}
            <div className="bg-surface-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} className="text-warning" />
                <h4 className="text-[10px] font-semibold text-ink-soft uppercase tracking-[0.12em]">Истекает скоро</h4>
              </div>
              {expiringItems.length === 0 ? (
                <p className="text-xs text-ink-muted">Всё свежее</p>
              ) : (
                <ul className="space-y-2">
                  {expiringItems.map(item => (
                    <li key={`exp-${item.source}-${item.id}`} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-ink truncate flex-1">{item.productName}</span>
                      <span className={`text-[10px] font-medium shrink-0 ${expiryColor(item.expiryDate)}`}>
                        {expiryText(item.expiryDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Советы */}
            <div className="bg-surface-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={13} className="text-primary" />
                <h4 className="text-[10px] font-semibold text-ink-soft uppercase tracking-[0.12em]">Советы</h4>
              </div>
              <ul className="space-y-1.5">
                {STORAGE_TIPS[tab].map((tip, i) => (
                  <li key={i} className="text-xs text-ink-muted flex items-start gap-2">
                    <span className="text-primary/50 shrink-0 mt-0.5">·</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Идеи */}
            <div className="bg-surface-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <ChefHat size={13} className="text-primary" />
                <h4 className="text-[10px] font-semibold text-ink-soft uppercase tracking-[0.12em]">Идеи</h4>
              </div>
              <Link to="/what-to-cook" className="text-xs text-primary hover:text-primary-dark transition-colors">
                Что приготовить из имеющегося →
              </Link>
            </div>

            {/* Свежесть */}
            <div className="bg-surface-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-fresh" />
                <h4 className="text-[10px] font-semibold text-ink-soft uppercase tracking-[0.12em]">Свежесть</h4>
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-fresh rounded-full transition-all duration-700"
                  style={{ width: `${totalCount > 0 ? (freshCount / totalCount) * 100 : 100}%` }} />
              </div>
              <p className="text-[10px] text-ink-muted mt-2">{freshCount} из {totalCount} в порядке</p>
            </div>
          </aside>
        </div>
      </div>

      {showAdd && <AddDialog storageType={tab} onClose={() => setShowAdd(false)} />}
      {scanResult && <ScanDialog barcode={scanResult.barcode} storageType={tab} onClose={() => setScanResult(null)} />}
    </div>
  );
}

// ═══ PRODUCT CARD — точно по промту ═══
// Layout: [фото 64x64] [имя 16px/600 | количество 13px/muted | статус 12px/color]
function ProductCard({
  item, onRemove, onToggleBasic,
}: {
  item: { id: number; source: string; productName: string; quantity: string | null; unit: string | null; expiryDate: string | null; isBasic: boolean };
  onRemove: () => void;
  onToggleBasic: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = getProductImageUrl(item.productName);
  const status = expiryText(item.expiryDate);
  const statusColor = expiryColor(item.expiryDate);

  return (
    <div className="group flex items-center gap-4 rounded-[16px] px-4 py-3 bg-surface-elevated border border-line hover:border-line-strong transition-all"
      style={{ minHeight: "80px", boxShadow: "0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)" }}>

      {/* Фото продукта — 64x64, округлые углы 12px */}
      <div className="w-16 h-16 rounded-[12px] overflow-hidden shrink-0 bg-line"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
        {!imgError ? (
          <img
            src={imgSrc}
            alt={item.productName}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-hover">
            <span className="text-ink-muted text-xl">
              {item.productName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Текст */}
      <div className="flex-1 min-w-0">
        {/* Строка 1: название */}
        <p className="text-white leading-snug truncate" style={{ fontSize: "16px", fontWeight: 600 }}>
          {item.isBasic && <span className="text-primary text-xs mr-1">📌</span>}
          {item.productName}
        </p>
        {/* Строка 2: количество */}
        <p className="mt-0.5 truncate" style={{ fontSize: "13px", color: "#a0a9b8" }}>
          {item.quantity
            ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
            : "Количество не указано"}
        </p>
        {/* Строка 3: статус срока */}
        <p className={`mt-0.5 text-[12px] font-medium ${statusColor}`}>
          {status}
        </p>
      </div>

      {/* Действия */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.source === "inventory" && (
          <button onClick={onToggleBasic}
            className={`w-7 h-7 flex items-center justify-center rounded text-[11px] transition-colors ${
              item.isBasic ? "text-primary" : "text-ink-muted hover:text-primary"
            }`}
            title={item.isBasic ? "Убрать из базовых" : "Базовый"}>
            📌
          </button>
        )}
        <button onClick={onRemove}
          className="w-7 h-7 flex items-center justify-center text-ink-muted hover:text-alert transition-colors rounded"
          aria-label="Удалить">
          <Trash2 size={14} />
        </button>
      </div>
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
      <div className="bg-paper w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 border border-line"
        onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-lg font-semibold text-ink mb-5">Добавить продукт</h3>
        <form onSubmit={(e: FormEvent) => {
          e.preventDefault(); if (!name.trim()) return;
          add.mutate({ productName: name.trim(), quantity: quantity ? Number(quantity) : null, unit: unit.trim() || null, storageType, expiryDate: expiryDate || null, minQuantity: minQuantity ? Number(minQuantity) : null });
        }} className="space-y-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Название продукта" autoFocus required
            className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
          <div className="flex gap-2">
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Кол-во" step="any" min="0"
              className="flex-1 h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="кг, л, шт"
              className="w-24 h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
          </div>
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
            className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
          <input type="number" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} placeholder="Мин. остаток (авто-докупка)" step="any" min="0"
            className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-primary" />
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-lg border border-line text-ink-soft text-sm font-medium hover:bg-surface-hover transition-colors">Отмена</button>
            <button type="submit" disabled={!name.trim() || add.isPending}
              className="flex-1 h-11 rounded-lg bg-primary text-paper text-sm font-medium disabled:opacity-50 hover:bg-primary-dark transition-colors">
              {add.isPending ? "Добавляю..." : "Добавить"}
            </button>
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
    const n = product ? (product.brand ? `${product.brand} ${product.nameRu}` : product.nameRu) : customName.trim();
    if (!n) return;
    add.mutate({ productName: n, quantity: product?.packageQuantity ? Number(product.packageQuantity) : null, unit: product?.packageUnit || null, storageType, expiryDate: expiryDate || null });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-paper w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 border border-line" onClick={e => e.stopPropagation()}>
        {lookup.isLoading && <div className="py-8 text-center"><Loader2 size={24} className="animate-spin text-primary mx-auto" /></div>}
        {product && !lookup.isLoading && (
          <>
            <p className="text-sm font-semibold text-ink mb-4">{product.brand ? `${product.brand} ${product.nameRu}` : product.nameRu}</p>
            <div className="flex gap-1 mb-3">
              {(["fridge", "freezer", "pantry"] as const).map((k, i) => (
                <button key={k} onClick={() => setStorageType(k)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${storageType === k ? "bg-primary text-paper" : "text-ink-muted border border-line"}`}>
                  {["Холодильник", "Морозилка", "Кладовая"][i]}
                </button>
              ))}
            </div>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink mb-4 focus:outline-none focus:border-primary" />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-11 rounded-lg border border-line text-ink-soft text-sm font-medium hover:bg-surface-hover transition-colors">Отмена</button>
              <button onClick={handleAdd} disabled={add.isPending} className="flex-1 h-11 rounded-lg bg-primary text-paper text-sm font-medium disabled:opacity-50">Добавить</button>
            </div>
          </>
        )}
        {lookup.isError && !lookup.isLoading && (
          <>
            <p className="text-sm text-ink mb-3">Товар не найден. Введите название:</p>
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Название" autoFocus
              className="w-full h-11 px-4 bg-surface-elevated border border-line rounded-lg text-sm text-ink mb-3 focus:outline-none focus:border-primary" />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-11 rounded-lg border border-line text-ink-soft text-sm font-medium hover:bg-surface-hover transition-colors">Отмена</button>
              <button onClick={handleAdd} disabled={!customName.trim() || add.isPending} className="flex-1 h-11 rounded-lg bg-primary text-paper text-sm font-medium disabled:opacity-50">Добавить</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
