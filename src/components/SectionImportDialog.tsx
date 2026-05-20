import { useState, useEffect, FormEvent } from "react";
import { X, Loader2, FolderDown, Square } from "lucide-react";
import { trpc } from "../utils/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SectionImportDialog({ open, onClose }: Props) {
  const [url, setUrl] = useState("");
  const [started, setStarted] = useState(false);

  const utils = trpc.useUtils();

  const start = trpc.recipes.importSectionStart.useMutation({
    onSuccess: () => {
      setStarted(true);
    },
  });

  const cancel = trpc.recipes.importSectionCancel.useMutation({
    onSuccess: () => {
      utils.recipes.importSectionStatus.invalidate();
    },
  });

  // Polling статуса каждые 1.5 сек пока job активен
  const status = trpc.recipes.importSectionStatus.useQuery(undefined, {
    enabled: started,
    refetchInterval: started ? 1500 : false,
  });

  const job = status.data;
  const isDone =
    job && (job.status === "done" || job.status === "cancelled" || job.status === "error");

  // Когда job завершился — сбросить polling, обновить список рецептов
  useEffect(() => {
    if (isDone) {
      setStarted(false);
      utils.recipes.list.invalidate();
      utils.recipes.getStats.invalidate();
      utils.recipes.getCategories.invalidate();
    }
  }, [isDone, utils]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    start.mutate({ url: trimmed });
  };

  const handleClose = () => {
    if (job && job.status === "running") return; // не закрывать пока идёт
    setUrl("");
    setStarted(false);
    start.reset();
    onClose();
  };

  const handleCancel = () => {
    cancel.mutate();
  };

  const progress =
    job && job.total > 0
      ? Math.round((job.processed / job.total) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center p-6 z-50"
      onClick={handleClose}
    >
      <div
        className="bg-paper rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-serif text-2xl font-semibold text-ink">
            Импорт раздела
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={job?.status === "running"}
            aria-label="Закрыть"
            className="text-ink-muted hover:text-ink disabled:opacity-50 -mt-1"
          >
            <X size={22} />
          </button>
        </div>

        {/* Форма — показывается до начала */}
        {!started && !isDone && (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Ссылка на раздел сайта
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://povar.ru/recipes/zakuski/"
              disabled={start.isPending}
              autoFocus
              required
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary disabled:opacity-60"
            />
            <p className="text-ink-muted text-xs mt-2 leading-relaxed">
              Вставьте ссылку на страницу со списком рецептов. Импорт найдёт все
              рецепты раздела (включая пагинацию) и загрузит по одному. Не
              закрывайте вкладку во время импорта.
            </p>

            {start.error && (
              <div className="mt-4 bg-alert/10 border border-alert/40 text-alert rounded-lg p-3 text-sm">
                {start.error.message}
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={handleClose}
                disabled={start.isPending}
                className="px-4 h-11 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream disabled:opacity-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={start.isPending || !url.trim()}
                className="px-4 h-11 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
              >
                {start.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Запускаю...
                  </>
                ) : (
                  <>
                    <FolderDown size={16} />
                    Начать импорт
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Прогресс */}
        {job && job.status === "running" && (
          <div className="space-y-4">
            {/* Прогресс-бар */}
            <div>
              <div className="flex justify-between text-sm text-ink-soft mb-1.5">
                <span>
                  {job.processed} / {job.total} рецептов
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2.5 bg-cream rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Текущий */}
            {job.currentTitle && (
              <p className="text-ink text-sm truncate">
                <span className="text-ink-muted">Сейчас:</span>{" "}
                {job.currentTitle}
              </p>
            )}

            {/* Статистика */}
            <div className="flex gap-4 text-sm">
              <span className="text-fresh">✓ {job.success}</span>
              <span className="text-ink-muted">пропуск: {job.skipped}</span>
              {job.failed > 0 && (
                <span className="text-alert">✗ {job.failed}</span>
              )}
            </div>

            {/* Кнопка прервать */}
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancel.isPending}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-alert text-alert text-sm font-medium hover:bg-alert/10 disabled:opacity-50 transition-colors"
            >
              <Square size={14} />
              Прервать
            </button>
          </div>
        )}

        {/* Завершено */}
        {isDone && job && (
          <div className="space-y-4">
            <div
              className={`text-lg font-medium ${
                job.status === "done"
                  ? "text-fresh"
                  : job.status === "cancelled"
                    ? "text-warning"
                    : "text-alert"
              }`}
            >
              {job.status === "done" && "Импорт завершён"}
              {job.status === "cancelled" && "Импорт прерван"}
              {job.status === "error" && "Импорт завершился с ошибкой"}
            </div>

            <div className="flex gap-4 text-sm">
              <span className="text-fresh">✓ Загружено: {job.success}</span>
              <span className="text-ink-muted">
                Пропущено (дубли): {job.skipped}
              </span>
              {job.failed > 0 && (
                <span className="text-alert">Ошибки: {job.failed}</span>
              )}
            </div>

            {/* Ошибки (первые 10) */}
            {job.errors.length > 0 && (
              <details className="text-sm">
                <summary className="text-alert cursor-pointer">
                  Ошибки ({job.errors.length})
                </summary>
                <ul className="mt-2 space-y-1 text-ink-soft text-xs max-h-40 overflow-y-auto">
                  {job.errors.slice(0, 10).map((e, i) => (
                    <li key={i} className="break-all">
                      <span className="text-alert">{e.message}</span>{" "}
                      <span className="text-ink-muted">{e.url}</span>
                    </li>
                  ))}
                  {job.errors.length > 10 && (
                    <li className="text-ink-muted">
                      ...и ещё {job.errors.length - 10}
                    </li>
                  )}
                </ul>
              </details>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="px-4 h-11 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
