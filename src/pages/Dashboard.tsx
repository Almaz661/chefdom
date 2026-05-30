import { Link } from "react-router-dom";
import {
  ChefHat,
  ShoppingCart,
  ArrowRight,
  AlertTriangle,
  Clock,
  Snowflake,
  CalendarDays,
  Users,
} from "lucide-react";
import { getAuth } from "../utils/auth";
import { trpc } from "../utils/trpc";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Доброе утро";
  if (h >= 11 && h < 17) return "Добрый день";
  if (h >= 17 && h < 22) return "Добрый вечер";
  return "Доброй ночи";
}

function formatToday(): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function mealTypeLabel(type: string): string {
  if (type === "breakfast") return "Завтрак";
  if (type === "lunch") return "Обед";
  return "Ужин";
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function Dashboard() {
  const auth = getAuth();
  const name = auth?.name || "Семья";
  const todayIdx = (new Date().getDay() + 6) % 7;

  const { data: expiring = [] } = trpc.inventory.getExpiring.useQuery({ days: 3 });
  const { data: allPreserves = [] } = trpc.preserves.list.useQuery();
  const expiringPreserves = allPreserves.filter((p) => {
    if (!p.expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(p.expiryDate + "T00:00:00");
    return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 3;
  });
  const expiringTotal = expiring.length + expiringPreserves.length;
  const expiringNames = [
    ...expiring.map((e) => e.productName),
    ...expiringPreserves.map((p) => p.name),
  ];

  const { data: stale = [] } = trpc.inventory.getStale.useQuery({ days: 30 });
  const { data: shopping = [] } = trpc.shopping.list.useQuery();
  const { data: recentCooks = [] } = trpc.cooking.recent.useQuery({ limit: 5 });
  const { data: topRecipe } = trpc.cooking.topThisMonth.useQuery();
  const { data: todayMeal } = trpc.menu.getTodayMeal.useQuery();

  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  })();
  const { data: weekMenu } = trpc.menu.getWeek.useQuery({ weekStart });

  const shoppingCount = shopping.filter((s) => s.isChecked === 0).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 lg:py-14 space-y-10">

      {/* ═══ GREETING ═══ */}
      <header>
        <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink tracking-tight">
          {getGreeting()}, {name}
        </h1>
        <p className="text-ink-muted text-sm mt-2 tracking-wide uppercase">{formatToday()}</p>
      </header>

      {/* ═══ ALERTS ═══ */}
      {(expiringTotal > 0 || stale.length > 0) && (
        <section className="grid sm:grid-cols-2 gap-4">
          {expiringTotal > 0 && (
            <div className="bg-surface-elevated rounded-xl p-5 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-warning" />
                <span className="text-xs font-medium text-warning uppercase tracking-wider">Истекает</span>
              </div>
              <p className="text-sm text-ink mb-1">
                {expiringTotal} {expiringTotal === 1 ? "продукт" : "продукта"} — ближайшие 3 дня
              </p>
              <p className="text-xs text-ink-muted truncate mb-3">
                {expiringNames.slice(0, 3).join(", ")}
              </p>
              <Link to="/what-to-cook" className="text-xs font-medium text-primary hover:text-primary-dark transition-colors">
                Что приготовить? →
              </Link>
            </div>
          )}
          {stale.length > 0 && (
            <div className="bg-surface-elevated rounded-xl p-5 border border-line">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-ink-muted" />
                <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Залежались</span>
              </div>
              <p className="text-sm text-ink mb-1">
                {stale.length} {stale.length === 1 ? "продукт" : "продукта"} — больше 30 дней
              </p>
              <p className="text-xs text-ink-muted truncate mb-3">
                {stale.slice(0, 3).map((s) => s.productName).join(", ")}
              </p>
              <Link to="/inventory" className="text-xs font-medium text-ink-soft hover:text-ink transition-colors">
                Открыть инвентарь →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ═══ DISH OF THE DAY — centerpiece ═══ */}
      <section>
        {todayMeal ? (
          <Link
            to={`/recipes/${todayMeal.recipe.id}`}
            className="block rounded-2xl overflow-hidden bg-surface-elevated border border-line hover:border-primary/30 transition-colors"
          >
            <div className="aspect-[21/9] bg-surface flex items-center justify-center overflow-hidden relative">
              {todayMeal.recipe.imageUrl ? (
                <img
                  src={todayMeal.recipe.imageUrl}
                  alt={todayMeal.recipe.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <ChefHat size={48} className="text-ink-muted" strokeWidth={1} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-6">
                <p className="text-primary text-xs font-medium uppercase tracking-widest mb-2">
                  {mealTypeLabel(todayMeal.mealType)} · Блюдо дня
                </p>
                <h2 className="font-serif text-2xl lg:text-3xl font-semibold text-white leading-tight">
                  {todayMeal.recipe.title}
                </h2>
                <div className="flex items-center gap-4 mt-3 text-white/60 text-sm">
                  {todayMeal.recipe.totalTime && (
                    <span className="flex items-center gap-1"><Clock size={13} /> {todayMeal.recipe.totalTime} мин</span>
                  )}
                  <span className="flex items-center gap-1"><Users size={13} /> {todayMeal.recipe.servings || 4} порц.</span>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <Link
            to="/menu"
            className="block rounded-2xl border border-dashed border-line p-12 text-center hover:border-primary/30 transition-colors"
          >
            <ChefHat size={32} className="text-ink-muted mx-auto mb-3" strokeWidth={1} />
            <p className="font-serif text-lg text-ink mb-1">Блюдо дня</p>
            <p className="text-sm text-ink-muted">Запланируйте меню, чтобы увидеть здесь рецепт</p>
          </Link>
        )}
      </section>

      {/* ═══ THREE ACTION CARDS ═══ */}
      <section className="grid grid-cols-3 gap-4">
        <Link
          to="/what-to-cook"
          className="bg-surface-elevated rounded-xl p-5 border border-line hover:border-primary/30 transition-colors group"
        >
          <ChefHat size={20} className="text-primary mb-4" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">Что приготовить</p>
          <p className="text-xs text-ink-muted mt-1">Из того что есть</p>
        </Link>
        <Link
          to="/shopping"
          className="bg-surface-elevated rounded-xl p-5 border border-line hover:border-primary/30 transition-colors group"
        >
          <ShoppingCart size={20} className="text-primary mb-4" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">Покупки</p>
          <p className="text-xs text-ink-muted mt-1">
            {shoppingCount > 0 ? `${shoppingCount} позиций` : "Список пуст"}
          </p>
        </Link>
        <Link
          to="/preserves"
          className="bg-surface-elevated rounded-xl p-5 border border-line hover:border-primary/30 transition-colors group"
        >
          <Snowflake size={20} className="text-primary mb-4" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">Заготовки</p>
          <p className="text-xs text-ink-muted mt-1">Морозилка, банки</p>
        </Link>
      </section>

      {/* ═══ FAVORITE THIS MONTH ═══ */}
      {topRecipe && topRecipe.count >= 2 && (
        <section className="bg-surface-elevated rounded-xl p-5 border border-line">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-3">
            Любимое в этом месяце
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xl">🏆</span>
            <div>
              {topRecipe.recipeId ? (
                <Link to={`/recipes/${topRecipe.recipeId}`} className="text-sm font-medium text-ink hover:text-primary transition-colors">
                  {topRecipe.recipeTitle}
                </Link>
              ) : (
                <p className="text-sm font-medium text-ink">{topRecipe.recipeTitle}</p>
              )}
              <p className="text-xs text-ink-muted mt-0.5">
                Готовили {topRecipe.count} раза в этом месяце
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ═══ RECENTLY COOKED ═══ */}
      {recentCooks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">
              Недавно готовили
            </p>
            <Link to="/history" className="text-xs text-primary hover:text-primary-dark">
              Вся история
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recentCooks.map((c) => {
              const card = (
                <div className="w-32 shrink-0 rounded-xl overflow-hidden bg-surface-elevated border border-line hover:border-primary/20 transition-colors">
                  <div className="aspect-square bg-surface flex items-center justify-center overflow-hidden">
                    {c.recipeImage ? (
                      <img src={c.recipeImage} alt={c.recipeTitle} loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <ChefHat size={20} className="text-ink-muted" strokeWidth={1} />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-ink line-clamp-2 leading-tight">{c.recipeTitle}</p>
                  </div>
                </div>
              );
              return c.recipeId ? (
                <Link key={c.id} to={`/recipes/${c.recipeId}`}>{card}</Link>
              ) : (
                <div key={c.id}>{card}</div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ WEEKLY MENU PREVIEW ═══ */}
      <section className="bg-surface-elevated rounded-xl p-5 border border-line">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider flex items-center gap-2">
            <CalendarDays size={13} /> Меню недели
          </p>
          <Link to="/menu" className="text-xs text-primary hover:text-primary-dark">
            Открыть
          </Link>
        </div>
        <div className="flex justify-between">
          {WEEKDAYS.map((label, idx) => {
            const isToday = idx === todayIdx;
            const dayMeals = weekMenu?.items.filter((i) => i.dayOfWeek === idx) || [];
            const filled = dayMeals.length > 0;
            return (
              <div key={label} className="flex flex-col items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider ${isToday ? "text-primary" : "text-ink-muted"}`}>
                  {label}
                </span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border transition-colors ${
                    isToday
                      ? "border-primary bg-primary/10 text-primary"
                      : filled
                        ? "border-ink-muted/30 text-ink-soft"
                        : "border-line text-ink-muted"
                  }`}
                >
                  {filled ? dayMeals.length : "·"}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
