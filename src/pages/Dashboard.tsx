import { Link } from "react-router-dom";
import {
  ChefHat,
  ShoppingCart,
  ArrowRight,
  BookOpen,
  CalendarDays,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { getAuth } from "../utils/auth";
import { trpc } from "../utils/trpc";

// Приветствие меняется по времени суток
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Доброе утро";
  if (h >= 11 && h < 17) return "Добрый день";
  if (h >= 17 && h < 22) return "Добрый вечер";
  return "Доброй ночи";
}

// «Вторник, 19 мая» — российский формат, заглавная буква в начале
function formatToday(): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function mealTypeLabel(type: string): string {
  if (type === "breakfast") return "Завтрак";
  if (type === "lunch") return "Обед";
  return "Ужин";
}

export function Dashboard() {
  const auth = getAuth();
  const name = auth?.name || "Семья";
  const todayIdx = (new Date().getDay() + 6) % 7;

  // B.1 — продукты истекающие в ближайшие 3 дня
  const { data: expiring = [] } = trpc.inventory.getExpiring.useQuery({ days: 3 });
  // B.2 — продукты которые лежат давно (>30 дней)
  const { data: stale = [] } = trpc.inventory.getStale.useQuery({ days: 30 });
  // Список покупок — для счётчика
  const { data: shopping = [] } = trpc.shopping.list.useQuery();
  // «Недавно готовила» — последние 5 (раздел 6.4 макета)
  const { data: recentCooks = [] } = trpc.cooking.recent.useQuery({ limit: 5 });
  // C.2 — «Любимое в этом месяце»
  const { data: topRecipe } = trpc.cooking.topThisMonth.useQuery();
  // Блюдо дня — рецепт из меню на сегодня по времени суток
  const { data: todayMeal } = trpc.menu.getTodayMeal.useQuery();

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-6">
      {/* Приветствие */}
      <header>
        <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink mb-1">
          {getGreeting()}, {name}
        </h1>
        <p className="text-ink-soft">{formatToday()}</p>
      </header>

      {/* B.1 — Алерт истекающих продуктов */}
      {expiring.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-warning mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink mb-1">
                {expiring.length} {expiring.length === 1 ? "продукт истекает" : "продукта истекают"} в ближайшие 3 дня
              </p>
              <p className="text-sm text-ink-soft truncate">
                {expiring.map(e => e.productName).join(" · ")}
              </p>
            </div>
            <Link
              to="/what-to-cook"
              className="text-xs font-medium text-warning hover:text-amber-700 shrink-0"
            >
              Что приготовить?
            </Link>
          </div>
        </section>
      )}

      {/* B.2 — Алерт «давно не используется» (>30 дней в инвентаре) */}
      {stale.length > 0 && (
        <section className="bg-cream border border-line rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Clock size={20} className="text-ink-muted mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink mb-1">
                {stale.length} {stale.length === 1 ? "продукт лежит" : "продукта лежат"} больше 30 дней
              </p>
              <p className="text-sm text-ink-soft truncate">
                {stale.map(s => s.productName).join(" · ")}
              </p>
            </div>
            <Link
              to="/inventory"
              className="text-xs font-medium text-ink-soft hover:text-ink shrink-0"
            >
              Открыть инвентарь
            </Link>
          </div>
        </section>
      )}

      {/*
        Алерт сроков годности появится здесь когда:
        — есть инвентарь (появится в Блоке 10)
        — в инвентаре есть позиции, истекающие в ближайшие 2 дня (этап B.1)
        Пока скрыт — не показываем пустой алерт «у вас всё хорошо», это шум.
      */}

      {/* Блюдо дня */}
      <section className="bg-paper rounded-2xl border border-line overflow-hidden">
        {todayMeal ? (
          <>
            <div className="aspect-[16/9] bg-cream flex items-center justify-center border-b border-line overflow-hidden">
              {todayMeal.recipe.imageUrl ? (
                <img
                  src={todayMeal.recipe.imageUrl}
                  alt={todayMeal.recipe.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    (e.currentTarget.parentElement as HTMLElement).innerHTML =
                      '<div class="flex items-center justify-center w-full h-full"><svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-line-strong"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/></svg></div>';
                  }}
                />
              ) : (
                <ChefHat size={56} className="text-line-strong" strokeWidth={1.5} />
              )}
            </div>
            <div className="p-6">
              <p className="text-xs text-ink-muted font-medium uppercase tracking-wider mb-2">
                {mealTypeLabel(todayMeal.mealType)}
              </p>
              <h2 className="font-serif text-2xl font-semibold text-ink mb-2">
                {todayMeal.recipe.title}
              </h2>
              {todayMeal.recipe.totalTime && (
                <p className="text-ink-soft text-sm mb-4 inline-flex items-center gap-1">
                  <Clock size={14} /> {todayMeal.recipe.totalTime} мин
                </p>
              )}
              <div>
                <Link
                  to={`/recipes/${todayMeal.recipe.id}`}
                  className="inline-flex items-center gap-2 text-primary font-medium hover:text-primary-dark transition-colors"
                >
                  Готовить сейчас
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="aspect-[16/9] bg-cream flex items-center justify-center border-b border-line">
              <ChefHat size={56} className="text-line-strong" strokeWidth={1.5} />
            </div>
            <div className="p-6">
              <p className="text-xs text-ink-muted font-medium uppercase tracking-wider mb-2">
                Сегодня в меню
              </p>
              <h2 className="font-serif text-2xl font-semibold text-ink mb-2">
                На сегодня меню ещё не запланировано
              </h2>
              <p className="text-ink-soft mb-4 max-w-md">
                Добавь рецепты в меню недели, и здесь появится блюдо дня с фото и
                кнопкой «Готовить сейчас».
              </p>
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 text-primary font-medium hover:text-primary-dark transition-colors"
              >
                Открыть меню недели
                <ArrowRight size={18} />
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Две главные карточки */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/what-to-cook"
          className="bg-paper rounded-2xl border border-line p-6 hover:border-primary hover:shadow-sm transition-all group"
        >
          <ChefHat
            size={32}
            className="text-primary mb-3"
            strokeWidth={1.5}
          />
          <h3 className="font-serif text-xl font-semibold text-ink mb-1">
            Что приготовить?
          </h3>
          <p className="text-ink-soft text-sm mb-3">Из того, что есть дома</p>
          <span className="inline-flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
            Подобрать рецепт
            <ArrowRight size={16} />
          </span>
        </Link>

        <Link
          to="/shopping"
          className="bg-paper rounded-2xl border border-line p-6 hover:border-primary hover:shadow-sm transition-all group"
        >
          <ShoppingCart
            size={32}
            className="text-primary mb-3"
            strokeWidth={1.5}
          />
          <h3 className="font-serif text-xl font-semibold text-ink mb-1">
            Список покупок
          </h3>
          <p className="text-ink-soft text-sm mb-3">
            {shopping.length > 0
              ? `${shopping.filter(s => s.isChecked === 0).length} позиций · ${shopping.filter(s => s.isChecked === 1).length} куплено`
              : "Список пуст"
            }
          </p>
          <span className="inline-flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
            Открыть
            <ArrowRight size={16} />
          </span>
        </Link>
      </div>

      {/* C.2 — Любимое в этом месяце */}
      {topRecipe && topRecipe.count >= 2 && (
        <section className="bg-paper rounded-2xl border border-line p-5">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2">
            Любимое в этом месяце
          </p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div className="flex-1 min-w-0">
              {topRecipe.recipeId ? (
                <Link to={`/recipes/${topRecipe.recipeId}`} className="font-serif text-lg font-semibold text-ink hover:text-primary transition-colors">
                  {topRecipe.recipeTitle}
                </Link>
              ) : (
                <p className="font-serif text-lg font-semibold text-ink">
                  {topRecipe.recipeTitle}
                </p>
              )}
              <p className="text-sm text-ink-soft">
                Готовили {topRecipe.count} {topRecipe.count >= 5 ? "раз" : topRecipe.count >= 2 ? "раза" : "раз"} в этом месяце
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Недавно готовила — раздел 6.4 макета: горизонтальный скролл */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-serif text-lg font-semibold text-ink">
            Недавно готовила
          </h3>
          {recentCooks.length > 0 && (
            <Link
              to="/history"
              className="text-primary text-sm font-medium hover:text-primary-dark inline-flex items-center gap-1"
            >
              Вся история
              <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {recentCooks.length === 0 ? (
          <div className="bg-paper border border-line border-dashed rounded-2xl p-8 text-center">
            <BookOpen
              size={32}
              className="text-line-strong mx-auto mb-3"
              strokeWidth={1.5}
            />
            <p className="text-ink-soft text-sm">
              Пока ничего не готовила.
              <br />
              История появится после первого приготовления.
            </p>
          </div>
        ) : (
          <ul className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            {recentCooks.map((c) => {
              const card = (
                <div className="w-36 shrink-0 snap-start bg-paper border border-line rounded-xl overflow-hidden hover:border-primary transition-colors">
                  <div className="aspect-square bg-cream flex items-center justify-center overflow-hidden">
                    {c.recipeImage ? (
                      <img
                        src={c.recipeImage}
                        alt={c.recipeTitle}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <ChefHat
                        size={32}
                        className="text-line-strong"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-serif text-sm font-semibold text-ink line-clamp-2 leading-snug">
                      {c.recipeTitle}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={c.id}>
                  {c.recipeId ? (
                    <Link to={`/recipes/${c.recipeId}`} className="block">
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Меню недели — мини-полоса */}
      <section className="bg-paper rounded-2xl border border-line p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h3 className="font-serif text-lg font-semibold text-ink inline-flex items-center gap-2">
            <CalendarDays
              size={20}
              className="text-ink-soft"
              strokeWidth={2}
            />
            Меню недели
          </h3>
          <Link
            to="/menu"
            className="text-primary text-sm font-medium hover:text-primary-dark inline-flex items-center gap-1"
          >
            Изменить
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((label, idx) => {
            const isToday = idx === todayIdx;
            return (
              <div key={label} className="flex flex-col items-center gap-2">
                <span
                  className={`text-xs font-medium ${
                    isToday ? "text-primary" : "text-ink-muted"
                  }`}
                >
                  {label}
                </span>
                <div
                  className={`w-9 h-9 rounded-full border-2 ${
                    isToday
                      ? "bg-primary-light border-primary"
                      : "border-line bg-cream"
                  }`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-ink-muted text-xs text-center mt-5">
          Тапни на день в меню недели, чтобы добавить блюдо.
        </p>
      </section>
    </div>
  );
}
