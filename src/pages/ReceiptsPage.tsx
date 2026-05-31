import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Plus, ScrollText, Receipt as ReceiptIcon, X } from "lucide-react";
import { trpc } from "../utils/trpc";

// G.19 — список чеков. Главный сценарий: «Сфотографировать чек»
// (камера → OCR → авто-создание чека). Запасной: «Добавить вручную».

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

// Конвертирует File в base64 без префикса data:...,
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== "string") {
        reject(new Error("Не удалось прочитать файл"));
        return;
      }
      // r вида "data:image/jpeg;base64,XXXXX" — режем префикс
      const comma = r.indexOf(",");
      resolve(comma >= 0 ? r.slice(comma + 1) : r);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Ошибка чтения файла"));
    reader.readAsDataURL(file);
  });
}

export function ReceiptsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showManual, setShowManual] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [currency, setCurrency] = useState<"EUR" | "RUB">("EUR");
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const list = trpc.receipts.list.useQuery();
  const currencySetting = trpc.settings.getCurrency.useQuery();
  // Когда настройка подгрузится — синхронизируем дефолт ручной формы.
  // Только пока модалка закрыта, чтобы не «прыгал» выбор пользователя
  // прямо в открытом диалоге.
  const settingCurrency = currencySetting.data?.currency;
  useEffect(() => {
    if (settingCurrency && !showManual && settingCurrency !== currency) {
      setCurrency(settingCurrency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingCurrency, showManual]);

  const create = trpc.receipts.create.useMutation({
    onSuccess: ({ id }) => {
      utils.receipts.list.invalidate();
      setShowManual(false);
      setStoreName("");
      setPurchaseDate("");
      navigate(`/receipts/${id}`);
    },
  });

  const createFromPhoto = trpc.receipts.createFromPhoto.useMutation({
    onSuccess: (res) => {
      utils.receipts.list.invalidate();
      setPhotoStatus(null);
      navigate(`/receipts/${res.id}`);
    },
    onError: (err) => {
      setPhotoStatus(null);
      setPhotoError(err.message);
    },
  });

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // чтобы повторный выбор того же файла сработал
    if (!file) return;
    setPhotoError(null);
    setPhotoStatus("Распознаю чек… Это займёт 5–15 секунд.");
    try {
      const base64 = await fileToBase64(file);
      // Язык: пользователь может настроить позже. По умолчанию eng.
      // OCR.space всё равно неплохо разбирает кириллицу в режиме eng,
      // но если в Render задана переменная OCR_LANG=rus — фронт пришлёт rus.
      // На старте — eng (большинство голландских чеков).
      createFromPhoto.mutate({ imageBase64: base64 });
    } catch (err) {
      setPhotoStatus(null);
      setPhotoError(err instanceof Error ? err.message : "Ошибка чтения файла");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <div>
        <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink mb-1">
          Чеки
        </h1>
        <p className="text-ink-soft">Покупки в магазинах</p>
      </div>

      {/* Главное действие — сфотографировать чек */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={createFromPhoto.isPending}
          className="w-full inline-flex items-center justify-center gap-2 h-14 px-4 rounded-xl bg-primary text-paper font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          <Camera size={20} />
          {createFromPhoto.isPending
            ? "Распознаю чек…"
            : "Сфотографировать чек"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-line bg-paper text-ink-soft text-sm font-medium hover:border-primary hover:text-primary transition-colors"
        >
          <Plus size={16} />
          Добавить вручную (без фото)
        </button>

        {photoStatus && (
          <p className="text-sm text-ink-soft text-center">{photoStatus}</p>
        )}
        {photoError && (
          <p className="text-sm text-alert bg-paper border border-alert rounded-lg p-3">
            {photoError}
          </p>
        )}
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
            Сфотографируй первый — на чеке найдётся магазин, дата и позиции.
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

      {/* Запасной флоу — ручное создание */}
      {showManual && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center p-6 z-50"
          onClick={() => !create.isPending && setShowManual(false)}
        >
          <div
            className="bg-paper rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-serif text-xl font-semibold text-ink">
                Новый чек вручную
              </h3>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                aria-label="Закрыть"
                className="w-9 h-9 -m-1 rounded-lg text-ink-soft hover:bg-surface-hover flex items-center justify-center"
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
              <div className="inline-flex bg-surface-elevated rounded-lg p-0.5">
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
                onClick={() => setShowManual(false)}
                disabled={create.isPending}
                className="px-4 h-11 rounded-lg border border-line text-ink-soft font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
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
