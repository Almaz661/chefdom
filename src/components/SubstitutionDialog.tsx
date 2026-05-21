import { X } from "lucide-react";
import { trpc } from "../utils/trpc";

interface Props {
  ingredientName: string;
  onClose: () => void;
}

// B.3 — Диалог «Чем заменить ингредиент».
// Берёт замены из таблицы ingredient_substitutions через products.getSubstitutions.
// Если замен нет — пользователю прямо говорим, что данных пока нет.
// Поиск по имени ингредиента нечувствителен к регистру (ilike в роутере).
export function SubstitutionDialog({ ingredientName, onClose }: Props) {
  const query = trpc.products.getSubstitutions.useQuery({ ingredientName });

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center p-6 z-50"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-serif text-xl font-semibold text-ink">
            Чем заменить
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 -m-1 rounded-lg text-ink-soft hover:bg-cream flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-ink-soft mb-5 italic">«{ingredientName}»</p>

        {query.isLoading && (
          <p className="text-ink-muted text-sm">Загрузка…</p>
        )}

        {query.error && (
          <p className="text-alert text-sm">{query.error.message}</p>
        )}

        {query.data && query.data.length === 0 && (
          <p className="text-ink-muted text-sm">
            Замены пока не добавлены для этого ингредиента.
          </p>
        )}

        {query.data && query.data.length > 0 && (
          <ul className="space-y-2">
            {query.data.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-cream rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{s.alternativeName}</p>
                  {s.quality && (
                    <p className="text-xs text-ink-muted mt-0.5">{s.quality}</p>
                  )}
                </div>
                {s.quantityRatio && (
                  <span className="font-medium tabular-nums text-ink-soft text-sm shrink-0">
                    × {s.quantityRatio}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
