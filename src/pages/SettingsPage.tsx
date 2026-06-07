import { useState, useRef, FormEvent } from "react";
import { Download, Upload, KeyRound, Loader2, CheckCircle2, AlertCircle, Coins, RefreshCw, Calculator } from "lucide-react";
import { trpc } from "../utils/trpc";

export function SettingsPage() {
  const [showChangePin, setShowChangePin] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [importError, setImportError] = useState("");
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [recalcStatus, setRecalcStatus] = useState<
    | { type: "idle" }
    | { type: "success"; total: number; updated: number; failed: number }
    | { type: "error"; message: string }
  >({ type: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats } = trpc.settings.getStats.useQuery();

  // --- Валюта по умолчанию (EUR/RUB) ---
  // Влияет на: значение по умолчанию в форме «Новый чек вручную»
  // и fallback в парсере OCR, если магазин не распознан.
  const utils = trpc.useUtils();
  const currencyQuery = trpc.settings.getCurrency.useQuery();
  const setCurrency = trpc.settings.setCurrency.useMutation({
    onMutate: async ({ currency }) => {
      // Оптимистично обновим, чтобы переключатель сработал мгновенно
      await utils.settings.getCurrency.cancel();
      const prev = utils.settings.getCurrency.getData();
      utils.settings.getCurrency.setData(undefined, { currency });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.settings.getCurrency.setData(undefined, ctx.prev);
    },
    onSettled: () => {
      utils.settings.getCurrency.invalidate();
    },
  });
  const currency = currencyQuery.data?.currency ?? "EUR";

  // --- Скачать backup ---
  const exportQuery = trpc.settings.exportBackup.useQuery(undefined, {
    enabled: false,
  });

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) return;

    const json = JSON.stringify(result.data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `shefdom-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Восстановить из файла ---
  const importMutation = trpc.settings.importBackup.useMutation({
    onSuccess: () => {
      setImportStatus("success");
      setTimeout(() => setImportStatus("idle"), 3000);
    },
    onError: (err) => {
      setImportStatus("error");
      setImportError(err.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      "Это заменит ВСЕ текущие данные. Продолжить?"
    );
    if (!confirmed) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setImportStatus("idle");
        importMutation.mutate(data);
      } catch {
        setImportStatus("error");
        setImportError("Файл повреждён или имеет неверный формат");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- Пересчитать КБЖУ во всех рецептах ---
  // Кнопка для разовой починки старых рецептов, у которых калорий нет.
  // Отправляет всю работу на бэк (loops over recipes), фронт показывает
  // спиннер. После успеха — toast с количеством обновлённых рецептов.
  const recalcMutation = trpc.recipes.recalcAllNutrition.useMutation({
    onSuccess: ({ total, updated, failed }) => {
      setRecalcStatus({ type: "success", total, updated, failed });
      // Сбросить toast через 8 сек
      setTimeout(() => setRecalcStatus({ type: "idle" }), 8000);
    },
    onError: (err) => {
      setRecalcStatus({ type: "error", message: err.message });
    },
  });

  const handleRecalcNutrition = () => {
    const confirmed = window.confirm(
      "Пересчитать калории во всех рецептах?\n\n" +
        "Программа пройдёт по всем сохранённым рецептам и попробует посчитать " +
        "калории по справочнику продуктов. Существующие значения будут перезаписаны " +
        "(если ингредиенты найдутся в справочнике).\n\n" +
        "Это может занять до пары минут."
    );
    if (!confirmed) return;
    setRecalcStatus({ type: "idle" });
    recalcMutation.mutate();
  };

  // --- Очистить кэш и перезагрузить ---
  // Удаляет все Cache Storage записи + перерегистрирует Service Worker.
  // Полезно если приложение «застряло» на старой версии или какой-то ассет
  // закэшировался битым. По сути — программная замена «Hard Refresh» в браузере.
  // НЕ трогает локальные данные пользователя (БД, токены — на сервере).
  const handleClearCache = async () => {
    const confirmed = window.confirm(
      "Очистить кэш и перезагрузить приложение?\n\n" +
        "Твои данные (рецепты, чеки, инвентарь) останутся на месте — они хранятся на сервере. " +
        "Очистится только локальная копия страниц."
    );
    if (!confirmed) return;

    setIsClearingCache(true);
    try {
      // Удалить все кеши (Cache Storage API). На некоторых старых браузерах
      // caches может отсутствовать — тогда просто перезагружаем без ошибки.
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Снять регистрацию Service Worker — при следующей загрузке он
      // зарегистрируется заново со свежей версией.
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (err) {
      // Не критично — если что-то не удалилось, всё равно перезагрузимся
      // с принудительным обходом кеша. Логируем для дебага.
      console.warn("[clear-cache] частичная ошибка:", err);
    }
    // Жёсткая перезагрузка с сервера (не из браузерного кеша).
    // location.reload() без аргументов в современных браузерах эквивалентен
    // обычному reload; используем replace на текущий URL, чтобы гарантированно
    // сделать полный navigate.
    window.location.replace(window.location.pathname + window.location.search);
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      <div className="max-w-3xl mx-auto px-6 py-8 lg:py-12">
        <h1 className="font-serif text-3xl text-white font-semibold mb-8">
          Настройки
        </h1>

        {/* АККАУНТ */}
        <section className="mb-6">
          <h2 className="text-white/70 font-bold text-lg mb-3">
            Аккаунт
          </h2>
          <div className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-white/80">Семья</p>
                <p className="text-base text-white/50">PIN: ••••</p>
              </div>
              <button
                onClick={() => setShowChangePin(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-white/[0.04] border border-[var(--color-line)] text-white/60 text-base font-semibold hover:border-white/[0.15] hover:text-white/80 transition-colors"
              >
                <KeyRound size={16} />
                Изменить PIN
              </button>
            </div>
          </div>
        </section>

        {/* ВАЛЮТА */}
        <section className="mb-6">
          <h2 className="text-white/70 font-bold text-lg mb-3">
            Валюта
          </h2>
          <div className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Coins
                size={20}
                className="text-[var(--color-primary)] mt-0.5 shrink-0"
                strokeWidth={2}
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white/80">Валюта по умолчанию</p>
                <p className="text-base text-white/50">
                  Подставляется в новый чек и используется для отображения цен,
                  если магазин не распознан.
                </p>
              </div>
            </div>
            <div
              role="radiogroup"
              aria-label="Валюта по умолчанию"
              className="inline-flex bg-white/[0.04] border border-[var(--color-line)] rounded-xl p-0.5"
            >
              {(["EUR", "RUB"] as const).map((c) => {
                const selected = currency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      if (!selected && !setCurrency.isPending) {
                        setCurrency.mutate({ currency: c });
                      }
                    }}
                    disabled={
                      currencyQuery.isLoading ||
                      (setCurrency.isPending && !selected)
                    }
                    className={`px-4 py-2 rounded-xl text-base font-semibold transition-colors ${
                      selected
                        ? "bg-[var(--color-primary)] text-[#0a0c10]"
                        : "text-white/50 hover:text-white/80"
                    } disabled:opacity-50`}
                  >
                    {c === "EUR" ? "€ EUR" : "₽ RUB"}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ДАННЫЕ */}
        <section className="mb-6">
          <h2 className="text-white/70 font-bold text-lg mb-3">
            Данные
          </h2>
          <div className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-4 space-y-3">
            <p className="text-base font-semibold text-white/80">Резервная копия</p>

            <button
              onClick={handleExport}
              disabled={exportQuery.isFetching}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-[#0a0c10] font-semibold hover:brightness-110 disabled:opacity-50 transition-colors"
            >
              {exportQuery.isFetching ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Download size={18} />
              )}
              Скачать backup (JSON)
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-[var(--color-line)] text-white/60 text-base font-semibold hover:border-white/[0.15] hover:text-white/80 disabled:opacity-50 transition-colors"
            >
              {importMutation.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Upload size={18} />
              )}
              Восстановить из файла
            </button>

            {importStatus === "success" && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle2 size={16} />
                Данные успешно восстановлены
              </div>
            )}
            {importStatus === "error" && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle size={16} />
                {importError || "Ошибка при восстановлении"}
              </div>
            )}
          </div>
        </section>

        {/* КБЖУ */}
        <section className="mb-6">
          <h2 className="text-white/70 font-bold text-lg mb-3">
            Калории
          </h2>
          <div className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Calculator
                size={20}
                className="text-[var(--color-primary)] mt-0.5 shrink-0"
                strokeWidth={2}
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white/80">
                  Пересчитать калории
                </p>
                <p className="text-base text-white/50">
                  Запустит расчёт КБЖУ по справочнику продуктов для всех
                  сохранённых рецептов. Полезно если у старых рецептов нет
                  калорий.
                </p>
              </div>
            </div>
            <button
              onClick={handleRecalcNutrition}
              disabled={recalcMutation.isPending}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-[var(--color-line)] text-white/60 text-base font-semibold hover:border-white/[0.15] hover:text-white/80 disabled:opacity-50 transition-colors"
            >
              {recalcMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Считаю…
                </>
              ) : (
                <>
                  <Calculator size={18} />
                  Пересчитать все рецепты
                </>
              )}
            </button>

            {recalcStatus.type === "success" && (
              <div className="flex items-start gap-2 text-sm text-green-400">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span>
                  Готово: обновлено {recalcStatus.updated} из{" "}
                  {recalcStatus.total} рецептов
                  {recalcStatus.failed > 0 &&
                    ` (с ошибкой: ${recalcStatus.failed})`}
                </span>
              </div>
            )}
            {recalcStatus.type === "error" && (
              <div className="flex items-start gap-2 text-sm text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{recalcStatus.message}</span>
              </div>
            )}
          </div>
        </section>

        {/* КЭШ ПРИЛОЖЕНИЯ */}
        <section className="mb-6">
          <h2 className="text-white/70 font-bold text-lg mb-3">
            Кэш приложения
          </h2>
          <div className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-4 space-y-3">
            <p className="text-base text-white/50">
              Если приложение «застряло» на старой версии или что-то отображается
              странно — нажми, чтобы загрузить свежие страницы. Твои данные (рецепты,
              чеки, инвентарь) не пострадают: они на сервере.
            </p>
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-[var(--color-line)] text-white/60 text-base font-semibold hover:border-white/[0.15] hover:text-white/80 disabled:opacity-50 transition-colors"
            >
              {isClearingCache ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )}
              Очистить кэш и перезагрузить
            </button>
          </div>
        </section>

        {/* О ПРИЛОЖЕНИИ */}
        <section>
          <h2 className="text-white/70 font-bold text-lg mb-3">
            О приложении
          </h2>
          <div className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-4 space-y-2">
            <p className="text-base font-semibold text-white/80">ШефДом! версия 1.0</p>
            <p className="text-base text-white/50">
              Рецептов в базе: {stats?.recipesCount ?? "—"}
            </p>
            <p className="text-base text-white/50">База данных: Neon PostgreSQL</p>
          </div>
        </section>

        {/* Модалка смены PIN */}
        {showChangePin && (
          <ChangePinDialog onClose={() => setShowChangePin(false)} />
        )}
      </div>
    </div>
  );
}

// --- Диалог смены PIN ---

function ChangePinDialog({ onClose }: { onClose: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  const changePin = trpc.auth.changePin.useMutation({
    onSuccess: () => {
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("PIN должен состоять из 4 цифр");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PIN не совпадают");
      return;
    }

    changePin.mutate({ currentPin, newPin });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-paper)] border border-[var(--color-line)] rounded-2xl w-full sm:max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-semibold text-white mb-4">
          Изменить PIN
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            placeholder="Текущий PIN"
            autoFocus
            required
            className="w-full h-12 px-4 bg-white/[0.04] border border-[var(--color-line)] rounded-xl text-white/80 text-center tracking-widest text-lg placeholder-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="Новый PIN"
            required
            className="w-full h-12 px-4 bg-white/[0.04] border border-[var(--color-line)] rounded-xl text-white/80 text-center tracking-widest text-lg placeholder-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="Повторите новый PIN"
            required
            className="w-full h-12 px-4 bg-white/[0.04] border border-[var(--color-line)] rounded-xl text-white/80 text-center tracking-widest text-lg placeholder-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
          />

          {error && (
            <p className="text-sm text-red-400 flex items-center gap-1">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-white/[0.04] border border-[var(--color-line)] text-white/60 font-medium hover:border-white/[0.15] hover:text-white/80 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={changePin.isPending}
              className="flex-1 h-12 rounded-xl bg-[var(--color-primary)] text-[#0a0c10] font-semibold hover:brightness-110 disabled:opacity-50 transition-colors"
            >
              {changePin.isPending ? (
                <Loader2 size={18} className="animate-spin mx-auto" />
              ) : (
                "Сохранить"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
