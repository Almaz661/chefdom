import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ScrollText, Receipt as ReceiptIcon, X } from "lucide-react";
import { trpc } from "../utils/trpc";

// Российский формат даты «15 мая 2026»
function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatAmount(amount: string | null, currency: string): string {
  if (amount === null) return "";
  const n = parseFloat(amount);
  const symbol = currency === "EUR" ? "€" : "₽";
  return `${symbol}${n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReceiptsPage() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [currency, setCurrency] = useState<"EUR" | "RUB">("EUR");

  const utils = trpc.useUtils();
  const list = trpc.receipts.list.useQuery();

  const create = trpc.receipts.create.useMutation({
    onSuccess: ({ id }) => {
      utils.receipts.list.invalidate();
      setShowCreate(false);
      setStoreName("");
      setPurchaseDate("");
      navigate(`/receipts/${id}`);
    },
  });

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink mb-1">
            Чеки
          </h1>
          <p className="text-ink-soft">Покупки в магазинах</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} />
          Добавить чек
        </button>
      </div>

      {list.isLoading && <p className="text-ink-muted">Загрузка…</p>}

      {!list.isLoading && list.data && list.data.length === 0 && (
        <div className="bg-paper border border-line border-dashed rounded-2xl p-10 text-center">
          <ScrollText
            size={36}
            className="text-line-strong mx-auto mb-3"
            strokeWidth={1.5}
          />
          <p className="text-ink-soft">
            Пока нет ни одного чека.
            <br />
            Нажми «Добавить чек» чтобы начать.
          </p>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <ul className="space-y-2">
          {list.data.map((r) => (
            <li key={r.id}>
              <Link
                to={`/receipts/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 bg-paper border border-line rounded-xl hover:border-primary transition-colors"
              >
                <ReceiptIcon
                  size={20}
                  className="text-primary shrink-0"
                  strokeWidth={2}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink truncate">
                    {r.storeName || "Чек без названия"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDate(r.purchaseDate)}
                    {r.status === "draft" && " · черновик"}
                  </p>
                </div>
                {r.totalAmount && (
                  <span className="font-medium tabular-nums text-ink shrink-0">
                    {formatAmount(r.totalAmount as unknown as string, r.currency)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Модалка создания чека */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center p-6 z-50"
          onClick={() => !create.isPending && setShowCreate(false)}
        >
          <div
            className="bg-paper rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-serif text-xl font-semibold text-ink">
                Новый чек
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Закрыть"
                className="w-9 h-9 -m-1 rounded-lg text-ink-soft hover:bg-cream flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <label className="block mb-3">
              <span className="block text-sm font-medium text-ink-soft mb-1">
                Магазин
              </span>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Albert Heijn, Пятёрочка…"
                className="w-full h-12 px-3 rounded-lg border border-line bg-paper focus:border-primary focus:outline-none"
              />
            </label>

            <label className="block mb-3">
              <span className="block text-sm font-medium text-ink-soft mb-1">
                Дата покупки
              </span>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full h-12 px-3 rounded-lg border border-line bg-paper focus:border-primary focus:outline-none"
              />
            </label>

            <fieldset className="mb-5">
              <legend className="block text-sm font-medium text-ink-soft mb-1">
                Валюта
              </legend>
              <div className="inline-flex bg-cream rounded-lg p-0.5">
                {(["EUR", "RUB"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      currency === c
                        ? "bg-primary text-paper"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {c === "EUR" ? "€ EUR" : "₽ RUB"}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={create.isPending}
                className="px-4 h-11 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() =>
                  create.mutate({
                    storeName: storeName.trim() || undefined,
                    purchaseDate: purchaseDate || undefined,
                    currency,
                  })
                }
                disabled={create.isPending}
                className="px-4 h-11 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {create.isPending ? "Создаю…" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
