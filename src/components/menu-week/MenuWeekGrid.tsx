import { Plus, Clock, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MEALS: { key: 'breakfast' | 'lunch' | 'dinner'; label: string }[] = [
  { key: 'breakfast', label: 'Завтрак' },
  { key: 'lunch', label: 'Обед' },
  { key: 'dinner', label: 'Ужин' },
];

interface MenuItem {
  id: number;
  dayOfWeek: number;
  mealType: string;
  recipeId: number;
  recipeTitle: string;
  recipeImage: string | null;
  recipeTotalTime: number | null;
}

export function MenuWeekGrid({
  items,
  weekStart,
  todayStr,
  isLoading,
  onAddMeal,
  onRemoveMeal,
}: {
  items: MenuItem[];
  weekStart: string;
  todayStr: string;
  isLoading: boolean;
  onAddMeal: (dayOfWeek: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  onRemoveMeal: (itemId: number) => void;
}) {
  // Determine today's day index
  const weekStartDate = new Date(weekStart + 'T00:00:00');
  const todayDate = new Date(todayStr + 'T00:00:00');
  const todayIdx = Math.floor((todayDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24));

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center rounded-[20px] border border-white/[0.06] bg-[#080c18]/60">
        <Loader2 size={32} className="animate-spin text-[#c9a84c]" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#080c18]/60 backdrop-blur-xl shadow-[0_16px_64px_rgba(0,0,0,0.5)] p-3">
      {/* Day headers */}
      <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-1 mb-2 shrink-0">
        <div />
        {DAYS.map((day, i) => (
          <div key={day} className="text-center py-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${i === todayIdx ? 'text-[#c9a84c]' : 'text-white/40'}`}>
              {day}
            </span>
            {i === todayIdx && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] mx-auto mt-1 shadow-[0_0_8px_rgba(232,185,74,0.7)]" />
            )}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] grid-rows-3 gap-1 h-full">
          {MEALS.map(({ key: mealKey, label: mealLabel }) => (
            <div key={mealKey} className="contents">
              {/* Meal label */}
              <div className="flex items-center justify-center">
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                  {mealLabel}
                </span>
              </div>

              {/* Day cells */}
              {DAYS.map((_, dayIdx) => {
                const cellItems = items.filter(
                  (i) => i.dayOfWeek === dayIdx && i.mealType === mealKey,
                );

                return cellItems.length > 0 ? (
                  <div key={`${dayIdx}-${mealKey}`} className="flex flex-col gap-1 h-full min-w-0">
                    {cellItems.map((item) => (
                      <MealCard
                        key={item.id}
                        item={item}
                        onRemove={() => onRemoveMeal(item.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <MealCardEmpty
                    key={`${dayIdx}-${mealKey}`}
                    onClick={() => onAddMeal(dayIdx, mealKey)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MealCard({ item, onRemove }: { item: MenuItem; onRemove: () => void }) {
  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[#0b0f1e]/80 overflow-hidden hover:border-[#c9a84c]/30 hover:shadow-[0_8px_32px_rgba(201,149,60,0.15)] transition-all duration-300 cursor-pointer group flex flex-col h-full min-w-0 relative">
      {/* Remove button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
        className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 hover:border-red-400"
      >
        <X size={10} className="text-white" />
      </button>

      {/* Photo — 72% */}
      <Link to={`/recipes/${item.recipeId}`} className="relative flex-[72] min-h-0 overflow-hidden block">
        {item.recipeImage ? (
          <img
            src={item.recipeImage}
            alt={item.recipeTitle}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a2040] to-[#0c1021] flex items-center justify-center">
            <span className="text-white/20 text-lg font-bold">{item.recipeTitle.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070A]/90 via-transparent to-transparent" />
        {/* Time badge */}
        {item.recipeTotalTime && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/[0.06]">
            <div className="flex items-center gap-0.5">
              <Clock size={8} className="text-[#c9a84c]" />
              <span className="text-[9px] text-white/80 font-semibold">{item.recipeTotalTime} мин</span>
            </div>
          </div>
        )}
      </Link>
      {/* Info — 28% */}
      <Link to={`/recipes/${item.recipeId}`} className="flex-[28] px-2 py-1.5 flex items-center">
        <p className="text-[11px] text-white/75 font-semibold leading-tight line-clamp-2 group-hover:text-white transition-colors duration-200">
          {item.recipeTitle}
        </p>
      </Link>
    </div>
  );
}

function MealCardEmpty({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-[14px] border border-dashed border-white/[0.07] flex items-center justify-center hover:border-[#c9a84c]/30 hover:bg-[#c9a84c]/[0.04] hover:shadow-[0_4px_16px_rgba(201,149,60,0.08)] transition-all duration-300 cursor-pointer group h-full min-w-0 w-full"
    >
      <div className="w-8 h-8 rounded-full border border-white/[0.08] flex items-center justify-center group-hover:border-[#c9a84c]/40 group-hover:bg-[#c9a84c]/10 transition-all duration-300">
        <Plus size={13} className="text-white/15 group-hover:text-[#c9a84c] transition-colors duration-300" />
      </div>
    </button>
  );
}
