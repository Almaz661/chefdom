import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  X,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { trpc } from "../utils/trpc";

// Хранилища для выбора в диалоге «В инвентарь»
const STORAGE_OPTS = [
  { key: "fridge" as const, label: "Холодильник", emoji: "🥕" },
  { key: "freezer" as const, label: "Морозилка", emoji: "❄️" },
  { key: "pantry" as const, label: "Кладовая", emoji: "📦" },
];

// G.19 — детальная страница чека.
// Чек создаётся фотографией со страницы списка (см. ReceiptsPage),
// здесь — просмотр шапки и позиций. Если что-то распозналось плохо:
// удалить позицию (или весь чек) и пересфотографировать.
// «Добавить вручную» — на случай если в чеке потерялась позиция.

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", RUB: "₽" };

function formatPrice(price: string | null, currency: string): string {
  if (price === null) return "";
  const n = parseFloat(price);
  return `${CURRENCY_SYMBOL[currency] ?? ""}${n.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(params.id);

  const [showAddManual, setShowAddManual] = useState(false);
  // Диалог «Добавить в инвентарь» — открывается кнопкой в шапке чека
  const [showToInventory, setShowToInventory] = useState(false);

  // «Показать сырой текст OCR» — раскрывающийся блок для отладки
  const [showRaw, setShowRaw] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  // Инлайн-редактирование позиции
  const [editingId, setEditingId] = useState<number | null>(null);
  const [eName, setEName] = useState("");
  const [ePrice, setEPrice] = useState("");

  // Форма ручного добавления
  const [mName, setMName] = useState("");
  const [mQty, setMQty] = useState("");
  const [mUnit, setMUnit] = useState("");
  const [mPrice, setMPrice] = useState("");

  const utils = trpc.useUtils();
  const query = trpc.receipts.getById.useQuery(
    { id },
    { enabled: Number.isFinite(id) && id > 0 },
  );

  const addItem = trpc.receipts.addItem.useMutation({
    onSuccess: () => {
      utils.receipts.getById.invalidate({ id });
      setShowAddManual(false);
      setMName("");
      setMQty("");
      setMUnit("");
      setMPrice("");
    },
  });

  const deleteItem = trpc.receipts.deleteItem.useMutation({
    onSuccess: () => utils.receipts.getById.invalidate({ id }),
  });

  const updateItem = trpc.receipts.updateItem.useMutation({
    onSuccess: () => {
      utils.receipts.getById.invalidate({ id });
      setEditingId(null);
    },
  });

  const reparse = trpc.receipts.reparse.useMutation({
    onSuccess: () => utils.receipts.getById.invalidate({ id }),
  });

  const deleteReceipt = trpc.receipts.delete.useMutation({
    onSuccess: () => {
      utils.receipts.list.invalidate();
      navigate("/receipts");
    },
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <Link to="/receipts" className="text-primary inline-flex items-center gap-1">
          <ArrowLeft size={18} /> К чекам
        </Link>
        <p className="text-ink-soft mt-6">Некорректный ID чека.</p>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <p className="text-ink-muted">Загрузка чека…</p>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <Link
          to="/receipts"
          className="text-primary inline-flex items-center gap-1 mb-6"
        >
          <ArrowLeft size={18} /> К чекам
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-ink mb-2">
          Чек не найден
        </h1>
        <p className="text-ink-soft">{query.error?.message}</p>
      </div>
    );
  }

  const { receipt, items } = query.data;
  const currency = receipt.currency;

  // Сумма по строкам (если у каждой есть price) — для сравнения с total_amount
  const itemsSum = items.reduce(
    (acc, it) => acc + (it.price ? parseFloat(it.price as unknown as string) : 0),
    0,
  );

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      {/* Шапка */}
      <div>
        <Link
          to="/receipts"
          className="text-primary inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={18} /> К чекам
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-3xl font-semibold text-ink leading-tight inline-flex items-center gap-3">
              <ReceiptIcon size={26} className="text-primary" strokeWidth={2} />
              {receipt.storeName || "Чек без названия"}
            </h1>
            <p className="text-ink-soft mt-1">
              {receipt.purchaseDate
                ? new Intl.DateTimeFormat("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(receipt.purchaseDate))
                : "Дата не указана"}{" "}
              · {currency}
              {receipt.totalAmount && (
                <>
                  {" "}· итог по чеку:{" "}
                  <span className="tabular-nums text-ink font-medium">
                    {formatPrice(
                      receipt.totalAmount as unknown as string,
                      currency,
                    )}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setShowToInventory(true)}
                title="Добавить купленное в инвентарь"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors text-sm"
              >
                <ShoppingBag size={16} />
                В инвентарь
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `Удалить чек "${receipt.storeName || "без названия"}"? Если плохо распозналось — после удаления сфотографируй заново.`,
                  )
                ) {
                  deleteReceipt.mutate({ id });
                }
              }}
              aria-label="Удалить чек"
              title="Удалить чек"
              className="w-10 h-10 rounded-lg border border-line bg-paper text-ink-soft hover:text-alert hover:border-alert flex items-center justify-center transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Кнопка добавления — теперь только ручная */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowAddManual(true)}
          className="inline-flex items-center gap-2 h-12 px-4 rounded-lg border border-line bg-paper text-ink font-medium hover:border-primary hover:text-primary transition-colors"
        >
          <Plus size={18} />
          Добавить позицию вручную
        </button>
        {receipt.ocrRaw && (
          <button
            type="button"
            onClick={() => reparse.mutate({ id })}
            disabled={reparse.isPending}
            title="Распознать заново из сохранённого текста OCR (без нового запроса)"
            className="inline-flex items-center gap-2 h-12 px-4 rounded-lg border border-line bg-paper text-ink-soft font-medium hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={reparse.isPending ? "animate-spin" : ""}
            />
            {reparse.isPending ? "Перепарсиваю…" : "Перепарсить"}
          </button>
        )}
      </div>

      {/* Блок «Показать сырой текст OCR» */}
      {receipt.ocrRaw && (
        <div className="bg-paper border border-line rounded-xl">
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm text-ink-soft hover:text-ink"
          >
            <span>Сырой текст OCR (для отладки)</span>
            {showRaw ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showRaw && (
            <div className="px-4 pb-4 border-t border-line">
              <div className="flex justify-end pt-3 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(receipt.ocrRaw ?? "")
                      .then(() => {
                        setCopyDone(true);
                        setTimeout(() => setCopyDone(false), 1500);
                      });
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line bg-paper text-xs text-ink-soft hover:text-primary hover:border-primary"
                >
                  {copyDone ? <Check size={14} /> : <Copy size={14} />}
                  {copyDone ? "Скопировано" : "Скопировать"}
                </button>
              </div>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words text-ink-soft bg-cream rounded-lg p-3 max-h-80 overflow-y-auto font-mono">
                {receipt.ocrRaw}
              </pre>
              <p className="text-xs text-ink-muted mt-2">
                Если позиции распознались плохо — скопируй текст выше и пришли
                разработчику. По нему можно подогнать парсер под этот формат
                чека, после чего «Перепарсить» обновит позиции без новой
                фотографии.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Позиции */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-ink mb-3">
          Позиции
        </h2>
        {items.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Позиций пока нет. Распознать чек заново можно так: на странице «Чеки»
            нажми «Удалить чек», затем «Сфотографировать чек» ещё раз.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => {
              const isEditing = editingId === it.id;
              if (isEditing) {
                // Режим редактирования — инлайн-форма
                const handleSave = () => {
                  const trimmed = eName.trim();
                  if (!trimmed) return;
                  const parsedPrice = ePrice
                    ? parseFloat(ePrice.replace(",", "."))
                    : null;
                  updateItem.mutate({
                    id: it.id,
                    productName: trimmed,
                    price: Number.isFinite(parsedPrice as number)
                      ? (parsedPrice as number)
                      : null,
                  });
                };
                return (
                  <li
                    key={it.id}
                    className="px-4 py-3 bg-paper border-2 border-primary rounded-xl"
                  >
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={eName}
                        onChange={(e) => setEName(e.target.value)}
                        autoFocus
                        className="flex-1 h-11 px-3 rounded-lg border border-line bg-paper focus:border-primary focus:outline-none"
                        placeholder="Название"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ePrice}
                        onChange={(e) => setEPrice(e.target.value)}
                        className="sm:w-28 h-11 px-3 rounded-lg border border-line bg-paper focus:border-primary focus:outline-none tabular-nums"
                        placeholder="Цена"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={!eName.trim() || updateItem.isPending}
                          aria-label="Сохранить"
                          title="Сохранить"
                          className="w-11 h-11 rounded-lg bg-primary text-paper hover:bg-primary-dark flex items-center justify-center disabled:opacity-50"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Отмена"
                          title="Отмена"
                          className="w-11 h-11 rounded-lg border border-line text-ink-soft hover:bg-cream flex items-center justify-center"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              }
              // Обычный режим
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-3 px-4 py-3 bg-paper border border-line rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink">{it.productName}</p>
                    {(it.quantity || it.unit) && (
                      <p className="text-xs text-ink-muted">
                        {it.quantity ?? ""} {it.unit ?? ""}
                      </p>
                    )}
                  </div>
                  {it.price && (
                    <span className="font-medium tabular-nums text-ink shrink-0">
                      {formatPrice(it.price as unknown as string, currency)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(it.id);
                      setEName(it.productName);
                      setEPrice(
                        it.price !== null && it.price !== undefined
                          ? String(it.price).replace(".", ",")
                          : "",
                      );
                    }}
                    aria-label="Редактировать"
                    title="Редактировать"
                    className="w-9 h-9 rounded-lg text-ink-muted hover:text-primary hover:bg-cream flex items-center justify-center shrink-0"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem.mutate({ id: it.id })}
                    aria-label="Удалить позицию"
                    className="w-9 h-9 rounded-lg text-ink-muted hover:text-alert hover:bg-cream flex items-center justify-center shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 && (
          <p className="text-ink-muted text-sm text-right mt-4 pt-3 border-t border-line">
            Сумма по строкам:{" "}
            <span className="tabular-nums text-ink font-medium">
              {CURRENCY_SYMBOL[currency] ?? ""}
              {itemsSum.toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        )}
      </section>

      {/* Модалка ручного добавления */}
      {showAddManual && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center p-6 z-50"
          onClick={() => !addItem.isPending && setShowAddManual(false)}
        >
          <div
            className="bg-paper rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-serif text-xl font-semibold text-ink">
                Новая позиция
              </h3>
              <button
                type="button"
                onClick={() => setShowAddManual(false)}
                aria-label="Закрыть"
                className="w-9 h-9 -m-1 rounded-lg text-ink-soft hover:bg-cream flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <label className="block mb-3">
              <span className="block text-sm font-medium text-ink-soft mb-1">
                Название *
              </span>
              <input
                type="text"
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="Молоко"
                className="w-full h-12 px-3 rounded-lg border border-line bg-paper focus:border-primary focus:outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="block text-sm font-medium text-ink-soft mb-1">
                  Кол-во
                </span>
                <input
                  type="number"
                  value={mQty}
                  onChange={(e) => setMQty(e.target.value)}
                  step="0.01"
                  className="w-full h-12 px-3 rounded-lg border border-line bg-paper focus:border-primary focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-ink-soft mb-1">
                  Единица
                </span>
                <input
                  type="text"
                  value={mUnit}
                  onChange={(e) => setMUnit(e.target.value)}
                  placeholder="л, кг, шт"
                  className="w-full h-12 px-3 rounded-lg border border-line bg-paper focus:border-primary focus:outline-none"
                />
              </label>
            </div>

            <label className="block mb-5">
              <span className="block text-sm font-medium text-ink-soft mb-1">
                Цена ({CURRENCY_SYMBOL[currency] ?? currency})
              </span>
              <input
                type="number"
                value={mPrice}
                onChange={(e) => setMPrice(e.target.value)}
                step="0.01"
                className="w-full h-12 px-3 rounded-lg border border-line bg-paper focus:border-primary focus:outline-none"
              />
            </label>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowAddManual(false)}
                disabled={addItem.isPending}
                className="px-4 h-11 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!mName.trim() || addItem.isPending}
                onClick={() =>
                  addItem.mutate({
                    receiptId: id,
                    item: {
                      productName: mName.trim(),
                      quantity: mQty ? parseFloat(mQty.replace(",", ".")) : null,
                      unit: mUnit.trim() || null,
                      price: mPrice ? parseFloat(mPrice.replace(",", ".")) : null,
                    },
                  })
                }
                className="px-4 h-11 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {addItem.isPending ? "Добавляю…" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Диалог «В инвентарь» */}
      {showToInventory && (
        <ToInventoryDialog
          receiptItems={items}
          onClose={() => setShowToInventory(false)}
        />
      )}
    </div>
  );
}


// ─── Диалог «Добавить в инвентарь» ───────────────────────────────────────────
//
// Показывает все позиции чека с галочками. Для каждой отмеченной позиции
// можно выбрать куда положить (холодильник / морозилка / кладовая) и
// указать срок годности. Одна кнопка «Добавить» — всё разом уходит в инвентарь.
//
// UX-решения:
//  - По умолчанию все позиции отмечены галочкой (всё куплено).
//  - Общий выбор хранилища сверху применяется ко всем позициям сразу,
//    но для каждой его можно поменять индивидуально.
//  - Срок годности — опционально, общий или на каждую позицию.
//  - Позиции со снятой галочкой игнорируются.

type ReceiptItemRow = {
  id: number;
  productName: string;
  quantity: string | number | null;
  unit: string | null;
};

type StorageType = "fridge" | "freezer" | "pantry";

type ItemDraft = {
  checked: boolean;
  storage: StorageType;
  expiryDate: string;
};

function ToInventoryDialog({
  receiptItems,
  onClose,
}: {
  receiptItems: ReceiptItemRow[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();

  // Дефолтное хранилище для всех — холодильник
  const [globalStorage, setGlobalStorage] = useState<StorageType>("fridge");
  const [globalExpiry, setGlobalExpiry] = useState("");
  const [applyGlobalExpiry, setApplyGlobalExpiry] = useState(false);

  // Состояние каждой позиции
  const [drafts, setDrafts] = useState<Record<number, ItemDraft>>(() => {
    const init: Record<number, ItemDraft> = {};
    for (const item of receiptItems) {
      init[item.id] = { checked: true, storage: "fridge", expiryDate: "" };
    }
    return init;
  });

  const [done, setDone] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const addToInventory = trpc.inventory.add.useMutation();

  // Применить глобальное хранилище ко всем позициям
  const applyGlobalStorage = (s: StorageType) => {
    setGlobalStorage(s);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id in next) {
        next[id] = { ...next[id], storage: s };
      }
      return next;
    });
  };

  const updateDraft = (id: number, patch: Partial<ItemDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const checkedCount = Object.values(drafts).filter((d) => d.checked).length;

  const handleSave = async () => {
    const toAdd = receiptItems.filter((it) => drafts[it.id]?.checked);
    if (toAdd.length === 0) return;

    for (const item of toAdd) {
      const draft = drafts[item.id];
      const expiryDate = applyGlobalExpiry
        ? globalExpiry || null
        : draft.expiryDate || null;

      await addToInventory.mutateAsync({
        productName: item.productName,
        quantity:
          item.quantity !== null && item.quantity !== undefined
            ? Number(item.quantity)
            : null,
        unit: item.unit ?? null,
        storageType: draft.storage,
        expiryDate: expiryDate,
      });
    }

    utils.inventory.list.invalidate();
    setAddedCount(toAdd.length);
    setDone(true);
  };

  // Экран «Готово»
  if (done) {
    return (
      <div
        className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-paper rounded-2xl p-8 max-w-sm w-full text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-4xl mb-3">✅</div>
          <h3 className="font-serif text-xl font-semibold text-ink mb-2">
            {addedCount} {addedCount === 1 ? "позиция добавлена" : addedCount < 5 ? "позиции добавлены" : "позиций добавлено"} в инвентарь
          </h3>
          <p className="text-ink-soft text-sm mb-6">
            Посмотреть в разделе «Инвентарь».
          </p>
          <button
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-primary text-paper font-medium hover:bg-primary-dark transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={() => !addToInventory.isPending && onClose()}
    >
      <div
        className="bg-paper w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-line shrink-0">
          <h3 className="font-serif text-xl font-semibold text-ink">
            Добавить в инвентарь
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 rounded-lg text-ink-soft hover:bg-cream flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Глобальные настройки */}
        <div className="px-6 py-4 border-b border-line bg-cream shrink-0 space-y-3">
          <div>
            <p className="text-xs text-ink-soft mb-2 font-medium">Куда положить (для всех):</p>
            <div className="flex gap-2">
              {STORAGE_OPTS.map(({ key, label, emoji }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyGlobalStorage(key)}
                  className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-colors ${
                    globalStorage === key
                      ? "bg-primary text-paper border-primary"
                      : "bg-paper text-ink-soft border-line hover:border-primary hover:text-primary"
                  }`}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyGlobalExpiry}
                onChange={(e) => setApplyGlobalExpiry(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-xs text-ink-soft font-medium">
                Одинаковый срок годности для всех
              </span>
            </label>
            {applyGlobalExpiry && (
              <input
                type="date"
                value={globalExpiry}
                onChange={(e) => setGlobalExpiry(e.target.value)}
                className="mt-2 w-full h-10 px-3 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:border-primary"
              />
            )}
          </div>
        </div>

        {/* Список позиций — скроллится */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <p className="text-xs text-ink-muted mb-3">
            Отметь что купила. Снять галочку = не добавлять в инвентарь.
          </p>
          <ul className="space-y-2">
            {receiptItems.map((item) => {
              const draft = drafts[item.id];
              if (!draft) return null;
              return (
                <li
                  key={item.id}
                  className={`rounded-xl border transition-colors ${
                    draft.checked
                      ? "bg-paper border-line"
                      : "bg-cream border-line opacity-50"
                  }`}
                >
                  {/* Строка товара */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={draft.checked}
                      onChange={(e) =>
                        updateDraft(item.id, { checked: e.target.checked })
                      }
                      className="w-4 h-4 accent-primary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {item.productName}
                      </p>
                      {(item.quantity || item.unit) && (
                        <p className="text-xs text-ink-muted">
                          {item.quantity ?? ""} {item.unit ?? ""}
                        </p>
                      )}
                    </div>
                    {/* Мини-выбор хранилища */}
                    {draft.checked && (
                      <div className="flex gap-1 shrink-0">
                        {STORAGE_OPTS.map(({ key, emoji }) => (
                          <button
                            key={key}
                            type="button"
                            title={STORAGE_OPTS.find(o => o.key === key)?.label}
                            onClick={() => updateDraft(item.id, { storage: key })}
                            className={`w-8 h-8 rounded-lg text-base border transition-colors ${
                              draft.storage === key
                                ? "bg-primary-light border-primary"
                                : "bg-cream border-line hover:border-primary"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Срок годности — только если позиция отмечена и глобальный срок не включён */}
                  {draft.checked && !applyGlobalExpiry && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <span className="text-xs text-ink-muted shrink-0">Годен до:</span>
                      <input
                        type="date"
                        value={draft.expiryDate}
                        onChange={(e) =>
                          updateDraft(item.id, { expiryDate: e.target.value })
                        }
                        className="flex-1 h-8 px-2 rounded-lg border border-line bg-cream text-xs text-ink focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Кнопки */}
        <div className="px-6 py-4 border-t border-line shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={addToInventory.isPending}
            className="flex-1 h-12 rounded-xl border border-line text-ink-soft font-medium hover:bg-cream transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={checkedCount === 0 || addToInventory.isPending}
            className="flex-1 h-12 rounded-xl bg-primary text-paper font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {addToInventory.isPending
              ? "Добавляю…"
              : `Добавить ${checkedCount > 0 ? checkedCount : ""} в инвентарь`}
          </button>
        </div>
      </div>
    </div>
  );
}
