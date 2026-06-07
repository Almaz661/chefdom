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

  const { data: topRecipes = [] } = trpc.analytics.topRecipes.useQuery(
    { period },
    { enabled: tab === "cooking" },
  );
  const { data: consumption = [] } = trpc.analytics.productConsumption.useQuery(
    { period },
    { enabled: tab === "cooking" },
  );

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
    <div className="min-h-screen bg-[var(--color-cream)]">
      <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
        <h1 className="font-serif text-3xl text-white font-semibold">
          Аналитика
        </h1>

        {/* Вкладки: Готовка / Расходы / Где дешевле */}
        <div className="inline-flex bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab("cooking")}
            className={`px-4 py-2 rounded-lg text-base font-semibold transition-colors ${
              tab === "cooking"
                ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold"
                : "bg-transparent text-white/50 hover:text-white/80"
            }`}
          >
            Готовка
          </button>
          <button
            onClick={() => setTab("spending")}
            className={`px-4 py-2 rounded-lg text-base font-semibold transition-colors ${
              tab === "spending"
                ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold"
                : "bg-transparent text-white/50 hover:text-white/80"
            }`}
          >
            Расходы
          </button>
          <button
            onClick={() => setTab("prices")}
            className={`px-4 py-2 rounded-lg text-base font-semibold transition-colors ${
              tab === "prices"
                ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold"
                : "bg-transparent text-white/50 hover:text-white/80"
            }`}
          >
            Где дешевле
          </button>
        </div>

        {tab === "cooking" && (
          <>
            {/* Переключатели периода */}
            <div className="inline-flex bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-1 gap-1">
              {PERIOD_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-4 py-2 rounded-lg text-base font-semibold transition-colors ${
                    period === key
                      ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold"
                      : "bg-transparent text-white/50 hover:text-white/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Расход продуктов */}
            <section>
              <h2 className="font-serif text-xl font-semibold text-white mb-3">
                Расход продуктов
              </h2>
              {consumption.length === 0 ? (
                <p className="text-white/30 text-sm">
                  Нет данных за выбранный период. Готовьте рецепты — здесь появится статистика расхода.
                </p>
              ) : (
                <ul className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl divide-y divide-white/[0.06]">
                  {consumption.map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between px-4 py-3">
                      <span className="text-base font-semibold text-white/80">{item.name}</span>
                      <span className="text-sm tabular-nums text-white/50">
                        {item.total.toLocaleString("ru-RU")} {item.unit || ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Топ-5 рецептов */}
            <section>
              <h2 className="font-serif text-xl font-semibold text-white mb-3">
                Топ-5 рецептов
              </h2>
              {topRecipes.length === 0 ? (
                <p className="text-white/30 text-sm">
                  Пока ничего не готовили за этот период.
                </p>
              ) : (
                <ol className="space-y-2">
                  {topRecipes.map((recipe, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-3 bg-white/[0.03] border border-[var(--color-line)] rounded-xl px-4 py-3 hover:border-white/[0.10] hover:bg-white/[0.05] transition-colors"
                    >
                      <span className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-sm font-bold text-[var(--color-primary)] shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        {recipe.recipeId ? (
                          <Link
                            to={`/recipes/${recipe.recipeId}`}
                            className="text-base font-semibold text-white/80 hover:text-white transition-colors truncate block"
                          >
                            {recipe.recipeTitle}
                          </Link>
                        ) : (
                          <p className="text-base font-semibold text-white/80 truncate">
                            {recipe.recipeTitle}
                          </p>
                        )}
                      </div>
                      <span className="text-base text-white/50 shrink-0">
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
                className={`px-4 py-2 rounded-xl text-base font-semibold border transition-colors ${
                  spendingPeriod === currentMonth
                    ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold border-transparent"
                    : "bg-white/[0.04] border border-[var(--color-line)] text-white/50 hover:text-white/80"
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
                className={`px-4 py-2 rounded-xl text-base font-semibold border transition-colors ${
                  spendingPeriod !== currentMonth && spendingPeriod !== currentYear
                    ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold border-transparent"
                    : "bg-white/[0.04] border border-[var(--color-line)] text-white/50 hover:text-white/80"
                }`}
              >
                Прошлый месяц
              </button>
              <button
                onClick={() => setSpendingPeriod(currentYear)}
                className={`px-4 py-2 rounded-xl text-base font-semibold border transition-colors ${
                  spendingPeriod === currentYear
                    ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold border-transparent"
                    : "bg-white/[0.04] border border-[var(--color-line)] text-white/50 hover:text-white/80"
                }`}
              >
                Весь {currentYear} год
              </button>
            </div>

            {!spending ? (
              <p className="text-white/30 text-sm">Загрузка...</p>
            ) : spending.receiptCount === 0 ? (
              <p className="text-white/30 text-sm">
                Нет чеков за этот период. Сфотографируйте чеки — здесь появится аналитика расходов.
              </p>
            ) : (
              <>
                {/* Итого */}
                <div className="bg-[var(--color-primary)]/[0.07] border border-[var(--color-primary)]/20 rounded-2xl p-5 text-center">
                  <p className="text-white/50 text-sm mb-1">{spending.periodLabel}</p>
                  <p className="font-serif text-4xl font-bold text-white">
                    {spending.currency === 'EUR' ? '€' : '₽'}
                    {spending.totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-white/30 text-sm mt-1">
                    {spending.receiptCount} {spending.receiptCount === 1 ? 'чек' : spending.receiptCount < 5 ? 'чека' : 'чеков'}
                  </p>
                </div>

                {/* По магазинам */}
                {spending.byStore.length > 0 && (
                  <section>
                    <h2 className="font-serif text-xl font-semibold text-white mb-3">
                      По магазинам
                    </h2>
                    <ul className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl divide-y divide-white/[0.06]">
                      {spending.byStore.map((store, idx) => (
                        <li key={idx} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <span className="text-base font-semibold text-white/80">{store.store}</span>
                            <span className="text-base text-white/50 font-medium ml-2">{store.count} чек.</span>
                          </div>
                          <span className="text-sm tabular-nums font-medium text-white/80">
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
                    <h2 className="font-serif text-xl font-semibold text-white mb-3">
                      Чаще всего покупали
                    </h2>
                    <ul className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl divide-y divide-white/[0.06]">
                      {spending.topProducts.map((product, idx) => (
                        <li key={idx} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-[var(--color-primary)] shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-base font-semibold text-white/80">{product.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm tabular-nums text-white/50">{product.count}x</span>
                            <span className="text-sm tabular-nums font-medium text-white/80 ml-3">
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
                    <h2 className="font-serif text-xl font-semibold text-white mb-3">
                      Расходы по месяцам
                    </h2>
                    <ul className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl divide-y divide-white/[0.06]">
                      {spending.byMonth.map((m, idx) => (
                        <li key={idx} className="flex items-center justify-between px-4 py-3">
                          <span className="text-base font-semibold text-white/80">{m.month}</span>
                          <div className="text-right">
                            <span className="text-sm tabular-nums text-white/30 mr-3">{m.receiptCount} чек.</span>
                            <span className="text-sm tabular-nums font-medium text-white/80">
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
              <p className="text-white/50 text-center py-8">
                Нужно минимум 2 чека из разных магазинов с одним и тем же товаром
              </p>
            ) : (
              priceComparison.map((item) => (
                <div key={item.productName} className="bg-white/[0.03] border border-[var(--color-line)] rounded-xl p-4 hover:border-white/[0.10] hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white/80">{item.productName}</h3>
                    <span className="text-xs text-green-400 font-medium bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                      экономия {item.savings.toFixed(2)}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {item.stores.map((s, idx) => (
                      <li key={idx} className="flex items-center justify-between text-sm">
                        <span className={s.isCheapest ? "text-green-400 font-medium" : "text-white/50"}>
                          {s.isCheapest && "✓ "}{s.store}
                        </span>
                        <span className={`tabular-nums ${s.isCheapest ? "text-green-400 font-medium" : "text-white/30"}`}>
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
    </div>
  );
}
