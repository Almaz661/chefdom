import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChefHat,
} from "lucide-react";
import { trpc } from "../utils/trpc";

// Списки для <datalist> подсказок. Пользователь может ввести своё.
const CATEGORIES = [
  "завтрак",
  "обед",
  "ужин",
  "закуска",
  "десерт",
  "напиток",
  "соус",
  "гарнир",
];
const CUISINES = [
  "русская",
  "украинская",
  "итальянская",
  "французская",
  "японская",
  "китайская",
  "грузинская",
  "средиземноморская",
  "прочая",
];
const DIFFICULTIES = ["легко", "средне", "сложно"];

interface IngredientForm {
  name: string;
  amount: string; // строка чтобы хранить «1,5» как ввод пользователя
  unit: string;
  groupName: string;
}

interface StepForm {
  instruction: string;
  imageUrl: string;
  timerMinutes: string;
}

function emptyIngredient(): IngredientForm {
  return { name: "", amount: "", unit: "", groupName: "" };
}

function emptyStep(): StepForm {
  return { instruction: "", imageUrl: "", timerMinutes: "" };
}

// Парсит "1,5" → 1.5, "" → null, "ерунда" → null
function parseDecimal(s: string): number | null {
  const cleaned = s.trim().replace(",", ".");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(s: string): number | null {
  const cleaned = s.trim();
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

export function AddRecipePage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const editId = params.id ? Number(params.id) : null;
  const isEditing = editId !== null && editId > 0;

  const utils = trpc.useUtils();

  // Базовые поля
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState(false);

  // Время и порции
  const [servings, setServings] = useState("4");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [totalTime, setTotalTime] = useState("");
  const [calories, setCalories] = useState("");

  // Категория, кухня, сложность
  const [category, setCategory] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [difficulty, setDifficulty] = useState("");

  // Динамические списки
  const [ingredients, setIngredients] = useState<IngredientForm[]>([
    emptyIngredient(),
  ]);
  const [steps, setSteps] = useState<StepForm[]>([emptyStep()]);

  const [error, setError] = useState<string | null>(null);

  // Загрузка существующего рецепта в режиме редактирования
  const existing = trpc.recipes.getById.useQuery(
    { id: editId! },
    { enabled: isEditing },
  );

  useEffect(() => {
    if (!existing.data) return;
    const r = existing.data.recipe;
    setTitle(r.title);
    setDescription(r.description ?? "");
    setImageUrl(r.imageUrl ?? "");
    setServings(String(r.servings));
    setPrepTime(r.prepTime !== null ? String(r.prepTime) : "");
    setCookTime(r.cookTime !== null ? String(r.cookTime) : "");
    setTotalTime(r.totalTime !== null ? String(r.totalTime) : "");
    setCalories(r.calories !== null ? String(r.calories) : "");
    setCategory(r.category ?? "");
    setCuisine(r.cuisine ?? "");
    setDifficulty(r.difficulty ?? "");
    setIngredients(
      existing.data.ingredients.length > 0
        ? existing.data.ingredients.map((i) => ({
            name: i.name,
            amount:
              i.amount !== null ? String(i.amount).replace(".", ",") : "",
            unit: i.unit ?? "",
            groupName: i.groupName ?? "",
          }))
        : [emptyIngredient()],
    );
    setSteps(
      existing.data.steps.length > 0
        ? existing.data.steps.map((s) => ({
            instruction: s.instruction,
            imageUrl: s.imageUrl ?? "",
            timerMinutes:
              s.timerMinutes !== null ? String(s.timerMinutes) : "",
          }))
        : [emptyStep()],
    );
  }, [existing.data]);

  // Авто-сумма total = prep + cook (если общее не задано вручную)
  useEffect(() => {
    if (totalTime !== "") return;
    const p = parseInteger(prepTime);
    const c = parseInteger(cookTime);
    if (p !== null && c !== null) {
      // ничего не сетим — оставляем пустым, серверная сторона может авто-посчитать,
      // но пока показываем подсказку placeholder'ом
    }
  }, [prepTime, cookTime, totalTime]);

  // --- Ingredients helpers ---
  const updateIngredient = (idx: number, patch: Partial<IngredientForm>) =>
    setIngredients((arr) =>
      arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  const addIngredient = () =>
    setIngredients((arr) => [...arr, emptyIngredient()]);
  const removeIngredient = (idx: number) =>
    setIngredients((arr) =>
      arr.length === 1 ? [emptyIngredient()] : arr.filter((_, i) => i !== idx),
    );
  const moveIngredient = (idx: number, dir: -1 | 1) => {
    setIngredients((arr) => {
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      const next = [...arr];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // --- Steps helpers ---
  const updateStep = (idx: number, patch: Partial<StepForm>) =>
    setSteps((arr) =>
      arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  const addStep = () => setSteps((arr) => [...arr, emptyStep()]);
  const removeStep = (idx: number) =>
    setSteps((arr) =>
      arr.length === 1 ? [emptyStep()] : arr.filter((_, i) => i !== idx),
    );
  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((arr) => {
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      const next = [...arr];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // --- Mutations ---
  const create = trpc.recipes.create.useMutation({
    onSuccess: (data) => {
      utils.recipes.invalidate();
      navigate(`/recipes/${data.id}`);
    },
    onError: (err) => setError(err.message),
  });
  const update = trpc.recipes.update.useMutation({
    onSuccess: (data) => {
      utils.recipes.invalidate();
      navigate(`/recipes/${data.id}`);
    },
    onError: (err) => setError(err.message),
  });

  const isPending = create.isPending || update.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const titleClean = title.trim();
    if (!titleClean) {
      setError("Название обязательно");
      return;
    }

    const servingsNum = parseInteger(servings) ?? 4;
    const prepNum = parseInteger(prepTime);
    const cookNum = parseInteger(cookTime);
    const totalNum =
      parseInteger(totalTime) ??
      (prepNum !== null && cookNum !== null ? prepNum + cookNum : null);

    const cleanedIngredients = ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        amount: parseDecimal(i.amount),
        unit: i.unit.trim() || null,
        groupName: i.groupName.trim() || null,
      }));

    const cleanedSteps = steps
      .filter((s) => s.instruction.trim())
      .map((s) => ({
        instruction: s.instruction.trim(),
        imageUrl: s.imageUrl.trim() || null,
        timerMinutes: parseInteger(s.timerMinutes),
      }));

    const payload = {
      title: titleClean,
      description: description.trim() || null,
      imageUrl: imageUrl.trim() || null,
      servings: servingsNum,
      prepTime: prepNum,
      cookTime: cookNum,
      totalTime: totalNum,
      sourceUrl: null,
      source: null,
      category: category.trim() || null,
      cuisine: cuisine.trim() || null,
      difficulty: difficulty.trim() || null,
      calories: parseInteger(calories),
      ingredients: cleanedIngredients,
      steps: cleanedSteps,
    };

    if (isEditing) {
      update.mutate({ ...payload, id: editId! });
    } else {
      create.mutate(payload);
    }
  }

  // Loading state when editing existing
  if (isEditing && existing.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <div className="text-ink-muted">Загрузка рецепта...</div>
      </div>
    );
  }
  if (isEditing && existing.error) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <Link
          to="/recipes"
          className="text-primary inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={18} /> К рецептам
        </Link>
        <p className="text-alert">Не удалось загрузить рецепт для редактирования.</p>
      </div>
    );
  }

  const cancelTo = isEditing ? `/recipes/${editId}` : "/recipes";

  // Подсказка для общего времени когда оба заданы
  const totalHint =
    parseInteger(prepTime) !== null && parseInteger(cookTime) !== null
      ? `Авто: ${parseInteger(prepTime)! + parseInteger(cookTime)!}`
      : "";

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 lg:p-10">
      <Link
        to={cancelTo}
        className="text-primary inline-flex items-center gap-1 mb-4 text-sm"
      >
        <ArrowLeft size={16} />
        {isEditing ? "Назад к рецепту" : "К рецептам"}
      </Link>

      <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink mb-8">
        {isEditing ? "Редактирование рецепта" : "Новый рецепт"}
      </h1>

      {/* Основное */}
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted font-medium mb-4">
          Основное
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Название <span className="text-alert">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-paper border border-line rounded-lg px-4 py-3 text-ink focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Короткое описание блюда — пара предложений"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Ссылка на фото
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImageError(false);
              }}
              placeholder="https://example.com/photo.jpg"
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
            {imageUrl && (
              <div className="mt-3 aspect-[16/9] max-w-md bg-cream rounded-lg overflow-hidden border border-line">
                {imageError ? (
                  <div className="w-full h-full flex items-center justify-center text-ink-muted text-sm">
                    Не удалось загрузить превью
                  </div>
                ) : (
                  <img
                    src={imageUrl}
                    alt="Превью"
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Время и порции */}
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted font-medium mb-4">
          Время и порции
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Порций
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Подготовка, мин
            </label>
            <input
              type="number"
              min="0"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Готовка, мин
            </label>
            <input
              type="number"
              min="0"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Всего, мин
            </label>
            <input
              type="number"
              min="0"
              value={totalTime}
              onChange={(e) => setTotalTime(e.target.value)}
              placeholder={totalHint}
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
        <div className="mt-4 max-w-xs">
          <label className="block text-sm font-medium text-ink mb-1.5">
            Калории на порцию
          </label>
          <input
            type="number"
            min="0"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </section>

      {/* Теги */}
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted font-medium mb-4">
          Категория, кухня, сложность
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Категория
            </label>
            <input
              type="text"
              list="dl-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
            <datalist id="dl-categories">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Кухня
            </label>
            <input
              type="text"
              list="dl-cuisines"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
            <datalist id="dl-cuisines">
              {CUISINES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Сложность
            </label>
            <input
              type="text"
              list="dl-difficulties"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-paper border border-line rounded-lg px-4 h-12 text-ink focus:outline-none focus:border-primary transition-colors"
            />
            <datalist id="dl-difficulties">
              {DIFFICULTIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>
      </section>

      {/* Ингредиенты */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted font-medium">
            Ингредиенты
          </h2>
          <button
            type="button"
            onClick={addIngredient}
            className="text-primary text-sm font-medium hover:text-primary-dark inline-flex items-center gap-1"
          >
            <Plus size={16} /> Добавить
          </button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div
              key={idx}
              className="bg-paper border border-line rounded-lg p-3 flex flex-wrap items-start gap-2"
            >
              <input
                type="text"
                inputMode="decimal"
                value={ing.amount}
                onChange={(e) => updateIngredient(idx, { amount: e.target.value })}
                placeholder="Кол-во"
                className="w-20 bg-cream border border-line rounded-md px-2 h-10 text-ink text-sm focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={ing.unit}
                onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                placeholder="ед."
                className="w-16 bg-cream border border-line rounded-md px-2 h-10 text-ink text-sm focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                placeholder="Название (обязательно)"
                className="flex-1 min-w-[180px] bg-cream border border-line rounded-md px-3 h-10 text-ink text-sm focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={ing.groupName}
                onChange={(e) =>
                  updateIngredient(idx, { groupName: e.target.value })
                }
                placeholder="Группа"
                className="w-28 bg-cream border border-line rounded-md px-2 h-10 text-ink text-sm focus:outline-none focus:border-primary"
              />
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveIngredient(idx, -1)}
                  disabled={idx === 0}
                  className="w-8 h-10 rounded-md text-ink-muted hover:text-ink hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                  aria-label="Выше"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveIngredient(idx, 1)}
                  disabled={idx === ingredients.length - 1}
                  className="w-8 h-10 rounded-md text-ink-muted hover:text-ink hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                  aria-label="Ниже"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  className="w-8 h-10 rounded-md text-ink-muted hover:text-alert hover:bg-cream flex items-center justify-center"
                  aria-label="Удалить"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-ink-muted text-xs mt-2">
          Кол-во можно с запятой: «1,5». Оставь пустым — будет «по вкусу».
        </p>
      </section>

      {/* Шаги */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted font-medium">
            Шаги
          </h2>
          <button
            type="button"
            onClick={addStep}
            className="text-primary text-sm font-medium hover:text-primary-dark inline-flex items-center gap-1"
          >
            <Plus size={16} /> Добавить
          </button>
        </div>
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="bg-paper border border-line rounded-lg p-4"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="font-serif text-2xl font-semibold text-primary leading-none pt-1 w-8 flex-shrink-0">
                  {idx + 1}
                </span>
                <textarea
                  value={step.instruction}
                  onChange={(e) =>
                    updateStep(idx, { instruction: e.target.value })
                  }
                  rows={3}
                  placeholder="Что делать на этом шаге"
                  className="flex-1 bg-cream border border-line rounded-md px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary resize-none"
                />
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0}
                    className="w-8 h-8 rounded-md text-ink-muted hover:text-ink hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label="Выше"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === steps.length - 1}
                    className="w-8 h-8 rounded-md text-ink-muted hover:text-ink hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label="Ниже"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="w-8 h-8 rounded-md text-ink-muted hover:text-alert hover:bg-cream flex items-center justify-center"
                    aria-label="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pl-11">
                <input
                  type="url"
                  value={step.imageUrl}
                  onChange={(e) =>
                    updateStep(idx, { imageUrl: e.target.value })
                  }
                  placeholder="Ссылка на фото шага (опционально)"
                  className="flex-1 min-w-[200px] bg-cream border border-line rounded-md px-3 h-10 text-ink text-sm focus:outline-none focus:border-primary"
                />
                <input
                  type="number"
                  min="0"
                  value={step.timerMinutes}
                  onChange={(e) =>
                    updateStep(idx, { timerMinutes: e.target.value })
                  }
                  placeholder="Таймер, мин"
                  className="w-32 bg-cream border border-line rounded-md px-3 h-10 text-ink text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ошибка и кнопки */}
      {error && (
        <div className="bg-alert/10 border border-alert text-alert rounded-lg p-4 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-line">
        <Link
          to={cancelTo}
          className="px-5 h-12 inline-flex items-center justify-center rounded-lg border border-line text-ink-soft font-medium hover:bg-cream transition-colors"
        >
          Отмена
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 h-12 inline-flex items-center justify-center rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending
            ? "Сохраняю..."
            : isEditing
              ? "Сохранить"
              : "Создать рецепт"}
        </button>
      </div>
    </form>
  );
}
