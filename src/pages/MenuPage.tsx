import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Search,
  Clock,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { trpc } from "../utils/trpc";

// --- Helpers ---

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MEALS: { key: "breakfast" | "lunch" | "dinner"; label: string }[] = [
  { key: "breakfast", label: "Завтрак" },
  { key: "lunch", label: "Обед" },
  { key: "dinner", label: "Ужин" },
];

/** Получить понедельник текущей недели в формате YYYY-MM-DD */
function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Вс, 1=Пн...6=Сб
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Сдвиг недели на ±7 дней */
function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return formatDate(d);
}

/** Формат: «19 мая» */
function formatShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** Формат: «19 мая – 25 мая 2026» */
function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startStr = start.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  const endStr = end.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

/** Дата конкретного дня недели */
function getDayDate(weekStart: string, dayIdx: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + dayIdx);
  return formatDate(d);
}

// --- Component ---

export function MenuPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [pickSlot, setPickSlot] = useState<{
    dayOfWeek: number;
    mealType: "breakfast" | "lunch" | "dinner";
  } | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.menu.getWeek.useQuery({ weekStart });

  const addItem = trpc.menu.addItem.useMutation({
    onSuccess: () => {
      utils.menu.getWeek.invalidate({ weekStart });
      setPickSlot(null);
    },
  });

  const removeItem = trpc.menu.removeItem.useMutation({
    onSuccess: () => {
      utils.menu.getWeek.invalidate({ weekStart });
    },
  });

  const toShopping = trpc.menu.toShopping.useMutation({
    onSuccess: (result) => {
      alert(`Добавлено ${result.added} продуктов в список покупок`);
    },
    onError: (err) => {
      alert(err.message);
    },
  });

  // Сегодня — для подсветки
  const todayStr = formatDate(new Date());

  const prevWeek = () => setWeekStart((w) => shiftWeek(w, -7));
  const nextWeek = () => setWeekStart((w) => shiftWeek(w, 7));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
      {/* Заголовок + навигация недели */}
      <header className="flex items-center justify-between mb-8">
        <button
          onClick={prevWeek}
          className="p-1.5 rounded-lg text-ink-muted hover:text-ink transition-colors"
          aria-label="Предыдущая неделя"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h1 className="font-serif text-xl font-semibold text-ink">
            Меню недели
          </h1>
          <p className="text-ink-muted text-xs mt-1">
            {formatWeekRange(weekStart)}
          </p>
        </div>
        <button
          onClick={nextWeek}
          className="p-1.5 rounded-lg text-ink-muted hover:text-ink transition-colors"
          aria-label="Следующая неделя"
        >
          <ChevronRight size={18} />
        </button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Десктоп: таблица 7 колонок */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-16" />
                  {DAYS.map((label, idx) => {
                    const dayDate = getDayDate(weekStart, idx);
                    const isToday = dayDate === todayStr;
                    return (
                      <th
                        key={idx}
                        className={`text-center px-1 pb-3 ${
                          isToday ? "text-primary" : "text-ink-muted"
                        }`}
                      >
                        <div className="text-xs font-medium">{label}</div>
                        <div className="text-[10px] opacity-70">{formatShort(dayDate)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {MEALS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="text-[10px] text-ink-muted font-medium pr-2 align-top pt-3 uppercase tracking-wider">
                      {label}
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const items = data?.items.filter(
                        (i) => i.dayOfWeek === dayIdx && i.mealType === key,
                      );
                      return (
                        <td
                          key={dayIdx}
                          className="border border-line/50 p-1 align-top min-w-[110px]"
                        >
                          <div className="space-y-1">
                            {items && items.map((item) => (
                              <MenuSlotCard
                                key={item.id}
                                item={item}
                                onRemove={() =>
                                  removeItem.mutate({ itemId: item.id })
                                }
                              />
                            ))}
                            <button
                              onClick={() =>
                                setPickSlot({ dayOfWeek: dayIdx, mealType: key })
                              }
                              className={`w-full flex items-center justify-center rounded-lg border border-dashed border-line/60 hover:border-primary/40 transition-colors ${
                                items && items.length > 0 ? "h-7" : "h-[70px]"
                              }`}
                              aria-label={`Добавить ${label} ${DAYS[dayIdx]}`}
                            >
                              <Plus
                                size={items && items.length > 0 ? 12 : 14}
                                className="text-ink-muted"
                              />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Мобильный: вертикальный список дней */}
          <div className="lg:hidden space-y-4">
            {DAYS.map((label, dayIdx) => {
              const dayDate = getDayDate(weekStart, dayIdx);
              const isToday = dayDate === todayStr;
              return (
                <section
                  key={dayIdx}
                  className={`rounded-lg p-3 ${
                    isToday ? "bg-surface-elevated border border-primary/20" : "border border-line"
                  }`}
                >
                  <h3
                    className={`font-medium text-xs mb-2.5 ${
                      isToday ? "text-primary" : "text-ink-muted"
                    }`}
                  >
                    {label}, {formatShort(dayDate)}
                    {isToday && (
                      <span className="ml-2 text-[9px] bg-primary text-cream px-1.5 py-0.5 rounded uppercase tracking-wider">
                        сегодня
                      </span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {MEALS.map(({ key, label: mealLabel }) => {
                      const items = data?.items.filter(
                        (i) =>
                          i.dayOfWeek === dayIdx && i.mealType === key,
                      );
                      return (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-xs text-ink-muted w-16 shrink-0 pt-2">
                            {mealLabel}
                          </span>
                          <div className="flex-1">
                            <div className="space-y-1">
                              {items && items.map((item) => (
                                <MenuSlotCard
                                  key={item.id}
                                  item={item}
                                  onRemove={() =>
                                    removeItem.mutate({ itemId: item.id })
                                  }
                                />
                              ))}
                              <button
                                onClick={() =>
                                  setPickSlot({
                                    dayOfWeek: dayIdx,
                                    mealType: key,
                                  })
                                }
                                className={`w-full flex items-center justify-center rounded-lg border-2 border-dashed border-line hover:border-primary transition-colors ${
                                  items && items.length > 0 ? "h-8" : "h-10"
                                }`}
                                aria-label={`Добавить ${mealLabel}`}
                              >
                                <Plus size={items && items.length > 0 ? 14 : 16} className="text-line-strong" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* Кнопка «В покупки» */}
      {!isLoading && data && data.items.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => toShopping.mutate({ weekStart })}
            disabled={toShopping.isPending}
            className="inline-flex items-center gap-2 px-5 h-10 rounded-lg bg-primary text-cream text-xs font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            <ShoppingCart size={14} />
            {toShopping.isPending ? "Добавляю..." : "В покупки"}
          </button>
        </div>
      )}

      {/* Диалог выбора рецепта */}
      {pickSlot && (
        <RecipePickerDialog
          onSelect={(recipeId) => {
            addItem.mutate({
              weekStart,
              dayOfWeek: pickSlot.dayOfWeek,
              mealType: pickSlot.mealType,
              recipeId,
            });
          }}
          onClose={() => setPickSlot(null)}
          loading={addItem.isPending}
        />
      )}
    </div>
  );
}

// --- Slot Card ---

interface SlotItem {
  id: number;
  recipeId: number;
  recipeTitle: string;
  recipeImage: string | null;
  recipeTotalTime: number | null;
}

function MenuSlotCard({
  item,
  onRemove,
}: {
  item: SlotItem;
  onRemove: () => void;
}) {
  return (
    <div className="group relative bg-cream rounded-lg p-2 text-xs">
      <Link
        to={`/recipes/${item.recipeId}`}
        className="block hover:text-primary transition-colors"
      >
        {item.recipeImage && (
          <img
            src={item.recipeImage}
            alt=""
            loading="lazy"
            className="w-full h-12 object-cover rounded mb-1"
          />
        )}
        <span className="font-medium text-ink line-clamp-2 leading-tight">
          {item.recipeTitle}
        </span>
        {item.recipeTotalTime && (
          <span className="text-ink-muted inline-flex items-center gap-0.5 mt-0.5">
            <Clock size={10} />
            {item.recipeTotalTime} мин
          </span>
        )}
      </Link>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-paper border border-line flex items-center justify-center hover:border-alert hover:text-alert"
        aria-label="Убрать"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// --- Recipe Picker Dialog ---

function RecipePickerDialog({
  onSelect,
  onClose,
  loading,
}: {
  onSelect: (recipeId: number) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { data, isLoading } = trpc.recipes.list.useQuery({
    search: search.trim() || undefined,
  });

  const { data: suggestions, isLoading: suggestionsLoading } = trpc.menu.getSuggestions.useQuery(
    { limit: 6 },
    { enabled: showSuggestions && !search.trim() }
  );

  const recipes = data?.items ?? [];
  const hasSuggestions = suggestions && suggestions.length > 0;

  // Иконка для типа рекомендации
  const getReasonIcon = (type: string) => {
    switch (type) {
      case 'expiring': return '⏰';
      case 'not_cooked_long': return '🔄';
      case 'never_cooked': return '✨';
      case 'available': return '✅';
      default: return '💡';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="font-serif text-lg font-semibold text-ink">
            Выберите рецепт
          </h3>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск рецепта..."
              autoFocus
              className="w-full h-11 pl-10 pr-4 bg-cream border border-line rounded-lg text-ink focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Умные подсказки — показываем когда нет поиска */}
          {!search.trim() && showSuggestions && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wider">
                  Рекомендации
                </h4>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-xs text-ink-muted hover:text-ink"
                >
                  Скрыть
                </button>
              </div>
              {suggestionsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              ) : hasSuggestions ? (
                <ul className="space-y-1">
                  {suggestions.map((s) => (
                    <li key={s.recipe.id}>
                      <button
                        onClick={() => onSelect(s.recipe.id)}
                        disabled={loading}
                        className="w-full flex items-center gap-3 p-2 rounded-lg bg-cream/50 hover:bg-cream transition-colors text-left disabled:opacity-50 border border-line/50"
                      >
                        {s.recipe.imageUrl ? (
                          <img
                            src={s.recipe.imageUrl}
                            alt=""
                            loading="lazy"
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-cream border border-line shrink-0 flex items-center justify-center text-lg">
                            {getReasonIcon(s.reasonType)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">
                            {s.recipe.title}
                          </p>
                          <p className="text-xs text-primary truncate">
                            {getReasonIcon(s.reasonType)} {s.reason}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted text-center py-2">
                  Нет рекомендаций
                </p>
              )}
            </div>
          )}

          {/* Скрытые подсказки — показать кнопку */}
          {!search.trim() && !showSuggestions && (
            <button
              onClick={() => setShowSuggestions(true)}
              className="mb-3 text-xs text-primary hover:underline"
            >
              Показать рекомендации
            </button>
          )}

          {/* Все рецепты */}
          {search.trim() && (
            <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2">
              Результаты поиска
            </h4>
          )}
          {!search.trim() && (
            <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2">
              Все рецепты
            </h4>
          )}
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-ink-muted text-sm text-center py-8">
              Рецепты не найдены
            </p>
          ) : (
            <ul className="space-y-1">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r.id)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-cream transition-colors text-left disabled:opacity-50"
                  >
                    {r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-cream border border-line shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {r.title}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {r.totalTime ? `${r.totalTime} мин` : ""}
                        {r.totalTime && r.category ? " · " : ""}
                        {r.category ?? ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
