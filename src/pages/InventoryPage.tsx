import { useState, FormEvent } from "react";
import { Plus, Trash2, Pencil, AlertTriangle, Loader2, ScanLine, Snowflake } from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc";
import { BarcodeScanner } from "../components/BarcodeScanner";

// ═══ Цвета (точно по брифу) ═══
// Фон страницы:    #1a1f2e
// Фон карточек:    #232b3b
// Hover:           #2a3548
// Золотистый:      #d4a574
// Бордер:          #3a4558
// Текст серый:     #a0a9b8
// Зелёный:         #4ade80 (15+ дней)
// Жёлтый:         #f59e0b (2-7 дней)
// Красный:         #ef4444 (≤1 дня / просрочен)

// ═══ Табы ═══
const TABS = [
  { key: "fridge" as const, label: "Холодильник", emoji: "🧊" },
  { key: "freezer" as const, label: "Морозилка", emoji: "❄️" },
  { key: "pantry" as const, label: "Кладовая", emoji: "📦" },
];

// ═══ Срок годности ═══
function daysUntilExpiry(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.floor((new Date(d + "T00:00:00").getTime() - t.getTime()) / 86400000);
}

function expiryStatus(d: string | null): { text: string; color: string; weight: string } {
  const days = daysUntilExpiry(d);
  if (days === null) return { text: "Срок не указан", color: "#a0a9b8", weight: "400" };
  if (days < 0) return { text: "Просрочен", color: "#ef4444", weight: "600" };
  if (days === 0) return { text: "Истекает сегодня", color: "#ef4444", weight: "600" };
  if (days === 1) return { text: "Истекает завтра", color: "#ef4444", weight: "600" };
  if (days <= 3) return { text: `Истекает через ${days} дн.`, color: "#f59e0b", weight: "600" };
  if (days <= 7) return { text: `Истекает через ${days} дн.`, color: "#f59e0b", weight: "400" };
  return { text: `Истекает через ${days} дн.`, color: "#4ade80", weight: "400" };
}

