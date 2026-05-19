import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { X, Loader2, Download } from "lucide-react";
import { trpc } from "../utils/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RecipeImportDialog({ open, onClose }: Props) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [url, setUrl] = useState("");

  const imp = trpc.recipes.importFromUrl.useMutation({
    onSuccess: (data) => {
      utils.recipes.invalidate();
      setUrl("");
      onClose();
      navigate(`/recipes/${data.id}`);
    },
  });

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    imp.mutate({ url: trimmed });
  };

  const handleClose = () => {
    if (imp.isPending) return;
    setUrl("");
    imp.reset();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center p-6 z-50"
      onClick={handleClose}
    >
      <div
        className="bg-paper rounded-2xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-serif text-2xl font-semibold text-ink">
            Импорт рецепта
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={imp.isPending}
            aria-label="Закрыть"
            className="text-ink-muted hover:text-ink disabled:opacity-50 -mt-1"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Ссылка на рецепт
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://povar.ru/recipes/..."
            disabled={imp.isPending}
            autoFocus
            required
            className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary disabled:opacity-60"
          />

          <p className="text-ink-muted text-xs mt-2 leading-relaxed">
            Поддерживаются сайты с разметкой Schema.org (povar.ru, eda.ru,
            iamcook.ru, gotovim.ru, koolinar.ru) и menunedeli.ru. Если рецепт
            распознаётся плохо — сохрани и допиши вручную в редакторе.
          </p>

          {imp.error && (
            <div className="mt-4 bg-alert/10 border border-alert/40 text-alert rounded-lg p-3 text-sm">
              {imp.error.message}
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={imp.isPending}
              className="px-4 h-11 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream disabled:opacity-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={imp.isPending || !url.trim()}
              className="px-4 h-11 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
            >
              {imp.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Загружаю...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Импортировать
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
