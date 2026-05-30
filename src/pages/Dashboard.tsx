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
  Flame,
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
    <div className="min-h-screen pb-24 lg:pb-12">

      {/* ═══════════════════════════════════════════════════════
          GREETING — editorial, magazine-style
          ═══════════════════════════════════════════════════════ */}
      <header className="max-w-3xl mx-auto px-6 pt-12 lg:pt-16 animate-section">
        <p className="text-primary text-[11px] font-medium uppercase tracking-[0.2em] mb-3">
          {formatToday()}
        </p>
        <h1 className="font-serif text-[2.75rem] lg:text-[3.5rem] font-semibold text-ink leading-[1.1] tracking-tight">
          {getGreeting()},
          <br />
          <span className="text-primary">{name}</span>
        </h1>
      </header>

      {/* ═══════════════════════════════════════════════════════
          ALERTS — warm accented rows with left border
          Visually distinct but not heavy. Left colored bar = status.
          ═══════════════════════════════════════════════════════ */}
      {(expiringTotal > 0 || stale.length > 0) && (
        <section className="max-w-3xl mx-auto px-6 mt-10 animate-section">
          <div className="space-y-2">
            {expiringTotal > 0 && (
              <Link
                to="/what-to-cook"
                className="flex items-stretch gap-0 rounded-lg overflow-hidden bg-surface-elevated border border-line hover:border-warning/30 transition-colors group"
              >
                <div className="w-1 bg-warning shrink-0" />
                <div className="flex items-center gap-3 px-4 py-3.5 flex-1">
                  <AlertTriangle size={15} className="text-warning shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-ink">
                      <span className="font-semibold">{expiringTotal}</span>{" "}
                      {expiringTotal === 1 ? "продукт" : "продукта"} истекают за 3 дня
                    </p>
                    <p className="text-xs text-ink-muted truncate mt-0.5">
                      {expiringNames.slice(0, 3).join(", ")}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-warning group-hover:text-ink transition-colors shrink-0">
                    Приготовить →
                  </span>
                </div>
              </Link>
            )}
            {stale.length > 0 && (
              <Link
                to="/inventory"
                className="flex items-stretch gap-0 rounded-lg overflow-hidden bg-surface-elevated border border-line hover:border-ink-muted/30 transition-colors group"
              >
                <div className="w-1 bg-ink-muted shrink-0" />
                <div className="flex items-center gap-3 px-4 py-3.5 flex-1">
                  <Clock size={15} className="text-ink-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-ink-soft">
                      <span className="font-semibold text-ink">{stale.length}</span>{" "}
                      залежались больше 30 дней
                    </p>
                  </div>
                  <span className="text-[11px] text-ink-muted group-hover:text-ink-soft transition-colors shrink-0">
                    →
                  </span>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          DISH OF THE DAY — the hero
          Full-width cinematic image with warm overlay.
          Generous padding. Strong text hierarchy on image.
          ═══════════════════════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-6 mt-12 animate-section">
        {todayMeal ? (
          <Link
            to={`/recipes/${todayMeal.recipe.id}`}
            className="block rounded-2xl overflow-hidden relative group cursor-pointer"
          >
            {/* Image container with Ken Burns */}
            <div className="aspect-[16/8] lg:aspect-[16/7] bg-surface-elevated overflow-hidden">
              {todayMeal.recipe.imageUrl ? (
                <img
                  src={todayMeal.recipe.imageUrl}
                  alt={todayMeal.recipe.title}
                  className="w-full h-full object-cover animate-ken-burns group-hover:scale-[1.03]"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ChefHat size={60} className="text-ink-muted/30" strokeWidth={0.7} />
                </div>
              )}
            </div>
            {/* Warm gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#140f0bee] via-[#140f0b55] to-transparent" />
            {/* Content */}
            <div className="absolute bottom-0 inset-x-0 p-7 lg:p-9">
              <p className="text-primary text-[10px] font-semibold uppercase tracking-[0.3em] mb-2.5">
                {mealTypeLabel(todayMeal.mealType)} · Блюдо дня
              </p>
              <h2 className="font-serif text-[1.75rem] lg:text-[2.25rem] font-semibold text-ink leading-[1.15] max-w-lg">
                {todayMeal.recipe.title}
              </h2>
              <div className="flex items-center gap-5 mt-4">
                {todayMeal.recipe.totalTime && (
                  <span className="text-ink-soft text-xs flex items-center gap-1.5">
                    <Clock size={12} strokeWidth={1.5} />
                    {todayMeal.recipe.totalTime} мин
                  </span>
                )}
                <span className="text-ink-soft text-xs flex items-center gap-1.5">
                  <Users size={12} strokeWidth={1.5} />
                  {todayMeal.recipe.servings || 4} порций
                </span>
              </div>
              {/* Cook CTA with pulse glow */}
              <div className="mt-5">
                <span className="inline-flex items-center gap-2 bg-primary/90 text-cream px-4 py-2 rounded-lg text-xs font-semibold group-hover:bg-primary transition-colors animate-pulse-glow">
                  <Flame size={13} strokeWidth={2} />
                  Готовить
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <Link
            to="/menu"
            className="block rounded-2xl bg-surface-elevated border border-dashed border-line py-20 text-center group hover:border-primary/30 transition-colors"
          >
            <ChefHat size={36} className="text-primary/40 mx-auto mb-4" strokeWidth={1} />
            <p className="font-serif text-xl text-ink">Блюдо дня</p>
            <p className="text-sm text-ink-muted mt-2 max-w-xs mx-auto">
              Запланируйте меню на неделю — здесь появится ваш рецепт с фото
            </p>
            <span className="inline-flex items-center gap-1 text-primary text-xs font-medium mt-4 group-hover:gap-2 transition-all">
              Запланировать <ArrowRight size={12} />
            </span>
          </Link>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════
          QUICK ACTIONS — three warm cards
          Distinct from hero (card format), but quieter.
          Warm surface with subtle left accent.
          ═══════════════════════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-6 mt-12 animate-section">
        <div className="grid grid-cols-3 gap-3">
          <Link
            to="/what-to-cook"
            className="bg-surface-elevated rounded-xl p-4 lg:p-5 border border-line hover:border-primary/30 hover:bg-surface-hover transition-colors group card-hover"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <ChefHat size={17} className="text-primary" strokeWidth={1.8} />
            </div>
            <p className="text-[13px] font-semibold text-ink leading-tight">Что приготовить</p>
            <p className="text-[11px] text-ink-muted mt-1">Из того что есть</p>
          </Link>
          <Link
            to="/shopping"
            className="bg-surface-elevated rounded-xl p-4 lg:p-5 border border-line hover:border-primary/30 hover:bg-surface-hover transition-colors group relative card-hover"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <ShoppingCart size={17} className="text-primary" strokeWidth={1.8} />
            </div>
            {shoppingCount > 0 && (
              <span className="absolute top-3 right-3 min-w-[18px] h-[18px] rounded-full bg-primary text-[9px] font-bold text-cream flex items-center justify-center px-1">
                {shoppingCount}
              </span>
            )}
            <p className="text-[13px] font-semibold text-ink leading-tight">Покупки</p>
            <p className="text-[11px] text-ink-muted mt-1">
              {shoppingCount > 0 ? `${shoppingCount} нужно купить` : "Список пуст"}
            </p>
          </Link>
          <Link
            to="/preserves"
            className="bg-surface-elevated rounded-xl p-4 lg:p-5 border border-line hover:border-primary/30 hover:bg-surface-hover transition-colors group card-hover"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Snowflake size={17} className="text-primary" strokeWidth={1.8} />
            </div>
            <p className="text-[13px] font-semibold text-ink leading-tight">Заготовки</p>
            <p className="text-[11px] text-ink-muted mt-1">Морозилка, банки</p>
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FAVORITE THIS MONTH
          Warm highlight card — single row, golden accent.
          ═══════════════════════════════════════════════════════ */}
      {topRecipe && topRecipe.count >= 2 && (
        <section className="max-w-3xl mx-auto px-6 mt-10 animate-section">
          <div className="flex items-center gap-4 bg-surface-elevated rounded-xl px-5 py-4 border border-line">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
              <span className="text-base">🏆</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-ink-muted uppercase tracking-[0.15em]">
                Фаворит месяца
              </p>
              {topRecipe.recipeId ? (
                <Link to={`/recipes/${topRecipe.recipeId}`} className="text-[13px] font-semibold text-ink hover:text-primary transition-colors truncate block mt-0.5">
                  {topRecipe.recipeTitle}
                </Link>
              ) : (
                <p className="text-[13px] font-semibold text-ink truncate mt-0.5">{topRecipe.recipeTitle}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-serif font-semibold text-primary">{topRecipe.count}×</p>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          RECENTLY COOKED — horizontal gallery
          Taller aspect ratio (3:4), warm rounded corners.
          No borders — photography speaks. Subtle text below.
          ═══════════════════════════════════════════════════════ */}
      {recentCooks.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 mt-12 animate-section">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-[0.15em]">
              Недавно готовили
            </h3>
            <Link to="/history" className="text-[11px] text-primary font-medium hover:text-primary-dark transition-colors">
              Всё →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scroll-smooth">
            {recentCooks.map((c) => {
              const inner = (
                <div className="w-[110px] shrink-0 group">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-surface-elevated">
                    {c.recipeImage ? (
                      <img
                        src={c.recipeImage}
                        alt={c.recipeTitle}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat size={18} className="text-ink-muted/40" strokeWidth={1} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-soft mt-2 line-clamp-2 leading-snug group-hover:text-ink transition-colors">
                    {c.recipeTitle}
                  </p>
                </div>
              );
              return c.recipeId ? (
                <Link key={c.id} to={`/recipes/${c.recipeId}`}>{inner}</Link>
              ) : (
                <div key={c.id}>{inner}</div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          WEEKLY MENU — minimal bottom section
          Seven day indicators. Today = filled copper circle.
          ═══════════════════════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-6 mt-12 animate-section">
        <div className="bg-surface-elevated rounded-xl px-5 py-5 border border-line">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.15em] flex items-center gap-2">
              <CalendarDays size={11} strokeWidth={1.5} />
              Меню недели
            </h3>
            <Link to="/menu" className="text-[10px] text-primary font-medium hover:text-primary-dark transition-colors">
              Открыть →
            </Link>
          </div>
          <div className="flex justify-between items-center">
            {WEEKDAYS.map((label, idx) => {
              const isToday = idx === todayIdx;
              const dayMeals = weekMenu?.items.filter((i) => i.dayOfWeek === idx) || [];
              const filled = dayMeals.length > 0;
              return (
                <Link to="/menu" key={label} className="flex flex-col items-center gap-2 group">
                  <span className={`text-[9px] font-medium uppercase tracking-wider transition-colors ${
                    isToday ? "text-primary" : "text-ink-muted group-hover:text-ink-soft"
                  }`}>
                    {label}
                  </span>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${
                    isToday
                      ? "bg-primary text-cream shadow-[0_0_12px_rgba(212,135,77,0.3)]"
                      : filled
                        ? "bg-primary/15 text-primary border border-primary/20"
                        : "border border-line text-ink-muted group-hover:border-line-strong"
                  }`}>
                    {isToday ? dayMeals.length || "•" : filled ? dayMeals.length : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}