export function InventoryPage() {
  const [tab, setTab] = useState<"fridge" | "freezer" | "pantry">("fridge");
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{ barcode: string } | null>(null);
  const [editingItem, setEditingItem] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: allItems = [], isLoading } = trpc.inventory.list.useQuery();
  const { data: allPreserves = [] } = trpc.preserves.list.useQuery();

  const remove = trpc.inventory.remove.useMutation({ onSuccess: () => utils.inventory.list.invalidate() });
  const removePreserve = trpc.preserves.remove.useMutation({ onSuccess: () => utils.preserves.list.invalidate() });
  const recalc = trpc.inventory.recalcExpiry.useMutation({
    onSuccess: (d) => { utils.inventory.list.invalidate(); alert(d.updated > 0 ? `Проставлено: ${d.updated}` : "Совпадений не найдено"); },
  });

  // Текущие продукты для выбранного хранилища
  const tabItems = allItems.filter(i => i.storageType === tab);

  // Заготовки frozen для Морозилки
  const frozenPreserves = allPreserves.filter(p => p.preserveType === "frozen");

  // Алерт: все продукты с ≤3 днями
  const urgentItems = allItems.filter(i => {
    const d = daysUntilExpiry(i.expiryDate);
    return d !== null && d <= 3;
  });

  const tabLabel = TABS.find(t => t.key === tab)?.label ?? "";
  const tabCount = tabItems.length;

  return (
    <div className="min-h-screen" style={{ background: "#0a0e27" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ═══ 1. ЗАГОЛОВОК + ПОДТЕКСТ ═══ */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="font-serif text-3xl font-bold text-white">Инвентарь</h1>
            {/* ИЗМЕНЕНИЕ 6: подтекст */}
            <p style={{ color: "#a0a9b8", fontSize: "14px", marginTop: "4px" }}>
              {tabLabel} • {tabCount} {tabCount === 1 ? "продукт" : tabCount < 5 ? "продукта" : "продуктов"}
            </p>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => recalc.mutate()} disabled={recalc.isPending}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "#232b3b", border: "1px solid #3a4558", color: "#a0a9b8" }}
              title="Пересчитать сроки">
              {recalc.isPending ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs">📅</span>}
            </button>
            <button onClick={() => setShowScanner(!showScanner)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "#232b3b", border: `1px solid ${showScanner ? "#d4a574" : "#3a4558"}`, color: showScanner ? "#d4a574" : "#a0a9b8" }}>
              <ScanLine size={16} />
            </button>
          </div>
        </div>

        {/* ═══ 2. ВКЛАДКИ с золотым подчёркиванием ═══ */}
        <div className="flex mb-6 mt-5" style={{ borderBottom: "1px solid #3a4558" }}>
          {TABS.map(({ key, label, emoji }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all"
              style={{
                color: tab === key ? "#ffffff" : "#a0a9b8",
                borderBottom: tab === key ? "3px solid #d4a574" : "3px solid transparent",
                marginBottom: "-1px",
              }}
              onMouseEnter={e => { if (tab !== key) (e.currentTarget as HTMLButtonElement).style.color = "#d4a574"; }}
              onMouseLeave={e => { if (tab !== key) (e.currentTarget as HTMLButtonElement).style.color = "#a0a9b8"; }}>
              <span>{emoji}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Scanner */}
        {showScanner && (
          <div className="mb-4 rounded-xl p-4" style={{ background: "#232b3b", border: "1px solid #3a4558" }}>
            <BarcodeScanner onDetected={(code) => { setScanResult({ barcode: code }); setShowScanner(false); }} />
          </div>
        )}

        {/* ═══ 4. АЛЕРТ — истекает ≤3 дня ═══ */}
        {urgentItems.length > 0 && (
          <div className="mb-5 rounded-lg p-4"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="text-xs font-semibold uppercase mb-3 flex items-center gap-2"
              style={{ color: "#ef4444", letterSpacing: "0.05em" }}>
              <AlertTriangle size={13} /> Использовать в ближайшие 3 дня
            </p>
            <div className="space-y-2">
              {urgentItems.map((item, idx) => (
                <div key={item.id}>
                  {idx > 0 && <div style={{ height: "1px", background: "rgba(239,68,68,0.2)" }} className="mb-2" />}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">
                      {item.productName}{item.quantity ? `, ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}
                    </span>
                    <span className="text-xs font-medium" style={{ color: "#ef4444" }}>
                      {expiryStatus(item.expiryDate).text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 5. КНОПКА ДОБАВИТЬ — 100% ширина, золотая ═══ */}
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 font-semibold transition-all mb-6"
          style={{ height: "48px", background: "#d4a574", color: "#ffffff", borderRadius: "8px", fontSize: "14px" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#c99d63"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(212,165,116,0.3)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#d4a574"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}>
          <Plus size={18} />
          Добавить продукт
        </button>

        {/* ═══ ОСНОВНОЙ СПИСОК ═══ */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: "#a0a9b8" }} /></div>
        ) : tabItems.length === 0 && (tab !== "freezer" || frozenPreserves.length === 0) ? (
          /* ═══ 8. ПУСТОЕ СОСТОЯНИЕ ═══ */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">
              {tab === "fridge" ? "🧊" : tab === "freezer" ? "❄️" : "📦"}
            </div>
            <p className="text-lg font-semibold text-white mb-2">
              {tab === "fridge" ? "Холодильник пуст" : tab === "freezer" ? "Морозилка пуста" : "Кладовая пуста"}
            </p>
            <p className="text-sm mb-6" style={{ color: "#a0a9b8" }}>Добавьте первый продукт</p>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 font-semibold px-6 transition-all"
              style={{ height: "48px", background: "#d4a574", color: "#ffffff", borderRadius: "8px", fontSize: "14px" }}>
              <Plus size={18} /> Добавить продукт
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Обычные продукты */}
            {tabItems.map(item => {
              const status = expiryStatus(item.expiryDate);
              return (
                <ProductCard
                  key={item.id}
                  name={item.productName}
                  quantity={item.quantity}
                  unit={item.unit}
                  status={status}
                  storageEmoji={TABS.find(t => t.key === tab)?.emoji ?? ""}
                  onDelete={() => remove.mutate({ id: item.id })}
                />
              );
            })}

            {/* ═══ 7. ЗАГОТОВКИ в Морозилке ═══ */}
            {tab === "freezer" && frozenPreserves.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3" style={{ borderTop: "1px solid #3a4558", paddingTop: "20px", marginTop: "20px" }}>
                  <Snowflake size={13} style={{ color: "#ffffff" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">Заготовки</span>
                </div>
                <div className="space-y-2">
                  {frozenPreserves.map(item => {
                    const status = expiryStatus(item.expiryDate);
                    return (
                      <ProductCard
                        key={`preserve-${item.id}`}
                        name={item.name}
                        quantity={item.quantity}
                        unit={item.unit}
                        status={status}
                        storageEmoji="❄️"
                        onDelete={() => removePreserve.mutate({ id: item.id })}
                        isPreserve
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Диалоги */}
      {showAdd && <AddDialog storageType={tab} onClose={() => setShowAdd(false)} />}
      {scanResult && <ScanDialog barcode={scanResult.barcode} storageType={tab} onClose={() => setScanResult(null)} />}
    </div>
  );
}

// ═══ 2+3. КАРТОЧКА ПРОДУКТА ═══
function ProductCard({
  name, quantity, unit, status, storageEmoji, onDelete, isPreserve,
}: {
  name: string;
  quantity: string | null;
  unit: string | null;
  status: { text: string; color: string; weight: string };
  storageEmoji: string;
  onDelete: () => void;
  isPreserve?: boolean;
}) {
  return (
    <div className="group"
      style={{ background: "#232b3b", border: "1px solid #3a4558", borderRadius: "8px", padding: "16px", minHeight: "80px" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#4a5568"; (e.currentTarget as HTMLDivElement).style.background = "#2a3548"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#3a4558"; (e.currentTarget as HTMLDivElement).style.background = "#232b3b"; }}>
      {/* Шапка: иконка + название + кнопки */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base shrink-0">{storageEmoji}</span>
          <span className="text-sm font-semibold text-white truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            className="transition-colors"
            style={{ color: "#a0a9b8" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#d4a574"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#a0a9b8"; }}
            title="Редактировать">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete}
            className="transition-colors"
            style={{ color: "#a0a9b8" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#a0a9b8"; }}
            title="Удалить">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {/* Количество */}
      {quantity ? (
        <p className="text-xs mb-1" style={{ color: "#a0a9b8" }}>
          {quantity}{unit ? ` ${unit}` : ""}
        </p>
      ) : (
        <p className="text-xs mb-1" style={{ color: "#a0a9b8" }}>Количество не указано</p>
      )}
      {/* Статус срока */}
      <p className="text-xs" style={{ color: status.color, fontWeight: status.weight }}>
        {status.text}
      </p>
    </div>
  );
}

// ═══ Диалог добавления ═══
function AddDialog({ storageType, onClose }: { storageType: "fridge" | "freezer" | "pantry"; onClose: () => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const utils = trpc.useUtils();
  const add = trpc.inventory.add.useMutation({ onSuccess: () => { utils.inventory.list.invalidate(); onClose(); } });

  const inputStyle = { background: "#232b3b", border: "1px solid #3a4558", borderRadius: "8px", color: "#ffffff", width: "100%", height: "44px", padding: "0 14px", fontSize: "14px", outline: "none" };

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6"
        style={{ background: "#1a1f2e", border: "1px solid #3a4558" }}
        onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-lg font-semibold text-white mb-5">Добавить продукт</h3>
        <form onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!name.trim()) return;
          add.mutate({ productName: name.trim(), quantity: quantity ? Number(quantity) : null, unit: unit.trim() || null, storageType, expiryDate: expiryDate || null, minQuantity: minQuantity ? Number(minQuantity) : null });
        }} className="space-y-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Название продукта" autoFocus required style={inputStyle} onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a574"} onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#3a4558"} />
          <div className="flex gap-2">
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Кол-во" step="any" min="0" style={{ ...inputStyle, flex: 1 }} onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a574"} onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#3a4558"} />
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="кг, л, шт" style={{ ...inputStyle, width: "90px" }} onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a574"} onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#3a4558"} />
          </div>
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={inputStyle} onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a574"} onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#3a4558"} />
          <input type="number" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} placeholder="Мин. остаток (авто-докупка)" step="any" min="0" style={inputStyle} onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a574"} onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#3a4558"} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 font-medium transition-colors"
              style={{ height: "44px", borderRadius: "8px", border: "1px solid #3a4558", color: "#a0a9b8", fontSize: "14px", background: "transparent" }}>
              Отмена
            </button>
            <button type="submit" disabled={!name.trim() || add.isPending}
              className="flex-1 font-semibold transition-all"
              style={{ height: "44px", borderRadius: "8px", background: name.trim() ? "#d4a574" : "#3a4558", color: "#ffffff", fontSize: "14px", cursor: name.trim() ? "pointer" : "not-allowed" }}>
              {add.isPending ? "Добавляю..." : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══ Диалог сканирования ═══
function ScanDialog({ barcode, storageType: defaultStorage, onClose }: { barcode: string; storageType: "fridge" | "freezer" | "pantry"; onClose: () => void }) {
  const [storageType, setStorageType] = useState(defaultStorage);
  const [expiryDate, setExpiryDate] = useState("");
  const [customName, setCustomName] = useState("");
  const utils = trpc.useUtils();
  const lookup = trpc.products.getByBarcode.useQuery({ barcode }, { retry: false });
  const add = trpc.inventory.add.useMutation({ onSuccess: () => { utils.inventory.list.invalidate(); onClose(); } });
  const product = lookup.data;
  const inputStyle = { background: "#232b3b", border: "1px solid #3a4558", borderRadius: "8px", color: "#ffffff", width: "100%", height: "44px", padding: "0 14px", fontSize: "14px", outline: "none" };

  const handleAdd = () => {
    const name = product ? (product.brand ? `${product.brand} ${product.nameRu}` : product.nameRu) : customName.trim();
    if (!name) return;
    add.mutate({ productName: name, quantity: product?.packageQuantity ? Number(product.packageQuantity) : null, unit: product?.packageUnit || null, storageType, expiryDate: expiryDate || null });
  };

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6"
        style={{ background: "#1a1f2e", border: "1px solid #3a4558" }}
        onClick={e => e.stopPropagation()}>
        {lookup.isLoading && <div className="py-8 text-center"><Loader2 size={24} className="animate-spin mx-auto" style={{ color: "#d4a574" }} /></div>}
        {product && !lookup.isLoading && (
          <>
            <p className="text-sm font-semibold text-white mb-4">{product.brand ? `${product.brand} ${product.nameRu}` : product.nameRu}</p>
            <div className="flex gap-1 mb-3">
              {(["fridge", "freezer", "pantry"] as const).map((k, i) => (
                <button key={k} onClick={() => setStorageType(k)}
                  className="flex-1 py-2 text-xs font-medium transition-all"
                  style={{ borderRadius: "8px", background: storageType === k ? "#d4a574" : "#232b3b", color: storageType === k ? "#ffffff" : "#a0a9b8", border: "1px solid #3a4558" }}>
                  {["Холодильник", "Морозилка", "Кладовая"][i]}
                </button>
              ))}
            </div>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={{ ...inputStyle, marginBottom: "16px" }} />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 font-medium" style={{ height: "44px", borderRadius: "8px", border: "1px solid #3a4558", color: "#a0a9b8", background: "transparent", fontSize: "14px" }}>Отмена</button>
              <button onClick={handleAdd} disabled={add.isPending} className="flex-1 font-semibold" style={{ height: "44px", borderRadius: "8px", background: "#d4a574", color: "#ffffff", fontSize: "14px" }}>{add.isPending ? "..." : "Добавить"}</button>
            </div>
          </>
        )}
        {lookup.isError && !lookup.isLoading && (
          <>
            <p className="text-sm text-white mb-3">Товар не найден. Введите название:</p>
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Название" autoFocus style={{ ...inputStyle, marginBottom: "12px" }} />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 font-medium" style={{ height: "44px", borderRadius: "8px", border: "1px solid #3a4558", color: "#a0a9b8", background: "transparent", fontSize: "14px" }}>Отмена</button>
              <button onClick={handleAdd} disabled={!customName.trim() || add.isPending} className="flex-1 font-semibold" style={{ height: "44px", borderRadius: "8px", background: customName.trim() ? "#d4a574" : "#3a4558", color: "#ffffff", fontSize: "14px" }}>{add.isPending ? "..." : "Добавить"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
