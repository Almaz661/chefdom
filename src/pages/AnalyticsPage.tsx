import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc";

// C.3 — Аналитика (план раздел 19.4 + раздел 26 пункт 31).
// Переключатели: Неделя / Месяц / 3 месяца.
// Два блока: расход продуктов (топ-10) и топ-5 рецептов.

type Period = "week" | "month" | "3months";

const PERIOD_LABELS: { key: Period; label: string }[] = [
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "3months", label: "3 месяца" },
];

function pluralTimes(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} раз`;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} раза`;
  return `${n} раз`;
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");

  const { data: topRecipes = [] } = trpc.analytics.topRecipes.useQuery({ period });
  const { data: consumption = [] } = trpc.analytics.productConsumption.useQuery({ period });

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink">
        Аналитика
      </h1>

      {/* Переключатели периода */}
      <div className="inline-flex bg-cream rounded-lg p-1">
        {PERIOD_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === key
                ? "bg-primary text-paper"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Расход продуктов */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-ink mb-3">
          Расход продуктов
        </h2>
        {consumption.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Нет данных за выбранный период. Готовьте рецепты — здесь появится статистика расхода.
          </p>
        ) : (
          <ul className="bg-paper border border-line rounded-xl divide-y divide-line">
            {consumption.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-ink">{item.name}</span>
                <span className="text-sm tabular-nums text-ink-soft">
                  {item.total.toLocaleString("ru-RU")} {item.unit || ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Топ-5 рецептов */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-ink mb-3">
          Топ-5 рецептов
        </h2>
        {topRecipes.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Пока ничего не готовили за этот период.
          </p>
        ) : (
          <ol className="space-y-2">
            {topRecipes.map((recipe, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 bg-paper border border-line rounded-xl px-4 py-3"
              >
                <span className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {recipe.recipeId ? (
                    <Link
                      to={`/recipes/${recipe.recipeId}`}
                      className="text-sm font-medium text-ink hover:text-primary transition-colors truncate block"
                    >
                      {recipe.recipeTitle}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-ink truncate">
                      {recipe.recipeTitle}
                    </p>
                  )}
                </div>
                <span className="text-sm text-ink-soft shrink-0">
                  {pluralTimes(recipe.count)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
