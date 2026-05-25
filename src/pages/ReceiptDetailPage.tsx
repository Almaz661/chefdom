import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { trpc } from "../utils/trpc";

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

// Компонент элемента в списке «В инвентарь» с автозаполнением срока
type InventoryItemSelection = {
  checked: boolean;
  storage: 'fridge' | 'freezer' | 'pantry';
  expiryDate: string;
};

function InventoryItemRow({
  item,
  selection,
  purchaseDate,
  onChange,
}: {
  item: { id: number; productName: string };
  selection: InventoryItemSelection;
  purchaseDate: string | null;
  onChange: (sel: InventoryItemSelection) => void;
}) {
  const utils = trpc.useUtils();

  // Запрашиваем срок годности при изменении storage или при первом рендере
  useEffect(() => {
    if (!selection.checked) return;

    // Запросим срок только если expiryDate ещё не заполнен пользователем вручную
    // или при смене типа хранения
    const fetchExpiry = async () => {
      try {
        const result = await utils.inventory.suggestExpiry.fetch({
          productName: item.productName,
          storageType: selection.storage,
          purchaseDate: purchaseDate || undefined,
        });
        if (result.matched && result.expiryDate) {
          onChange({ ...selection, expiryDate: result.expiryDate });
        }
      } catch {
        // Если ошибка — ничего не делаем, пользователь введёт вручную
      }
    };

    fetchExpiry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.storage, selection.checked]);

  return (
    <li className={`rounded-xl border p-3 transition-colors ${selection.checked ? 'border-primary bg-primary/5' : 'border-line bg-paper opacity-60'}`}>
      {/* Чекбокс + название */}
      <label className="flex items-center gap-3 cursor-pointer mb-2">
        <input
          type="checkbox"
          checked={selection.checked}
          onChange={(e) => {
            onChange({ ...selection, checked: e.target.checked });
          }}
          className="w-5 h-5 rounded border-line text-primary focus:ring-primary"
        />
        <span className="font-medium text-ink flex-1 min-w-0 truncate">{item.productName}</span>
      </label>

      {/* Настройки хранения (видны если отмечен) */}
      {selection.checked && (
        <div className="grid grid-cols-2 gap-2 pl-8">
          {/* Где хранить */}
          <div>
            <span className="block text-xs text-ink-muted mb-1">Где хранить</span>
            <select
              value={selection.storage}
              onChange={(e) => {
                // При смене хранения сбрасываем срок — useEffect подтянет новый
                onChange({
                  ...selection,
                  storage: e.target.value as 'fridge' | 'freezer' | 'pantry',
                  expiryDate: '',
                });
              }}
              className="w-full h-10 px-2 rounded-lg border border-line bg-paper text-sm focus:border-primary focus:outline-none"
            >
              <option value="fridge">🧊 Холодильник</option>
              <option value="freezer">❄️ Морозилка</option>
              <option value="pantry">🏠 Кладовая</option>
            </select>
          </div>
          {/* Годен до */}
          <div>
            <span className="block text-xs text-ink-muted mb-1">Годен до</span>
            <input
              type="date"
              value={selection.expiryDate}
              onChange={(e) => {
                onChange({ ...selection, expiryDate: e.target.value });
              }}
              className="w-full h-10 px-2 rounded-lg border border-line bg-paper text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      )}
    </li>
  );
}

export function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(params.id);

  const [showAddManual, setShowAddManual] = useState(false);

  // «Показать сырой текст OCR» — раскрывающийся блок для отладки
  const [showRaw, setShowRaw] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  // Инлайн-редактирование шапки чека
  const [editingStore, setEditingStore] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [eStore, setEStore] = useState("");
  const [eDate, setEDate] = useState("");

  // Инлайн-редактирование позиции
  const [editingId, setEditingId] = useState<number | null>(null);
  const [eName, setEName] = useState("");
  const [ePrice, setEPrice] = useState("");

  // Форма ручного добавления
  const [mName, setMName] = useState("");
  const [mQty, setMQty] = useState("");
  const [mUnit, setMUnit] = useState("");
  const [mPrice, setMPrice] = useState("");

  // Диалог «В инвентарь»
  const [showToInventory, setShowToInventory] = useState(false);
  const [invSelections, setInvSelections] = useState<
    Record<number, { checked: boolean; storage: 'fridge' | 'freezer' | 'pantry'; expiryDate: string }>
  >({});

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

  const updateReceipt = trpc.receipts.update.useMutation({
    onSuccess: () => {
      utils.receipts.getById.invalidate({ id });
      setEditingStore(false);
      setEditingDate(false);
    },
  });

  const deleteReceipt = trpc.receipts.delete.useMutation({
    onSuccess: () => {
      utils.receipts.list.invalidate();
      navigate("/receipts");
    },
  });

  const addBulkToInventory = trpc.inventory.addBulk.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      setShowToInventory(false);
      setInvSelections({});
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
            {/* Название магазина — кликабельно для редактирования */}
            {editingStore ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  autoFocus
                  className="h-9 px-3 border border-primary rounded-lg text-ink text-lg font-serif focus:outline-none flex-1"
                  value={eStore}
                  onChange={e => setEStore(e.target.value)}
                  placeholder="Название магазина"
                  onKeyDown={e => {
                    if (e.key === 'Enter') updateReceipt.mutate({ id, storeName: eStore || null });
                    if (e.key === 'Escape') setEditingStore(false);
                  }}
                />
                <button onClick={() => updateReceipt.mutate({ id, storeName: eStore || null })}
                  className="w-8 h-8 rounded-lg bg-primary text-paper flex items-center justify-center">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditingStore(false)}
                  className="w-8 h-8 rounded-lg border border-line text-ink-muted flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <h1
                className="font-serif text-3xl font-semibold text-ink leading-tight inline-flex items-center gap-3 cursor-pointer group"
                onClick={() => { setEStore(receipt.storeName ?? ""); setEditingStore(true); }}
              >
                <ReceiptIcon size={26} className="text-primary" strokeWidth={2} />
                {receipt.storeName || <span className="text-ink-muted">Нажми чтобы добавить магазин</span>}
                <Pencil size={14} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}

            {/* Дата — кликабельна для редактирования */}
            <div className="flex items-center gap-2 mt-1">
              {editingDate ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="date"
                    className="h-8 px-2 border border-primary rounded-lg text-ink text-sm focus:outline-none"
                    value={eDate}
                    onChange={e => setEDate(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') updateReceipt.mutate({ id, purchaseDate: eDate || null });
                      if (e.key === 'Escape') setEditingDate(false);
                    }}
                  />
                  <button onClick={() => updateReceipt.mutate({ id, purchaseDate: eDate || null })}
                    className="w-7 h-7 rounded-lg bg-primary text-paper flex items-center justify-center">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingDate(false)}
                    className="w-7 h-7 rounded-lg border border-line text-ink-muted flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <span
                  className="text-ink-soft cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  onClick={() => { setEDate(receipt.purchaseDate ?? ""); setEditingDate(true); }}
                >
                  {receipt.purchaseDate
                    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                        .format(new Date(receipt.purchaseDate))
                    : <span className="text-alert">Нажми чтобы добавить дату</span>
                  }
                  <Pencil size={12} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              )}
              <span className="text-ink-soft">· {currency}</span>
              {receipt.totalAmount && (
                <span className="text-ink-soft">
                  · итог по чеку:{" "}
                  <span className="tabular-nums text-ink font-medium">
                    {formatPrice(receipt.totalAmount as unknown as string, currency)}
                  </span>
                </span>
              )}
            </div>
          </div>
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
            className="w-10 h-10 rounded-lg border border-line bg-paper text-ink-soft hover:text-alert hover:border-alert flex items-center justify-center transition-colors shrink-0"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            // Инициализируем чекбоксы для всех позиций
            const sel: typeof invSelections = {};
            items.forEach(it => {
              sel[it.id] = { checked: true, storage: 'fridge', expiryDate: '' };
            });
            setInvSelections(sel);
            setShowToInventory(true);
          }}
          disabled={items.length === 0}
          className="inline-flex items-center gap-2 h-12 px-4 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Package size={18} />
          В инвентарь
        </button>
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

      {/* Диалог «В инвентарь» — массовое добавление товаров из чека */}
      {showToInventory && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => !addBulkToInventory.isPending && setShowToInventory(false)}
        >
          <div
            className="bg-paper rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-serif text-xl font-semibold text-ink">
                Добавить в инвентарь
              </h3>
              <button
                type="button"
                onClick={() => setShowToInventory(false)}
                aria-label="Закрыть"
                className="w-9 h-9 -m-1 rounded-lg text-ink-soft hover:bg-cream flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-ink-soft mb-4">
              Выбери товары и укажи где хранить и до какого числа годен:
            </p>

            {/* Быстрые кнопки: выбрать все / снять все */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  const sel = { ...invSelections };
                  Object.keys(sel).forEach(k => { sel[Number(k)].checked = true; });
                  setInvSelections(sel);
                }}
                className="text-xs text-primary hover:underline"
              >
                Выбрать все
              </button>
              <span className="text-ink-muted">·</span>
              <button
                type="button"
                onClick={() => {
                  const sel = { ...invSelections };
                  Object.keys(sel).forEach(k => { sel[Number(k)].checked = false; });
                  setInvSelections(sel);
                }}
                className="text-xs text-ink-soft hover:underline"
              >
                Снять все
              </button>
            </div>

            {/* Список позиций */}
            <ul className="space-y-3 mb-5">
              {items.map((it) => {
                const sel = invSelections[it.id];
                if (!sel) return null;
                return (
                  <InventoryItemRow
                    key={it.id}
                    item={{ id: it.id, productName: it.productName }}
                    selection={sel}
                    purchaseDate={receipt.purchaseDate}
                    onChange={(newSel) => {
                      setInvSelections(prev => ({
                        ...prev,
                        [it.id]: newSel,
                      }));
                    }}
                  />
                );
              })}
            </ul>

            {/* Кнопки */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowToInventory(false)}
                disabled={addBulkToInventory.isPending}
                className="px-4 h-11 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={
                  addBulkToInventory.isPending ||
                  !Object.values(invSelections).some(s => s.checked)
                }
                onClick={() => {
                  const toAdd = items
                    .filter(it => invSelections[it.id]?.checked)
                    .map(it => {
                      const sel = invSelections[it.id];
                      return {
                        productName: it.productName,
                        quantity: it.quantity ? parseFloat(String(it.quantity)) : null,
                        unit: it.unit ?? null,
                        storageType: sel.storage,
                        expiryDate: sel.expiryDate || null,
                      };
                    });
                  addBulkToInventory.mutate({ items: toAdd });
                }}
                className="px-5 h-11 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Package size={16} />
                {addBulkToInventory.isPending
                  ? "Добавляю…"
                  : `Добавить (${Object.values(invSelections).filter(s => s.checked).length})`
                }
              </button>
            </div>

            {addBulkToInventory.isSuccess && (
              <p className="text-sm text-primary mt-3 text-center font-medium">
                ✓ Добавлено в инвентарь!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
