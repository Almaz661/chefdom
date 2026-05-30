import { Link } from "react-router-dom";
import {
  ChefHat,
  ShoppingCart,
  ArrowRight,
  BookOpen,
  CalendarDays,
  AlertTriangle,
  Clock,
  Snowflake,
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

  const { data: expiring = [] } = trpc.inventory.getExpiring.useQuery({ days: 3 });
  const { data: allPreserves = [] } = trpc.preserves.list.useQuery();
  const expiringPreserves = allPreserves.filter((p) => {
    if (!p.expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(p.expiryDate + "T00:00:00");
    const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 3;
  });
  const expiringTotal = expiring.length + expiringPreserves.length;
  const expiringNames = [
    ...expiring.map((e) => e.productName),
    ...expiringPreserves.map((p) => p.name),
  ];

  const { data: stale = [] } = trpc.inventory.getStale.useQuery({ days: 30 });
  const { data: allInventory = [] } = trpc.inventory.list.useQuery();
  const belowMinimum = allInventory.filter(item => {
    if (!item.minQuantity) return false;
    const qty = item.quantity ? parseFloat(item.quantity) : 0;
    const min = parseFloat(item.minQuantity);
    return !isNaN(min) && min > 0 && qty < min;
  });

  const { data: shopping = [] } = trpc.shopping.list.useQuery();
  const { data: recentCooks = [] } = trpc.cooking.recent.useQuery({ limit: 5 });
  const { data: topRecipe } = trpc.cooking.topThisMonth.useQuery();
  const { data: todayMeal } = trpc.menu.getTodayMeal.useQuery();

  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const { data: weekMenu } = trpc.menu.getWeek.useQuery({ weekStart });

  const shoppingCount = shopping.filter((s) => s.isChecked === 0).length;

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 lg:py-14 space-y-12">

      {/* ═══ 1. GREETING ═══ */}
      <header>
        <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink tracking-tight">
          {getGreeting()}, {name}
        </h1>
        <p className="text-ink-muted text-xs mt-2 uppercase tracking-[0.15em]">
          {formatToday()}
        </p>
      </header>

      {/* ═══ 2–3. ALERTS ═══ */}
      {(expiringTotal > 0 || stale.length > 0 || belowMinimum.length > 0) && (
        <section className="space-y-2">
          {expiringTotal > 0 && (
            <Link
              to="/what-to-cook"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-elevated border border-line hover:border-warning/30 transition-colors"
            >
              <AlertTriangle size={14} className="text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink">
                  <span className="font-medium">{expiringTotal}</span>{" "}
                  {expiringTotal === 1 ? "продукт истекает" : "продукта истекают"} — 3 дня
                </p>
                <p className="text-xs text-ink-muted truncate mt-0.5">
                  {expiringNames.slice(0, 4).join(", ")}
                </p>
              </div>
              <span className="text-xs text-warning shrink-0">Что приготовить? →</span>
            </Link>
          )}
          {stale.length > 0 && (
            <Link
              to="/inventory"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-elevated border border-line hover:border-line-strong transition-colors"
            >
              <Clock size={14} className="text-ink-muted shrink-0" />
              <p className="text-sm text-ink-soft flex-1">
                <span className="font-medium text-ink">{stale.length}</span>{" "}
                {stale.length === 1 ? "продукт" : "продукта"} лежат больше 30 дней
              </p>
              <span className="text-xs text-ink-muted shrink-0">→</span>
            </Link>
          )}
          {belowMinimum.length > 0 && (
            <Link
              to="/shopping"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-elevated border border-line hover:border-primary/20 transition-colors"
            >
              <ShoppingCart size={14} className="text-primary shrink-0" />
              <p className="text-sm text-ink-soft flex-1">
                <span className="font-medium text-ink">{belowMinimum.length}</span> ниже минимума — пора докупить
              </p>
              <span className="text-xs text-primary shrink-0">→</span>
            </Link>
          )}
        </section>
      )}

      {/* ═══ 4. DISH OF THE DAY — hero ═══ */}
      <section>
        {todayMeal ? (
          <Link
            to={`/recipes/${todayMeal.recipe.id}`}
            className="block rounded-xl overflow-hidden bg-surface-elevated border border-line hover:border-primary/20 transition-colors"
          >
            <div className="aspect-[2.2/1] bg-paper flex items-center justify-center overflow-hidden relative">
              {todayMeal.recipe.imageUrl ? (
                <img
                  src={todayMeal.recipe.imageUrl}
                  alt={todayMeal.recipe.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <ChefHat size={40} className="text-ink-muted" strokeWidth={1} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-5 lg:p-6">
                <p className="text-primary text-[10px] font-medium uppercase tracking-[0.2em] mb-1.5">
                  {mealTypeLabel(todayMeal.mealType)} · Блюдо дня
                </p>
                <h2 className="font-serif text-xl lg:text-2xl font-semibold text-white leading-tight">
                  {todayMeal.recipe.title}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-white/50 text-xs">
                  {todayMeal.recipe.totalTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {todayMeal.recipe.totalTime} мин
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {todayMeal.recipe.servings || 4} порц.
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <Link
            to="/menu"
            className="block rounded-xl border border-dashed border-line py-14 text-center hover:border-primary/20 transition-colors"
          >
            <ChefHat size={28} className="text-ink-muted mx-auto mb-3" strokeWidth={1} />
            <p className="font-serif text-base text-ink">Блюдо дня</p>
            <p className="text-xs text-ink-muted mt-1">Запланируйте меню на неделю</p>
          </Link>
        )}
      </section>

      {/* ═══ 5. QUICK ACTION CARDS ═══ */}
      <section className="grid grid-cols-3 gap-3">
        <Link
          to="/what-to-cook"
          className="bg-surface-elevated rounded-lg p-4 border border-line hover:border-primary/20 transition-colors"
        >
          <ChefHat size={16} className="text-primary mb-3" strokeWidth={1.5} />
          <p className="text-xs font-medium text-ink">Что приготовить</p>
          <p className="text-[10px] text-ink-muted mt-0.5">Из имеющегося</p>
        </Link>
        <Link
          to="/shopping"
          className="bg-surface-elevated rounded-lg p-4 border border-line hover:border-primary/20 transition-colors"
        >
          <ShoppingCart size={16} className="text-primary mb-3" strokeWidth={1.5} />
          <p className="text-xs font-medium text-ink">Покупки</p>
          <p className="text-[10px] text-ink-muted mt-0.5">
            {shoppingCount > 0 ? `${shoppingCount} позиц.` : "Пусто"}
          </p>
        </Link>
        <Link
          to="/preserves"
          className="bg-surface-elevated rounded-lg p-4 border border-line hover:border-primary/20 transition-colors"
        >
          <Snowflake size={16} className="text-primary mb-3" strokeWidth={1.5} />
          <p className="text-xs font-medium text-ink">Заготовки</p>
          <p className="text-[10px] text-ink-muted mt-0.5">Заморозка, банки</p>
        </Link>
      </section>

      {/* ═══ 6. FAVORITE THIS MONTH ═══ */}
      {topRecipe && topRecipe.count >= 2 && (
        <section className="bg-surface-elevated rounded-lg p-4 border border-line">
          <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-2.5">
            Любимое в этом месяце
          </p>
          <div className="flex items-center gap-3">
            <span className="text-lg">🏆</span>
            <div className="min-w-0 flex-1">
              {topRecipe.recipeId ? (
                <Link
                  to={`/recipes/${topRecipe.recipeId}`}
                  className="text-sm font-medium text-ink hover:text-primary transition-colors truncate block"
                >
                  {topRecipe.recipeTitle}
                </Link>
              ) : (
                <p className="text-sm font-medium text-ink truncate">{topRecipe.recipeTitle}</p>
              )}
              <p className="text-xs text-ink-muted">
                Готовили {topRecipe.count} {topRecipe.count >= 5 ? "раз" : "раза"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ═══ 7. RECENTLY COOKED ═══ */}
      {recentCooks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em]">
              Недавно готовили
            </p>
            <Link to="/history" className="text-[10px] text-primary hover:text-primary-dark uppercase tracking-wider">
              История
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
            {recentCooks.map((c) => {
              const card = (
                <div className="w-28 shrink-0 rounded-lg overflow-hidden bg-surface-elevated border border-line hover:border-primary/20 transition-colors">
                  <div className="aspect-[4/3] bg-paper flex items-center justify-center overflow-hidden">
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
                      <ChefHat size={16} className="text-ink-muted" strokeWidth={1} />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-medium text-ink line-clamp-2 leading-snug">
                      {c.recipeTitle}
                    </p>
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

      {/* ═══ 8. WEEKLY MENU PREVIEW ═══ */}
      <section className="bg-surface-elevated rounded-lg p-4 border border-line">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] flex items-center gap-1.5">
            <CalendarDays size={11} /> Меню недели
          </p>
          <Link to="/menu" className="text-[10px] text-primary hover:text-primary-dark uppercase tracking-wider">
            Открыть
          </Link>
        </div>
        <div className="flex justify-between">
          {WEEKDAYS.map((label, idx) => {
            const isToday = idx === todayIdx;
            const dayMeals = weekMenu?.items.filter((i) => i.dayOfWeek === idx) || [];
            const filled = dayMeals.length > 0;
            return (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <span
                  className={`text-[9px] uppercase tracking-wider ${
                    isToday ? "text-primary" : "text-ink-muted"
                  }`}
                >
                  {label}
                </span>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium border ${
                    isToday
                      ? "border-primary bg-primary/10 text-primary"
                      : filled
                        ? "border-line-strong text-ink-soft"
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
