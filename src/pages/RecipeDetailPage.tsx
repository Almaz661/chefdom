import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Users,
  Flame,
  ChefHat,
  Timer,
  Pencil,
  Trash2,
} from "lucide-react";
import { trpc } from "../utils/trpc";

// Форматирование числа в российском формате: 1.5 → "1,5", 2 → "2".
function formatAmount(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(".", ",");
}

const PORTION_OPTIONS = [1, 2, 4];

export function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(params.id);
  const [multiplier, setMultiplier] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const utils = trpc.useUtils();
  const query = trpc.recipes.getById.useQuery(
    { id },
    { enabled: Number.isFinite(id) && id > 0 },
  );

  const del = trpc.recipes.delete.useMutation({
    onSuccess: () => {
      utils.recipes.invalidate();
      navigate("/recipes");
    },
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <Link
          to="/recipes"
          className="text-primary inline-flex items-center gap-1"
        >
          <ArrowLeft size={18} /> К рецептам
        </Link>
        <p className="text-ink-soft mt-6">Некорректный ID рецепта.</p>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <div className="text-ink-muted">Загрузка рецепта...</div>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <Link
          to="/recipes"
          className="text-primary inline-flex items-center gap-1 mb-6"
        >
          <ArrowLeft size={18} /> К рецептам
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-ink mb-2">
          Рецепт не найден
        </h1>
        <p className="text-ink-soft">
          {query.error?.message || "Возможно, он был удалён или неверный URL."}
        </p>
      </div>
    );
  }

  const { recipe, ingredients, steps } = query.data;
  const showImage = recipe.imageUrl && !imgError;
  const baseServings = recipe.servings || 1;
  const currentServings = baseServings * multiplier;

  // Группировка ингредиентов по groupName (если есть)
  const groups = new Map<string, typeof ingredients>();
  for (const ing of ingredients) {
    const key = ing.groupName || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ing);
  }

  const subline = [recipe.cuisine, recipe.category, recipe.difficulty]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="pb-32">
      {/* Hero — фото на всю ширину контейнера */}
      <div className="relative aspect-[16/9] bg-cream max-w-5xl mx-auto lg:rounded-2xl lg:mt-6 overflow-hidden">
        {showImage ? (
          <img
            src={recipe.imageUrl!}
            alt={recipe.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat size={80} className="text-line-strong" strokeWidth={1.5} />
          </div>
        )}
        <Link
          to="/recipes"
          aria-label="Назад"
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-paper/90 backdrop-blur flex items-center justify-center text-ink hover:bg-paper transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 lg:px-10 mt-6">
        {/* Заголовок + кнопки управления */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink leading-tight">
            {recipe.title}
          </h1>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              to={`/recipes/${recipe.id}/edit`}
              aria-label="Редактировать"
              title="Редактировать"
              className="w-10 h-10 rounded-lg border border-line bg-paper text-ink-soft hover:text-primary hover:border-primary flex items-center justify-center transition-colors"
            >
              <Pencil size={18} />
            </Link>
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              aria-label="Удалить"
              title="Удалить"
              className="w-10 h-10 rounded-lg border border-line bg-paper text-ink-soft hover:text-alert hover:border-alert flex items-center justify-center transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        {subline && <p className="text-ink-soft mb-2">{subline}</p>}

        {/* Источник, если рецепт импортирован */}
        {recipe.sourceUrl && recipe.source && (
          <p className="text-ink-muted text-sm mb-5">
            Источник:{" "}
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              {recipe.source}
            </a>
          </p>
        )}

        {/* Факты */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6 text-sm">
          {recipe.totalTime !== null && (
            <span className="inline-flex items-center gap-1.5 text-ink">
              <Clock size={16} className="text-ink-muted" />
              {recipe.totalTime} мин
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-ink">
            <Users size={16} className="text-ink-muted" />
            {currentServings}{" "}
            {currentServings === 1
              ? "порция"
              : currentServings < 5
                ? "порции"
                : "порций"}
          </span>
          {recipe.calories !== null && (
            <span className="inline-flex items-center gap-1.5 text-ink">
              <Flame size={16} className="text-ink-muted" />
              {recipe.calories} ккал/порц.
            </span>
          )}
        </div>

        {/* Описание */}
        {recipe.description && (
          <p className="font-serif italic text-ink-soft mb-8 leading-relaxed">
            {recipe.description}
          </p>
        )}

        {/* Ингредиенты */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
            <h2 className="font-serif text-xl font-semibold text-ink">
              Ингредиенты
            </h2>
            <div className="inline-flex bg-paper border border-line rounded-lg p-0.5 gap-0.5">
              {PORTION_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiplier(m)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    multiplier === m
                      ? "bg-primary text-paper"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  ×{m}
                </button>
              ))}
            </div>
          </div>
          {ingredients.length === 0 ? (
            <p className="text-ink-muted text-sm">Ингредиенты не указаны.</p>
          ) : (
            <div className="space-y-5">
              {[...groups.entries()].map(([groupName, list]) => (
                <div key={groupName || "_default"}>
                  {groupName && (
                    <h3 className="text-xs uppercase tracking-wider text-ink-muted font-medium mb-2">
                      {groupName}
                    </h3>
                  )}
                  <ul className="space-y-2">
                    {list.map((ing) => {
                      const amt = ing.amount ? parseFloat(ing.amount) : null;
                      const scaled = amt !== null ? amt * multiplier : null;
                      return (
                        <li
                          key={ing.id}
                          className="flex items-baseline gap-3 text-ink"
                        >
                          <span className="font-medium tabular-nums min-w-[80px]">
                            {scaled !== null
                              ? `${formatAmount(scaled)}${ing.unit ? " " + ing.unit : ""}`
                              : "по вкусу"}
                          </span>
                          <span className="text-ink-soft">{ing.name}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Шаги */}
        <section>
          <h2 className="font-serif text-xl font-semibold text-ink mb-4">
            Шаги
          </h2>
          {steps.length === 0 ? (
            <p className="text-ink-muted text-sm">Шаги не указаны.</p>
          ) : (
            <ol className="space-y-6">
              {steps.map((step) => (
                <li key={step.id} className="flex gap-4">
                  <span className="font-serif text-2xl font-semibold text-primary w-8 flex-shrink-0 leading-none pt-1">
                    {step.stepNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-ink leading-relaxed mb-2">
                      {step.instruction}
                    </p>
                    {step.imageUrl && (
                      <img
                        src={step.imageUrl}
                        alt=""
                        loading="lazy"
                        className="rounded-lg max-w-full mb-2 border border-line"
                      />
                    )}
                    {step.timerMinutes !== null && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cream border border-line rounded-lg text-sm text-ink-soft">
                        <Timer size={14} />
                        {step.timerMinutes} мин
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Sticky bottom — disabled до Блока 11 */}
      <div className="fixed bottom-0 lg:bottom-0 inset-x-0 bg-paper border-t border-line p-4 lg:pl-64 z-10">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            disabled
            title="Готовка появится в Блоке 11"
            className="w-full bg-primary text-paper py-3 rounded-lg font-medium opacity-50 cursor-not-allowed"
          >
            Готовить сейчас (Блок 11)
          </button>
        </div>
      </div>

      {/* Модалка подтверждения удаления */}
      {showConfirmDelete && (
        <div
          className="fixed inset-0 bg-ink/50 flex items-center justify-center p-6 z-50"
          onClick={() => !del.isPending && setShowConfirmDelete(false)}
        >
          <div
            className="bg-paper rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-semibold text-ink mb-2">
              Удалить рецепт?
            </h3>
            <p className="text-ink-soft mb-6">
              «{recipe.title}» будет удалён. Действие необратимо.
            </p>
            {del.error && (
              <p className="text-alert text-sm mb-4">{del.error.message}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                disabled={del.isPending}
                className="px-4 h-11 rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => del.mutate({ id })}
                disabled={del.isPending}
                className="px-4 h-11 rounded-lg bg-alert text-paper font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {del.isPending ? "Удаляю..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
