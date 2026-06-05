import { useState } from 'react';
import { Search, X, Loader2, Clock } from 'lucide-react';
import { trpc } from '../../utils/trpc';

export function RecipePickerDialog({
  onSelect,
  onClose,
  loading,
  onSelectPreserve,
}: {
  onSelect: (recipeId: number) => void;
  onClose: () => void;
  loading: boolean;
  onSelectPreserve?: (preserveId: number, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { data, isLoading } = trpc.recipes.list.useQuery({
    search: search.trim() || undefined,
  });

  const { data: suggestions, isLoading: suggestionsLoading } = trpc.menu.getSuggestions.useQuery(
    { limit: 6 },
    { enabled: showSuggestions && !search.trim() }
  );

  const { data: cookedPreserves } = trpc.menu.getCookedPreserves.useQuery(
    undefined,
    { enabled: !search.trim() }
  );

  const recipes = data?.items ?? [];
  const hasSuggestions = suggestions && suggestions.length > 0;

  const getReasonIcon = (type: string) => {
    switch (type) {
      case 'expiring': return '⏰';
      case 'not_cooked_long': return '🔄';
      case 'never_cooked': return '✨';
      case 'available': return '✅';
      default: return '💡';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#0c1021] border border-white/[0.08] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col shadow-[0_24px_64px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
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
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-white/[0.08] bg-[#080c18] text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#c9953c]/40 transition-colors"
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
                  <Loader2 size={20} className="animate-spin text-[#e8b94a]" />
                </div>
              ) : hasSuggestions ? (
                <ul className="space-y-1.5">
                  {suggestions.map((s) => (
                    <li key={s.recipe.id}>
                      <button
                        onClick={() => onSelect(s.recipe.id)}
                        disabled={loading}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#c9953c]/20 hover:bg-white/[0.04] transition-all text-left disabled:opacity-50"
                      >
                        {s.recipe.imageUrl ? (
                          <img src={s.recipe.imageUrl} alt="" loading="lazy" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-[#1a2040] border border-white/[0.06] shrink-0 flex items-center justify-center text-base">
                            {getReasonIcon(s.reasonType)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-white/70 truncate">{s.recipe.title}</p>
                          <p className="text-[10px] text-[#e8b94a]/70 truncate">{getReasonIcon(s.reasonType)} {s.reason}</p>
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
            <button onClick={() => setShowSuggestions(true)} className="mb-3 text-[11px] text-[#e8b94a] hover:underline">
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
                      onClick={() => onSelectPreserve ? onSelectPreserve(p.id, p.name) : undefined}
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
              <Loader2 size={24} className="animate-spin text-[#e8b94a]" />
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">Рецепты не найдены</p>
          ) : (
            <ul className="space-y-1">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r.id)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50"
                  >
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt="" loading="lazy" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-[#1a2040] border border-white/[0.06] shrink-0" />
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
