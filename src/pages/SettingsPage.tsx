import { useState, useRef, FormEvent } from "react";
import { Download, Upload, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { trpc } from "../utils/trpc";

export function SettingsPage() {
  const [showChangePin, setShowChangePin] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats } = trpc.settings.getStats.useQuery();

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

  return (
    <div className="max-w-lg mx-auto p-4 lg:p-8">
      <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink mb-8">
        Настройки
      </h1>

      {/* АККАУНТ */}
      <section className="mb-6">
        <h2 className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-3">
          Аккаунт
        </h2>
        <div className="bg-paper border border-line rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Семья</p>
              <p className="text-sm text-ink-muted">PIN: ••••</p>
            </div>
            <button
              onClick={() => setShowChangePin(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg border border-line text-sm font-medium text-ink hover:bg-cream transition-colors"
            >
              <KeyRound size={16} />
              Изменить PIN
            </button>
          </div>
        </div>
      </section>

      {/* ДАННЫЕ */}
      <section className="mb-6">
        <h2 className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-3">
          Данные
        </h2>
        <div className="bg-paper border border-line rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-ink">Резервная копия</p>

          <button
            onClick={handleExport}
            disabled={exportQuery.isFetching}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
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
            className="w-full h-12 flex items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-cream disabled:opacity-50 transition-colors"
          >
            {importMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Upload size={18} />
            )}
            Восстановить из файла
          </button>

          {importStatus === "success" && (
            <div className="flex items-center gap-2 text-sm text-fresh">
              <CheckCircle2 size={16} />
              Данные успешно восстановлены
            </div>
          )}
          {importStatus === "error" && (
            <div className="flex items-center gap-2 text-sm text-alert">
              <AlertCircle size={16} />
              {importError || "Ошибка при восстановлении"}
            </div>
          )}
        </div>
      </section>

      {/* О ПРИЛОЖЕНИИ */}
      <section>
        <h2 className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-3">
          О приложении
        </h2>
        <div className="bg-paper border border-line rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-ink">ШефДом! версия 1.0</p>
          <p className="text-sm text-ink-muted">
            Рецептов в базе: {stats?.recipesCount ?? "—"}
          </p>
          <p className="text-sm text-ink-muted">База данных: Neon PostgreSQL</p>
        </div>
      </section>

      {/* Модалка смены PIN */}
      {showChangePin && (
        <ChangePinDialog onClose={() => setShowChangePin(false)} />
      )}
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
      className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-paper w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-semibold text-ink mb-4">
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
            className="w-full h-12 px-4 bg-cream border border-line rounded-lg text-ink text-center tracking-widest text-lg focus:outline-none focus:border-primary"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="Новый PIN"
            required
            className="w-full h-12 px-4 bg-cream border border-line rounded-lg text-ink text-center tracking-widest text-lg focus:outline-none focus:border-primary"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="Повторите новый PIN"
            required
            className="w-full h-12 px-4 bg-cream border border-line rounded-lg text-ink text-center tracking-widest text-lg focus:outline-none focus:border-primary"
          />

          {error && (
            <p className="text-sm text-alert flex items-center gap-1">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={changePin.isPending}
              className="flex-1 h-12 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
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
