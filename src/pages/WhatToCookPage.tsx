import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ChefHat,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Loader2,
} from "lucide-react";
import { trpc } from "../utils/trpc";

type Filter = "all" | "expiring" | "have" | "buy1";

export function WhatToCookPage() {
  const [filter, setFilter] = useState<Filter>("all");

  // B.4 — рецепты с информацией о наличии ингредиентов и скоропортящихся
  const { data: matched = [], isLoading } = trpc.recipes.matchWithInventory.useQuery({
    limit: 100,
    expiringDays: 3,
  });

  // Фильтрация по выбранной вкладке
  const filtered = useMemo(() => {
    switch (filter) {
      case "expiring":
        return matched.filter((r) => r.expiringCount > 0);
      case "have":
        return matched.filter((r) => r.totalCount > 0 && r.haveCount === r.totalCount);
      case "buy1":
        return matched.filter((r) => r.missingCount >= 1 && r.missingCount <= 2);
      case "all":
      default:
        return matched;
    }
  }, [matched, filter]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Все рецепты", count: matched.length },
    {
      key: "expiring",
      label: "🟡 Спасти истекающее",
      count: matched.filter((r) => r.expiringCount > 0).length,
    },
    {
      key: "have",
      label: "✓ Всё есть",
      count: matched.filter((r) => r.totalCount > 0 && r.haveCount === r.totalCount).length,
    },
    {
      key: "buy1",
      label: "➕ Докупить 1–2",
      count: matched.filter((r) => r.missingCount >= 1 && r.missingCount <= 2).length,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink mb-2">
        Что приготовить?
      </h1>
      <p className="text-ink-soft text-sm mb-6">Из того что есть дома</p>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-paper"
                : "bg-paper border border-line text-ink-soft hover:text-ink"
            }`}
          >
            {f.label}
            {f.count > 0 && f.key !== "all" && (
              <span className="ml-1.5 opacity-60">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : matched.length === 0 ? (
        <div className="bg-paper border border-line border-dashed rounded-2xl p-12 text-center">
          <ChefHat size={40} className="text-line-strong mx-auto mb-4" strokeWidth={1.5} />
          <p className="font-serif text-lg text-ink mb-2">Рецептов пока нет</p>
          <p className="text-ink-soft text-sm mb-4">
            Добавьте рецепты чтобы система подбирала блюда
          </p>
          <Link
            to="/recipes"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-paper text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus size={16} />
            Добавить рецепты
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-paper border border-line border-dashed rounded-2xl p-12 text-center">
          <ChefHat size={40} className="text-line-strong mx-auto mb-4" strokeWidth={1.5} />
          <p className="font-serif text-lg text-ink mb-2">Ничего не подходит</p>
          <p className="text-ink-soft text-sm">
            По выбранному фильтру нет рецептов. Попробуйте другой.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const allHave = r.totalCount > 0 && r.haveCount === r.totalCount;
            return (
              <Link
                key={r.id}
                to={`/recipes/${r.id}`}
                className="flex gap-4 bg-paper border border-line rounded-2xl p-4 hover:border-primary hover:shadow-sm transition-all"
              >
                {/* Фото */}
                <div className="w-20 h-20 rounded-xl bg-surface-elevated overflow-hidden shrink-0 flex items-center justify-center">
                  {r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt={r.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <ChefHat size={28} className="text-line-strong" strokeWidth={1.5} />
                  )}
                </div>

                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-base font-semibold text-ink truncate mb-1">
                    {r.title}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-ink-muted mb-2">
                    {r.totalTime && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {r.totalTime} мин
                      </span>
                    )}
                    {r.servings && (
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {r.servings} порц.
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {/* Счётчик "X из Y есть" */}
                    {r.totalCount > 0 && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                          allHave
                            ? "bg-green-50 text-green-700"
                            : r.haveCount > 0
                              ? "bg-surface-elevated text-ink-soft"
                              : "bg-surface-elevated text-ink-muted"
                        }`}
                      >
                        {allHave && <CheckCircle2 size={11} />}
                        {r.haveCount} из {r.totalCount} есть
                      </span>
                    )}
                    {/* Tag "истекают" */}
                    {r.expiringCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-warning">
                        <AlertTriangle size={11} />
                        Использует {r.expiringCount} истекающ.
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
