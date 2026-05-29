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
  const [tab, setTab] = useState<"cooking" | "spending" | "prices">("cooking");

  const { data: topRecipes = [] } = trpc.analytics.topRecipes.useQuery({ period });
  const { data: consumption = [] } = trpc.analytics.productConsumption.useQuery({ period });

  // Расходы: текущий месяц
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = String(now.getFullYear());
  const [spendingPeriod, setSpendingPeriod] = useState<string>(currentMonth);

  const { data: spending } = trpc.analytics.spendingReport.useQuery(
    { period: spendingPeriod },
    { enabled: tab === "spending" },
  );

  const { data: priceComparison = [] } = trpc.analytics.priceComparison.useQuery(
    { limit: 30 },
    { enabled: tab === "prices" },
  );

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink">
        Аналитика
      </h1>

      {/* Вкладки: Готовка / Расходы */}
      <div className="inline-flex bg-cream rounded-lg p-1">
        <button
          onClick={() => setTab("cooking")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "cooking" ? "bg-primary text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          Готовка
        </button>
        <button
          onClick={() => setTab("spending")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "spending" ? "bg-primary text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          Расходы
        </button>
        <button
          onClick={() => setTab("prices")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "prices" ? "bg-primary text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          Где дешевле
        </button>
      </div>

      {tab === "cooking" && (
        <>
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
        </>
      )}

      {tab === "spending" && (
        <>
          {/* Переключатель: месяц / год */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSpendingPeriod(currentMonth)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                spendingPeriod === currentMonth ? "bg-primary text-paper" : "bg-cream text-ink-soft hover:text-ink"
              }`}
            >
              Этот месяц
            </button>
            {/* Предыдущий месяц */}
            <button
              onClick={() => {
                const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                setSpendingPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                spendingPeriod !== currentMonth && spendingPeriod !== currentYear
                  ? "bg-primary text-paper"
                  : "bg-cream text-ink-soft hover:text-ink"
              }`}
            >
              Прошлый месяц
            </button>
            <button
              onClick={() => setSpendingPeriod(currentYear)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                spendingPeriod === currentYear ? "bg-primary text-paper" : "bg-cream text-ink-soft hover:text-ink"
              }`}
            >
              Весь {currentYear} год
            </button>
          </div>

          {!spending ? (
            <p className="text-ink-muted text-sm">Загрузка...</p>
          ) : spending.receiptCount === 0 ? (
            <p className="text-ink-muted text-sm">
              Нет чеков за этот период. Сфотографируйте чеки — здесь появится аналитика расходов.
            </p>
          ) : (
            <>
              {/* Итого */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center">
                <p className="text-ink-soft text-sm mb-1">{spending.periodLabel}</p>
                <p className="font-serif text-4xl font-bold text-ink">
                  {spending.currency === 'EUR' ? '€' : '₽'}
                  {spending.totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-ink-muted text-sm mt-1">
                  {spending.receiptCount} {spending.receiptCount === 1 ? 'чек' : spending.receiptCount < 5 ? 'чека' : 'чеков'}
                </p>
              </div>

              {/* По магазинам */}
              {spending.byStore.length > 0 && (
                <section>
                  <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                    По магазинам
                  </h2>
                  <ul className="bg-paper border border-line rounded-xl divide-y divide-line">
                    {spending.byStore.map((store, idx) => (
                      <li key={idx} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <span className="text-sm font-medium text-ink">{store.store}</span>
                          <span className="text-xs text-ink-muted ml-2">{store.count} чек.</span>
                        </div>
                        <span className="text-sm tabular-nums font-medium text-ink">
                          {spending.currency === 'EUR' ? '€' : '₽'}
                          {store.totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Топ-15 продуктов */}
              {spending.topProducts.length > 0 && (
                <section>
                  <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                    Чаще всего покупали
                  </h2>
                  <ul className="bg-paper border border-line rounded-xl divide-y divide-line">
                    {spending.topProducts.map((product, idx) => (
                      <li key={idx} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-cream flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-ink">{product.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm tabular-nums text-ink-soft">{product.count}x</span>
                          <span className="text-sm tabular-nums font-medium text-ink ml-3">
                            {spending.currency === 'EUR' ? '€' : '₽'}
                            {product.totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* По месяцам (только для годового отчёта) */}
              {spending.byMonth.length > 0 && (
                <section>
                  <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                    Расходы по месяцам
                  </h2>
                  <ul className="bg-paper border border-line rounded-xl divide-y divide-line">
                    {spending.byMonth.map((m, idx) => (
                      <li key={idx} className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm font-medium text-ink">{m.month}</span>
                        <div className="text-right">
                          <span className="text-sm tabular-nums text-ink-muted mr-3">{m.receiptCount} чек.</span>
                          <span className="text-sm tabular-nums font-medium text-ink">
                            {spending.currency === 'EUR' ? '€' : '₽'}
                            {m.totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
      {tab === "prices" && (
        <div className="space-y-4">
          {priceComparison.length === 0 ? (
            <p className="text-ink-muted text-center py-8">
              Нужно минимум 2 чека из разных магазинов с одним и тем же товаром
            </p>
          ) : (
            priceComparison.map((item) => (
              <div key={item.productName} className="bg-paper border border-line rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-ink">{item.productName}</h3>
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                    экономия {item.savings.toFixed(2)}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {item.stores.map((s, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className={s.isCheapest ? "text-green-700 font-medium" : "text-ink-soft"}>
                        {s.isCheapest && "✓ "}{s.store}
                      </span>
                      <span className={`tabular-nums ${s.isCheapest ? "text-green-700 font-medium" : "text-ink-muted"}`}>
                        {s.avgPrice.toFixed(2)} (мин: {s.minPrice.toFixed(2)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
