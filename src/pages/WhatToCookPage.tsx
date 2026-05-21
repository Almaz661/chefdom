import { useState } from "react";
import { Link } from "react-router-dom";
import { ChefHat, Clock, Users, AlertTriangle, CheckCircle2, Plus, Loader2 } from "lucide-react";
import { trpc } from "../utils/trpc";

type Filter = "all" | "expiring" | "have" | "buy1";

export function WhatToCookPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: allRecipes, isLoading } = trpc.recipes.list.useQuery({});
  const { data: inventory = [] } = trpc.inventory.list.useQuery();
  const { data: expiring = [] } = trpc.inventory.getExpiring.useQuery({ days: 2 });

  const inventoryNames = new Set(
    inventory.map(i => i.productName.toLowerCase().trim())
  );
  const expiringNames = new Set(
    expiring.map(e => e.productName.toLowerCase().trim())
  );

  // Для каждого рецепта считаем сколько ингредиентов есть дома
  const recipes = allRecipes?.items ?? [];

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Все рецепты" },
    { key: "expiring", label: "🟡 Спасти истекающее" },
    { key: "have", label: "✓ Всё есть" },
    { key: "buy1", label: "➕ Докупить 1–2" },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink mb-2">
        Что приготовить?
      </h1>
      <p className="text-ink-soft text-sm mb-6">Из того что есть дома</p>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(f => (
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
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="bg-paper border border-line border-dashed rounded-2xl p-12 text-center">
          <ChefHat size={40} className="text-line-strong mx-auto mb-4" strokeWidth={1.5} />
          <p className="font-serif text-lg text-ink mb-2">Рецептов пока нет</p>
          <p className="text-ink-soft text-sm mb-4">Добавьте рецепты чтобы система подбирала блюда</p>
          <Link
            to="/recipes"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-paper text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus size={16} />
            Добавить рецепты
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(recipe => (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className="flex gap-4 bg-paper border border-line rounded-2xl p-4 hover:border-primary hover:shadow-sm transition-all"
            >
              {/* Фото */}
              <div className="w-20 h-20 rounded-xl bg-cream overflow-hidden shrink-0 flex items-center justify-center">
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
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
                  {recipe.title}
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-ink-muted mb-2">
                  {recipe.totalTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {recipe.totalTime} мин
                    </span>
                  )}
                  {recipe.servings && (
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {recipe.servings} порц.
                    </span>
                  )}
                </div>
                {expiring.length > 0 && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Используй истекающие продукты
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
