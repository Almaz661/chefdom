import { Plus, Clock, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
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
  const weekStartDate = new Date(weekStart + 'T00:00:00');
  const todayDate = new Date(todayStr + 'T00:00:00');
  const todayIdx = Math.floor(
    (todayDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (isLoading) {
    return (
      <div className="bg-white/[0.03] border border-[var(--cd-line)] rounded-xl flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-[var(--cd-gold)]" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ── Desktop table (≥ md) ── */}
      <div className="hidden md:block bg-white/[0.03] border border-[var(--cd-line)] rounded-xl overflow-hidden">
        {/* Day header row */}
        <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-[var(--cd-line)]">
          <div className="px-3 py-3" />
          {DAYS.map((day, i) => (
            <div key={day} className="px-2 py-3 text-center border-l border-[var(--cd-line)]">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  i === todayIdx ? 'text-[var(--cd-gold)]' : 'text-white/40'
                }`}
              >
                {day}
              </span>
              {i === todayIdx && (
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--cd-gold)] mx-auto mt-1 shadow-[0_0_8px_rgba(201,168,76,0.7)]" />
              )}
            </div>
          ))}
        </div>

        {/* Meal rows */}
        {MEALS.map(({ key: mealKey, label: mealLabel }, mealIdx) => (
          <div
            key={mealKey}
            className={`grid grid-cols-[80px_repeat(7,minmax(0,1fr))] ${
              mealIdx < MEALS.length - 1 ? 'border-b border-[var(--cd-line)]' : ''
            }`}
          >
            {/* Meal label */}
            <div className="flex items-center justify-center px-3 py-4 border-r border-[var(--cd-line)]">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                {mealLabel}
              </span>
            </div>

            {/* Day cells */}
            {DAYS.map((_, dayIdx) => {
              const cellItems = items.filter(
                (i) => i.dayOfWeek === dayIdx && i.mealType === mealKey,
              );
              return (
                <div
                  key={`${dayIdx}-${mealKey}`}
                  className="p-1.5 border-l border-[var(--cd-line)] min-h-[96px]"
                >
                  {cellItems.length > 0 ? (
                    <div className="flex flex-col gap-1 h-full">
                      {cellItems.map((item) => (
                        <MealCard key={item.id} item={item} onRemove={() => onRemoveMeal(item.id)} />
                      ))}
                    </div>
                  ) : (
                    <MealCardEmpty onClick={() => onAddMeal(dayIdx, mealKey)} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Mobile list (< md): day-by-day ── */}
      <div className="md:hidden space-y-4">
        {DAYS.map((dayShort, dayIdx) => (
          <div key={dayIdx} className="bg-white/[0.03] border border-[var(--cd-line)] rounded-xl overflow-hidden">
            {/* Day header */}
            <div className={`px-4 py-2.5 border-b border-[var(--cd-line)] flex items-center gap-2 ${
              dayIdx === todayIdx ? 'bg-[var(--cd-gold)]/[0.06]' : ''
            }`}>
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  dayIdx === todayIdx ? 'text-[var(--cd-gold)]' : 'text-white/50'
                }`}
              >
                {DAYS_FULL[dayIdx]}
              </span>
              {dayIdx === todayIdx && (
                <span className="text-[10px] font-semibold text-[var(--cd-gold)]/70 bg-[var(--cd-gold)]/10 px-1.5 py-0.5 rounded-md">
                  Сегодня
                </span>
              )}
            </div>

            {/* Meal slots */}
            <div className="divide-y divide-white/[0.04]">
              {MEALS.map(({ key: mealKey, label: mealLabel }) => {
                const cellItems = items.filter(
                  (i) => i.dayOfWeek === dayIdx && i.mealType === mealKey,
                );
                return (
                  <div key={mealKey} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest w-14 shrink-0 pt-1">
                      {mealLabel}
                    </span>
                    <div className="flex-1 min-w-0">
                      {cellItems.length > 0 ? (
                        <div className="space-y-2">
                          {cellItems.map((item) => (
                            <MealCardMobile
                              key={item.id}
                              item={item}
                              onRemove={() => onRemoveMeal(item.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddMeal(dayIdx, mealKey)}
                          className="flex items-center gap-2 text-xs text-white/25 hover:text-[var(--cd-gold)] transition-colors group"
                        >
                          <div className="w-6 h-6 rounded-lg border border-dashed border-white/[0.12] flex items-center justify-center group-hover:border-[var(--cd-gold)]/40 group-hover:bg-[var(--cd-gold)]/[0.06] transition-all">
                            <Plus size={11} />
                          </div>
                          Добавить
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Desktop meal card ──

function MealCard({ item, onRemove }: { item: MenuItem; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--cd-line)] bg-white/[0.02] overflow-hidden hover:border-[var(--cd-gold)]/30 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer group flex flex-col h-full relative">
      {/* Remove */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
        className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 hover:border-red-400"
      >
        <X size={10} className="text-white" />
      </button>

      {/* Photo */}
      <Link to={`/recipes/${item.recipeId}`} className="relative block flex-1 overflow-hidden min-h-[56px]">
        {item.recipeImage ? (
          <img
            src={item.recipeImage}
            alt={item.recipeTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a2040] to-[#0c1021] flex items-center justify-center">
            <span className="text-white/20 text-base font-bold">{item.recipeTitle.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070A]/80 via-transparent to-transparent" />
        {item.recipeTotalTime && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 border border-[var(--cd-line)] flex items-center gap-0.5">
            <Clock size={8} className="text-[var(--cd-gold)]" />
            <span className="text-[9px] text-white/70 font-semibold">{item.recipeTotalTime}м</span>
          </div>
        )}
      </Link>

      {/* Title */}
      <Link to={`/recipes/${item.recipeId}`} className="px-2 py-1.5">
        <p className="text-[11px] text-white/70 font-medium leading-tight line-clamp-2 group-hover:text-white transition-colors">
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
      className="w-full h-full min-h-[inherit] rounded-xl border border-dashed border-white/[0.07] flex items-center justify-center hover:border-[var(--cd-gold)]/30 hover:bg-[var(--cd-gold)]/[0.03] transition-all duration-200 group"
    >
      <div className="w-8 h-8 rounded-full border border-[var(--cd-line)] flex items-center justify-center group-hover:border-[var(--cd-gold)]/40 group-hover:bg-[var(--cd-gold)]/10 transition-all duration-200">
        <Plus size={13} className="text-white/15 group-hover:text-[var(--cd-gold)] transition-colors" />
      </div>
    </button>
  );
}

// ── Mobile meal card ──

function MealCardMobile({ item, onRemove }: { item: MenuItem; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-white/[0.03] border border-[var(--cd-line)] rounded-lg px-2.5 py-2 group hover:border-white/[0.10] transition-all">
      {/* Thumbnail */}
      <Link to={`/recipes/${item.recipeId}`} className="w-8 h-8 rounded-md overflow-hidden shrink-0">
        {item.recipeImage ? (
          <img src={item.recipeImage} alt={item.recipeTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[var(--cd-surface)] flex items-center justify-center">
            <span className="text-white/30 text-xs font-bold">{item.recipeTitle.charAt(0)}</span>
          </div>
        )}
      </Link>

      {/* Name + time */}
      <Link to={`/recipes/${item.recipeId}`} className="flex-1 min-w-0">
        <p className="text-xs text-white/75 font-medium leading-tight line-clamp-1">{item.recipeTitle}</p>
        {item.recipeTotalTime && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock size={9} className="text-white/30" />
            <span className="text-[10px] text-white/30">{item.recipeTotalTime} мин</span>
          </div>
        )}
      </Link>

      {/* Remove */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}
