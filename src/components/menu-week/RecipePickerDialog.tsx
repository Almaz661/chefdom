import { useState } from 'react';
import { Search, X, Loader2, ChevronLeft, Users } from 'lucide-react';
import { trpc } from '../../utils/trpc';

type SelectedRecipe = { id: number; title: string; servings: number };

export function RecipePickerDialog({
  onSelect,
  onClose,
  loading,
  onSelectPreserve,
}: {
  onSelect: (recipeId: number, plannedServings: number) => void;
  onClose: () => void;
  loading: boolean;
  onSelectPreserve?: (preserveId: number, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  // Выбранный рецепт — ждём подтверждения порций
  const [selected, setSelected] = useState<SelectedRecipe | null>(null);
  const [plannedServings, setPlannedServings] = useState(4);

  const { data, isLoading } = trpc.recipes.list.useQuery({
    search: search.trim() || undefined,
  });

  const { data: suggestions, isLoading: suggestionsLoading } = trpc.menu.getSuggestions.useQuery(
    { limit: 6 },
    { enabled: showSuggestions && !search.trim() && !selected }
  );

  const { data: cookedPreserves } = trpc.menu.getCookedPreserves.useQuery(
    undefined,
    { enabled: !search.trim() && !selected }
  );

  const recipes = data?.items ?? [];
  const hasSuggestions = suggestions && suggestions.length > 0;

  const handlePickRecipe = (r: { id: number; title: string; servings?: number | null }) => {
    const servings = r.servings ?? 4;
    setSelected({ id: r.id, title: r.title, servings });
    setPlannedServings(servings);
  };

  const handleConfirm = () => {
    if (selected) onSelect(selected.id, plannedServings);
  };

  const getReasonIcon = (type: string) => {
    switch (type) {
      case 'expiring': return '⏰';
      case 'not_cooked_long': return '🔄';
      case 'never_cooked': return '✨';
      case 'available': return '✅';
      default: return '💡';
    }
  };

  // --- Шаг 2: подтверждение порций ---
  if (selected) {
    return (
      <div
        className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-[var(--color-paper)] border border-[var(--color-line)] w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.8)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs mb-4 transition-colors"
          >
            <ChevronLeft size={14} /> Назад
          </button>

          <h3 className="text-base font-bold text-white mb-1 truncate">{selected.title}</h3>
          <p className="text-[11px] text-white/40 mb-6">Рецепт рассчитан на {selected.servings} порц.</p>

          <div className="flex items-center gap-3 mb-6">
            <Users size={16} className="text-[var(--color-primary)] shrink-0" />
            <span className="text-sm text-white/70">На сколько порций готовить?</span>
          </div>

          {/* Быстрые кнопки */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {[1, 2, 3, 4, 6].map(n => (
              <button
                key={n}
                onClick={() => setPlannedServings(n)}
                className={`h-10 rounded-xl text-sm font-bold transition-all ${
                  plannedServings === n
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.10]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Ручной ввод */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setPlannedServings(p => Math.max(1, p - 1))}
              className="w-9 h-9 rounded-lg bg-white/[0.06] text-white/60 hover:bg-white/[0.12] text-lg font-bold transition-colors"
            >−</button>
            <input
              type="number"
              min={1}
              max={100}
              value={plannedServings}
              onChange={(e) => setPlannedServings(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="flex-1 h-9 rounded-lg bg-[var(--color-cream)] border border-[var(--color-line)] text-white text-center text-sm focus:outline-none focus:border-[var(--color-primary)]/40"
            />
            <button
              onClick={() => setPlannedServings(p => Math.min(100, p + 1))}
              className="w-9 h-9 rounded-lg bg-white/[0.06] text-white/60 hover:bg-white/[0.12] text-lg font-bold transition-colors"
            >+</button>
          </div>

          {plannedServings !== selected.servings && (
            <p className="text-[11px] text-[var(--color-primary)]/70 mb-4 text-center">
              Покупки масштабируются ×{(plannedServings / selected.servings).toFixed(2)}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Добавить в меню
          </button>
        </div>
      </div>
    );
  }

  // --- Шаг 1: выбор рецепта ---
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-paper)] border border-[var(--color-line)] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col shadow-[0_24px_64px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-line)]">
          <h3 className="text-lg font-bold text-white">Выберите рецепт</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск рецепта..."
              autoFocus
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[var(--color-primary)]/40 transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Suggestions */}
          {!search.trim() && showSuggestions && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Рекомендации</h4>
                <button onClick={() => setShowSuggestions(false)} className="text-[10px] text-white/30 hover:text-white/60">
                  Скрыть
                </button>
              </div>
              {suggestionsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" />
                </div>
              ) : hasSuggestions ? (
                <ul className="space-y-1.5">
                  {suggestions.map((s) => (
                    <li key={s.recipe.id}>
                      <button
                        onClick={() => handlePickRecipe({ ...s.recipe, servings: 4 })}
                        disabled={loading}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-[var(--color-line)] hover:border-[var(--color-primary)]/20 hover:bg-white/[0.04] transition-all text-left disabled:opacity-50"
                      >
                        {s.recipe.imageUrl ? (
                          <img src={s.recipe.imageUrl} alt="" loading="lazy" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] shrink-0 flex items-center justify-center text-base">
                            {getReasonIcon(s.reasonType)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-white/70 truncate">{s.recipe.title}</p>
                          <p className="text-[10px] text-[var(--color-primary)]/70 truncate">{getReasonIcon(s.reasonType)} {s.reason}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-white/30 text-center py-2">Нет рекомендаций</p>
              )}
            </div>
          )}

          {!search.trim() && !showSuggestions && (
            <button onClick={() => setShowSuggestions(true)} className="mb-3 text-[11px] text-[var(--color-primary)] hover:underline">
              Показать рекомендации
            </button>
          )}

          {/* Готово дома — заготовки */}
          {!search.trim() && cookedPreserves && cookedPreserves.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                🍽 Готово дома
              </h4>
              <ul className="space-y-1.5">
                {cookedPreserves.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => onSelectPreserve?.(p.id, p.name)}
                      disabled={loading || !onSelectPreserve}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/20 hover:border-emerald-600/30 hover:bg-emerald-950/50 transition-all text-left disabled:opacity-50"
                    >
                      <div className="w-11 h-11 rounded-lg bg-emerald-900/40 border border-emerald-700/20 shrink-0 flex items-center justify-center text-lg">
                        🍲
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-white/70 truncate">{p.name}</p>
                        <p className="text-[10px] text-emerald-400/70">
                          {p.servings ? `${p.servings} порц.` : ''}
                          {p.servings && p.expiryDate ? ' · ' : ''}
                          {p.expiryDate ? `до ${new Date(p.expiryDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : ''}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All recipes */}
          <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
            {search.trim() ? 'Результаты' : 'Все рецепты'}
          </h4>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">Рецепты не найдены</p>
          ) : (
            <ul className="space-y-1">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => handlePickRecipe(r)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50"
                  >
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt="" loading="lazy" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-white/70 truncate">{r.title}</p>
                      <p className="text-[10px] text-white/30">
                        {r.totalTime ? `${r.totalTime} мин` : ''}
                        {r.totalTime && r.category ? ' · ' : ''}
                        {r.category ?? ''}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
