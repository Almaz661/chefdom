import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChefHat, BookOpen } from "lucide-react";
import { trpc } from "../utils/trpc";

// Период для переключателей (раздел 19.3 макета):
// «Этот месяц | 3 месяца | Всё время».
type Period = "month" | "3months" | "all";

const PERIOD_LABELS: { value: Period; label: string }[] = [
  { value: "month", label: "Этот месяц" },
  { value: "3months", label: "3 месяца" },
  { value: "all", label: "Всё время" },
];

// «Вс 18 мая» — заголовок дня, как в макете
function formatDayHeader(date: Date): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// «20:30» — время готовки
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Ключ дня — YYYY-MM-DD по локальному времени, для группировки
function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Согласование «N блюд» / «1 блюдо» / «2 блюда» по русским правилам
function pluralizeDishes(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} блюдо`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} блюда`;
  return `${n} блюд`;
}

// Согласование «1 порция / 4 порции / 5 порций»
function pluralizePortions(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} порция`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} порции`;
  return `${n} порций`;
}

export function HistoryPage() {
  const [period, setPeriod] = useState<Period>("month");

  // useInfiniteQuery — для подгрузки страниц по 30 (план 17.1: кнопка «Показать ещё»)
  const query = trpc.cooking.list.useInfiniteQuery(
    { period, limit: 30 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  // Группировка по дням (UTC-aware: используем локальное представление)
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { dateLabel: string; rows: typeof items }
    >();
    for (const it of items) {
      const dt = new Date(it.cookedAt as unknown as string);
      const key = dayKey(dt);
      if (!map.has(key)) {
        map.set(key, { dateLabel: formatDayHeader(dt), rows: [] });
      }
      map.get(key)!.rows.push(it);
    }
    return Array.from(map.entries()); // упорядочены, т.к. items уже DESC
  }, [items]);

  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#05070A]">
      <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
        <header>
          <h1 className="font-serif text-3xl text-white font-extrabold mb-1">
            История готовки
          </h1>
          <p className="text-white/50">Что и когда готовили</p>
        </header>

        {/* Переключатели периода */}
        <div className="flex flex-wrap gap-2">
          {PERIOD_LABELS.map(({ value, label }) => {
            const active = value === period;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`px-4 h-10 rounded-full text-base font-semibold border transition-colors ${
                  active
                    ? "bg-[#c9a84c] text-[#0a0c10] font-bold border-transparent"
                    : "bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/80"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Состояние загрузки */}
        {query.isLoading && (
          <div className="text-center text-white/30 py-12">Загрузка…</div>
        )}

        {/* Пустое состояние */}
        {!query.isLoading && items.length === 0 && (
          <div className="bg-white/[0.02] border border-white/[0.06] border-dashed rounded-2xl p-10 text-center">
            <BookOpen
              size={36}
              className="text-white/30 mx-auto mb-3"
              strokeWidth={1.5}
            />
            <p className="text-white/50">
              За выбранный период ничего не готовила.
            </p>
          </div>
        )}

        {/* Список по дням */}
        {groups.length > 0 && (
          <div className="space-y-6">
            {groups.map(([key, { dateLabel, rows }]) => (
              <section key={key}>
                <h2 className="font-serif text-base font-semibold text-white/50 mb-2">
                  {dateLabel}
                </h2>
                <ul className="space-y-2">
                  {rows.map((row) => {
                    const dt = new Date(row.cookedAt as unknown as string);
                    const time = formatTime(dt);
                    // Если рецепт удалён (recipeId === null) — без ссылки
                    const content = (
                      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-white/[0.10] hover:bg-white/[0.05] transition-colors">
                        <ChefHat
                          size={20}
                          className="text-[#c9a84c] shrink-0"
                          strokeWidth={2}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white/80 truncate">
                            {row.recipeTitle}
                          </p>
                          <p className="text-base text-white/50 font-medium">
                            {pluralizePortions(row.servings)} · {time}
                          </p>
                        </div>
                      </div>
                    );
                    return (
                      <li key={row.id}>
                        {row.recipeId ? (
                          <Link to={`/recipes/${row.recipeId}`} className="block">
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* «Показать ещё» — пагинация по плану 17.1 */}
        {query.hasNextPage && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="h-12 px-6 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 font-medium hover:border-white/[0.15] hover:text-white/80 disabled:opacity-50 transition-colors"
            >
              {query.isFetchingNextPage ? "Загрузка…" : "Показать ещё"}
            </button>
          </div>
        )}

        {/* Итог за период */}
        {total > 0 && (
          <p className="text-center text-white/30 text-sm pt-4 border-t border-white/[0.06]">
            Всего за период: {pluralizeDishes(total)}
          </p>
        )}
      </div>
    </div>
  );
}
