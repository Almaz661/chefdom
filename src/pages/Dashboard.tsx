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
  const expiringNames = [...expiring.map((e) => e.productName), ...expiringPreserves.map((p) => p.name)];

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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const { data: weekMenu } = trpc.menu.getWeek.useQuery({ weekStart });
  const shoppingCount = shopping.filter((s) => s.isChecked === 0).length;

  return (
    <div className="min-h-screen atmosphere-home">

      {/* ════════════════════════════════════════════════════════════
          SECTION 1: GREETING + ALERTS
          Tight top area. No card wrapping. Just text + subtle alerts.
          ════════════════════════════════════════════════════════════ */}
      <div className="max-w-3xl mx-auto px-6 pt-10 lg:pt-16 pb-8">
        <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-ink leading-none">
          {getGreeting()},
          <br />
          {name}
        </h1>
        <p className="text-ink-muted text-xs mt-4 uppercase tracking-[0.2em]">
          {formatToday()}
        </p>

        {/* Alerts — minimal inline rows, no cards */}
        {(expiringTotal > 0 || stale.length > 0) && (
          <div className="mt-8 space-y-1">
            {expiringTotal > 0 && (
              <Link
                to="/what-to-cook"
                className="flex items-center gap-3 py-2 group"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                <span className="text-base text-ink font-medium-soft group-hover:text-ink transition-colors flex-1">
                  <span className="text-ink font-medium">{expiringTotal}</span> истекает за 3 дня
                  <span className="text-ink-muted ml-2">— {expiringNames.slice(0, 2).join(", ")}</span>
                </span>
                <ArrowRight size={12} className="text-ink-muted group-hover:text-primary transition-colors" />
              </Link>
            )}
            {stale.length > 0 && (
              <Link
                to="/inventory"
                className="flex items-center gap-3 py-2 group"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-ink-muted" />
                <span className="text-base text-ink font-medium-muted group-hover:text-ink-soft transition-colors flex-1">
                  <span className="text-ink-soft font-medium">{stale.length}</span> залежались {">"}30 дней
                </span>
                <ArrowRight size={12} className="text-ink-muted group-hover:text-primary transition-colors" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          SECTION 2: DISH OF THE DAY — full-width hero
          This is THE focal point. Takes all visual attention.
          No container padding. Edge-to-edge within content area.
          ════════════════════════════════════════════════════════════ */}
      <div className="max-w-3xl mx-auto px-6 pb-12">
        {todayMeal ? (
          <Link
            to={`/recipes/${todayMeal.recipe.id}`}
            className="block rounded-2xl overflow-hidden relative group"
          >
            <div className="aspect-[16/7] bg-paper">
              {todayMeal.recipe.imageUrl ? (
                <img
                  src={todayMeal.recipe.imageUrl}
                  alt={todayMeal.recipe.title}
                  className="w-full h-full object-cover photo-cinematic group-hover:scale-[1.02] transition-transform duration-700"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ChefHat size={56} className="text-ink-muted" strokeWidth={0.8} />
                </div>
              )}
            </div>
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            {/* Content on image */}
            <div className="absolute bottom-0 inset-x-0 p-6 lg:p-8">
              <p className="text-primary/90 text-sm font-bold uppercase tracking-[0.25em] mb-2">
                {mealTypeLabel(todayMeal.mealType)}
              </p>
              <h2 className="font-serif text-3xl lg:text-3xl font-semibold text-white leading-tight max-w-md">
                {todayMeal.recipe.title}
              </h2>
              <div className="flex items-center gap-5 mt-3">
                {todayMeal.recipe.totalTime && (
                  <span className="text-white/50 text-xs flex items-center gap-1.5">
                    <Clock size={11} strokeWidth={1.5} />
                    {todayMeal.recipe.totalTime} мин
                  </span>
                )}
                <span className="text-white/50 text-xs flex items-center gap-1.5">
                  <Users size={11} strokeWidth={1.5} />
                  {todayMeal.recipe.servings || 4} порций
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <Link
            to="/menu"
            className="block rounded-2xl border border-dashed border-line py-16 lg:py-20 text-center group hover:border-primary/20 transition-colors"
          >
            <ChefHat size={28} className="text-ink-muted mx-auto mb-4" strokeWidth={1} />
            <p className="font-serif text-lg text-ink-soft group-hover:text-ink transition-colors">
              Запланируйте меню на неделю
            </p>
            <p className="text-base text-ink font-medium-muted font-medium mt-1.5">
              Здесь появится блюдо дня
            </p>
          </Link>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          SECTION 3: QUICK ACTIONS
          Three equal items. Minimal visual weight.
          Not cards — just icon + label. No borders, no backgrounds.
          ════════════════════════════════════════════════════════════ */}
      <div className="max-w-3xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-3 gap-6">
          <Link to="/what-to-cook" className="text-center group">
            <div className="w-12 h-12 mx-auto rounded-full bg-paper border border-line flex items-center justify-center group-hover:border-primary/40 transition-colors mb-3">
              <ChefHat size={18} className="text-primary" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-bold text-ink-soft group-hover:text-ink transition-colors">Что приготовить</p>
          </Link>
          <Link to="/shopping" className="text-center group">
            <div className="w-12 h-12 mx-auto rounded-full bg-paper border border-line flex items-center justify-center group-hover:border-primary/40 transition-colors mb-3 relative">
              <ShoppingCart size={18} className="text-primary" strokeWidth={1.5} />
              {shoppingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-cream flex items-center justify-center">
                  {shoppingCount > 9 ? "9+" : shoppingCount}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-ink-soft group-hover:text-ink transition-colors">Покупки</p>
          </Link>
          <Link to="/preserves" className="text-center group">
            <div className="w-12 h-12 mx-auto rounded-full bg-paper border border-line flex items-center justify-center group-hover:border-primary/40 transition-colors mb-3">
              <Snowflake size={18} className="text-primary" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-bold text-ink-soft group-hover:text-ink transition-colors">Заготовки</p>
          </Link>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          SECTION 4: FAVORITE + RECENT — secondary content
          Visually quieter than hero. Smaller, tighter, muted.
          ════════════════════════════════════════════════════════════ */}
      <div className="max-w-3xl mx-auto px-6 pb-12 space-y-10">

        {/* Favorite this month */}
        {topRecipe && topRecipe.count >= 2 && (
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-paper border border-line flex items-center justify-center shrink-0">
              <span className="text-sm">🏆</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base text-ink font-medium-muted font-medium uppercase tracking-[0.15em] mb-0.5">Фаворит месяца</p>
              {topRecipe.recipeId ? (
                <Link to={`/recipes/${topRecipe.recipeId}`} className="text-base text-ink font-medium hover:text-primary transition-colors truncate block">
                  {topRecipe.recipeTitle}
                </Link>
              ) : (
                <p className="text-base text-ink font-medium truncate">{topRecipe.recipeTitle}</p>
              )}
            </div>
            <span className="text-base text-ink font-medium-muted font-medium shrink-0">×{topRecipe.count}</span>
          </div>
        )}

        {/* Recently cooked */}
        {recentCooks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-base text-ink font-medium-muted font-medium uppercase tracking-[0.15em]">Недавно готовили</p>
              <Link to="/history" className="text-xs text-primary uppercase tracking-wider hover:text-primary-dark transition-colors">
                Всё
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-2 px-2">
              {recentCooks.map((c) => {
                const inner = (
                  <div className="w-[100px] shrink-0">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-paper mb-2">
                      {c.recipeImage ? (
                        <img
                          src={c.recipeImage}
                          alt={c.recipeTitle}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ChefHat size={16} className="text-ink-muted" strokeWidth={1} />
                        </div>
                      )}
                    </div>
                    <p className="text-base text-ink font-medium-soft line-clamp-2 leading-tight">
                      {c.recipeTitle}
                    </p>
                  </div>
                );
                return c.recipeId ? (
                  <Link key={c.id} to={`/recipes/${c.recipeId}`} className="hover:opacity-80 transition-opacity">{inner}</Link>
                ) : (
                  <div key={c.id}>{inner}</div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          SECTION 5: WEEKLY MENU — bottom, minimal
          Just dots. No card wrapping. Flush with the rhythm.
          ════════════════════════════════════════════════════════════ */}
      <div className="max-w-3xl mx-auto px-6 pb-16">
        <div className="flex items-center justify-between mb-4">
          <p className="text-base text-ink font-medium-muted font-medium uppercase tracking-[0.15em] flex items-center gap-1.5">
            <CalendarDays size={10} strokeWidth={1.5} />
            Неделя
          </p>
          <Link to="/menu" className="text-xs text-primary uppercase tracking-wider hover:text-primary-dark transition-colors">
            Меню
          </Link>
        </div>
        <div className="flex justify-between items-center">
          {WEEKDAYS.map((label, idx) => {
            const isToday = idx === todayIdx;
            const dayMeals = weekMenu?.items.filter((i) => i.dayOfWeek === idx) || [];
            const filled = dayMeals.length > 0;
            return (
              <Link to="/menu" key={label} className="flex flex-col items-center gap-2 group">
                <span className={`text-[9px] uppercase tracking-wider transition-colors ${
                  isToday ? "text-primary" : "text-ink-muted group-hover:text-ink-soft"
                }`}>
                  {label}
                </span>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isToday
                    ? "bg-primary text-cream"
                    : filled
                      ? "border border-primary/30 text-primary"
                      : "border border-line text-ink-muted group-hover:border-line-strong"
                }`}>
                  {isToday ? "●" : filled ? dayMeals.length : ""}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
