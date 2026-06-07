import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Users,
  Flame,
  ChefHat,
  Pencil,
  Trash2,
  Replace,
  Moon,
} from "lucide-react";
import { trpc } from "../utils/trpc";
import { StepTimer } from "../components/StepTimer";
import { SubstitutionDialog } from "../components/SubstitutionDialog";

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
  // B.3 — открытый диалог замены, либо null
  const [subForIngredient, setSubForIngredient] = useState<string | null>(null);

  // F.1 — Screen Wake Lock: экран не гаснет пока готовишь.
  // Поддерживается в Chrome 84+, Edge 84+, Safari iOS 16.4+, Opera 70+.
  // На неподдерживаемых браузерах просто не активируется (без ошибки).
  // Re-acquire при возврате на вкладку — wakeLock освобождается ОС когда
  // вкладка скрыта; при возврате нужно запросить заново.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        wakeLockRef.current = lock;
        setWakeLockActive(true);
        lock.addEventListener("release", () => {
          wakeLockRef.current = null;
          setWakeLockActive(false);
        });
      } catch {
        setWakeLockActive(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        acquire();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      setWakeLockActive(false);
    };
  }, []);

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

  const cook = trpc.recipes.cook.useMutation({
    onSuccess: (result) => {
      let msg = `Готовим! Списано ${result.consumed} из ${result.total} ингредиентов из инвентаря.`;
      if (result.addedToShopping > 0) {
        msg += `\n\n${result.addedToShopping} недостающих добавлено в список покупок.`;
      }
      alert(msg);
    },
    onError: (err) => {
      alert(err.message);
    },
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)]">
        <div className="max-w-3xl mx-auto px-6 py-8 lg:py-12">
          <Link
            to="/recipes"
            className="text-[var(--color-primary)] inline-flex items-center gap-1"
          >
            <ArrowLeft size={18} /> К рецептам
          </Link>
          <p className="text-white/50 mt-6">Некорректный ID рецепта.</p>
        </div>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)]">
        <div className="max-w-3xl mx-auto px-6 py-8 lg:py-12">
          <div className="text-white/30">Загрузка рецепта...</div>
        </div>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)]">
        <div className="max-w-3xl mx-auto px-6 py-8 lg:py-12">
          <Link
            to="/recipes"
            className="text-[var(--color-primary)] inline-flex items-center gap-1 mb-6"
          >
            <ArrowLeft size={18} /> К рецептам
          </Link>
          <h1 className="font-serif text-3xl text-white font-semibold mb-2">
            Рецепт не найден
          </h1>
          <p className="text-white/50">
            {query.error?.message || "Возможно, он был удалён или неверный URL."}
          </p>
        </div>
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
    <div className="min-h-screen bg-[var(--color-cream)] pb-32">
      {/* Hero — фото на всю ширину контейнера */}
      <div className="relative aspect-[16/9] bg-white/[0.04] max-w-5xl mx-auto lg:rounded-2xl lg:mt-6 overflow-hidden">
        {showImage ? (
          <img
            src={recipe.imageUrl!}
            alt={recipe.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat size={80} className="text-white/30" strokeWidth={1.5} />
          </div>
        )}
        <Link
          to="/recipes"
          aria-label="Назад"
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 lg:px-10 mt-6">
        {/* Заголовок + кнопки управления */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="font-serif text-3xl text-white font-semibold leading-tight">
            {recipe.title}
          </h1>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              to={`/recipes/${recipe.id}/edit`}
              aria-label="Редактировать"
              title="Редактировать"
              className="w-10 h-10 rounded-xl btn-ghost flex items-center justify-center"
            >
              <Pencil size={18} />
            </Link>
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              aria-label="Удалить"
              title="Удалить"
              className="w-10 h-10 rounded-xl border border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/10 flex items-center justify-center transition-colors"
            >
              <Trash2 size={18} />
            </button>
            <button
              type="button"
              onClick={() => cook.mutate({ id: recipe.id })}
              disabled={cook.isPending}
              aria-label="Готовить"
              title="Готовить"
              className="w-10 h-10 btn-gold"
            >
              <ChefHat size={18} />
            </button>
          </div>
        </div>
        {subline && <p className="text-white/50 mb-2">{subline}</p>}

        {/* Источник, если рецепт импортирован */}
        {recipe.sourceUrl && recipe.source && (
          <p className="text-white/30 text-sm mb-5">
            Источник:{" "}
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--color-primary)]"
            >
              {recipe.source}
            </a>
          </p>
        )}

        {/* Факты */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6 text-sm">
          {recipe.totalTime !== null && (
            <span className="inline-flex items-center gap-1.5 text-white/80">
              <Clock size={16} className="text-white/30" />
              {recipe.totalTime} мин
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-white/80">
            <Users size={16} className="text-white/30" />
            {currentServings}{" "}
            {currentServings === 1
              ? "порция"
              : currentServings < 5
                ? "порции"
                : "порций"}
          </span>
          {recipe.calories !== null && (
            <span className="inline-flex items-center gap-1.5 text-white/80">
              <Flame size={16} className="text-white/30" />
              {recipe.calories} ккал/порц.
            </span>
          )}
          {/* F.1 — индикатор активного Wake Lock (экран не гаснет) */}
          {wakeLockActive && (
            <span
              className="inline-flex items-center gap-1.5 text-white/50"
              title="Экран не гаснет, пока ты на этом рецепте"
            >
              <Moon size={16} className="text-[var(--color-primary)]" />
              Экран не гаснет
            </span>
          )}
        </div>

        {/* C.1 — КБЖУ на порцию с % дневной нормы */}
        {(recipe.calories || recipe.proteinG || recipe.fatsG || recipe.carbsG) && (
          <div className="card-dark p-4 mb-6">
            <p className="text-sm font-bold text-white/30 uppercase tracking-wider mb-3">
              На порцию ({currentServings} {currentServings === 1 ? "порция" : currentServings < 5 ? "порции" : "порций"})
            </p>
            <div className="grid grid-cols-4 gap-3 text-center">
              {recipe.calories && (
                <div>
                  <p className="font-serif text-xl font-semibold text-white">{Math.round(recipe.calories * multiplier)}</p>
                  <p className="text-base text-white/50 font-medium">ккал</p>
                  <p className="text-base text-white/50 font-medium">{Math.round(recipe.calories * multiplier / 2000 * 100)}% нормы</p>
                </div>
              )}
              {recipe.proteinG && (
                <div>
                  <p className="font-serif text-xl font-semibold text-white">{Math.round(parseFloat(recipe.proteinG) * multiplier)}г</p>
                  <p className="text-base text-white/50 font-medium">белки</p>
                  <p className="text-base text-white/50 font-medium">{Math.round(parseFloat(recipe.proteinG) * multiplier / 50 * 100)}% нормы</p>
                </div>
              )}
              {recipe.fatsG && (
                <div>
                  <p className="font-serif text-xl font-semibold text-white">{Math.round(parseFloat(recipe.fatsG) * multiplier)}г</p>
                  <p className="text-base text-white/50 font-medium">жиры</p>
                  <p className="text-base text-white/50 font-medium">{Math.round(parseFloat(recipe.fatsG) * multiplier / 70 * 100)}% нормы</p>
                </div>
              )}
              {recipe.carbsG && (
                <div>
                  <p className="font-serif text-xl font-semibold text-white">{Math.round(parseFloat(recipe.carbsG) * multiplier)}г</p>
                  <p className="text-base text-white/50 font-medium">углеводы</p>
                  <p className="text-base text-white/50 font-medium">{Math.round(parseFloat(recipe.carbsG) * multiplier / 260 * 100)}% нормы</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Описание */}
        {recipe.description && (
          <p className="font-serif italic text-white/50 mb-8 leading-relaxed">
            {recipe.description}
          </p>
        )}

        {/* Ингредиенты */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-white/70 font-bold text-lg">
              Ингредиенты
            </h2>
            <div className="inline-flex card-dark p-0.5 gap-0.5">
              {PORTION_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiplier(m)}
                  className={`px-3 py-1 rounded-xl text-base font-semibold transition-colors ${
                    multiplier === m
                      ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  ×{m}
                </button>
              ))}
            </div>
          </div>
          {ingredients.length === 0 ? (
            <p className="text-white/30 text-sm">Ингредиенты не указаны.</p>
          ) : (
            <div className="space-y-5">
              {[...groups.entries()].map(([groupName, list]) => (
                <div key={groupName || "_default"}>
                  {groupName && (
                    <h3 className="text-xs uppercase tracking-wider text-white/30 font-medium mb-2">
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
                          className="flex items-center gap-3 text-white/80 group"
                        >
                          <span className="font-medium tabular-nums min-w-[80px] self-baseline">
                            {scaled !== null
                              ? `${formatAmount(scaled)}${ing.unit ? " " + ing.unit : ""}`
                              : "по вкусу"}
                          </span>
                          <span className="text-white/50 flex-1 self-baseline">
                            {ing.name}
                          </span>
                          {/* B.3 — кнопка «Чем заменить» */}
                          <button
                            type="button"
                            onClick={() => setSubForIngredient(ing.name)}
                            aria-label={`Чем заменить ${ing.name}`}
                            title="Чем заменить"
                            className="w-9 h-9 -my-2 rounded-xl text-white/30 hover:text-[var(--color-primary)] hover:bg-white/[0.05] flex items-center justify-center shrink-0 transition-colors"
                          >
                            <Replace size={16} />
                          </button>
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
          <h2 className="text-white/70 font-bold text-lg mb-4">
            Шаги
          </h2>
          {steps.length === 0 ? (
            <p className="text-white/30 text-sm">Шаги не указаны.</p>
          ) : (
            <ol className="space-y-6">
              {steps.map((step) => (
                <li key={step.id} className="flex gap-4">
                  <span className="font-serif text-3xl font-bold text-[var(--color-primary)] w-8 flex-shrink-0 leading-none pt-1">
                    {step.stepNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 leading-relaxed mb-2">
                      {step.instruction}
                    </p>
                    {step.imageUrl && (
                      <img
                        src={step.imageUrl}
                        alt=""
                        loading="lazy"
                        className="rounded-xl max-w-full mb-2 border border-[var(--color-line)]"
                      />
                    )}
                    {step.timerMinutes !== null && (
                      <StepTimer
                        minutes={step.timerMinutes}
                        stepNumber={step.stepNumber}
                        recipeName={recipe.title}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Sticky bottom */}
      <div className="fixed bottom-0 lg:bottom-0 inset-x-0 bg-black/70 backdrop-blur-sm border-t border-[var(--color-line)] p-4 lg:pl-64 z-10">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            disabled={cook.isPending}
            onClick={() => {
              if (confirm('Готовить? Ингредиенты будут списаны из инвентаря.')) {
                cook.mutate({ id });
              }
            }}
            className="w-full btn-gold py-3"
          >
            {cook.isPending ? 'Готовлю...' : 'Готовить сейчас'}
          </button>
        </div>
      </div>

      {/* B.3 — Диалог замен ингредиента */}
      {subForIngredient && (
        <SubstitutionDialog
          ingredientName={subForIngredient}
          onClose={() => setSubForIngredient(null)}
        />
      )}

      {/* Модалка подтверждения удаления */}
      {showConfirmDelete && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          onClick={() => !del.isPending && setShowConfirmDelete(false)}
        >
          <div
            className="bg-[var(--color-paper)] border border-[var(--color-line)] rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-semibold text-white mb-2">
              Удалить рецепт?
            </h3>
            <p className="text-white/50 mb-6">
              «{recipe.title}» будет удалён. Действие необратимо.
            </p>
            {del.error && (
              <p className="text-red-400 text-sm mb-4">{del.error.message}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                disabled={del.isPending}
                className="px-4 h-11 btn-ghost"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => del.mutate({ id })}
                disabled={del.isPending}
                className="px-4 h-11 rounded-xl border border-red-500/30 text-red-400 font-medium hover:border-red-500/60 hover:bg-red-500/10 transition-colors disabled:opacity-50"
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
