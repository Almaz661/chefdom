import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, X, Receipt as ReceiptIcon } from "lucide-react";
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

export function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(params.id);

  const [showAddManual, setShowAddManual] = useState(false);

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

      {/* Кнопка добавления — теперь только ручная */}
      <div>
        <button
          type="button"
          onClick={() => setShowAddManual(true)}
          className="inline-flex items-center gap-2 h-12 px-4 rounded-lg border border-line bg-paper text-ink font-medium hover:border-primary hover:text-primary transition-colors"
        >
          <Plus size={18} />
          Добавить позицию вручную
        </button>
      </div>

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
            {items.map((it) => (
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
                  onClick={() => deleteItem.mutate({ id: it.id })}
                  aria-label="Удалить позицию"
                  className="w-9 h-9 rounded-lg text-ink-muted hover:text-alert hover:bg-cream flex items-center justify-center shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
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
    </div>
  );
}
