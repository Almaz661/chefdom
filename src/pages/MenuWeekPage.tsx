import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { toast } from '../components/ui/Toast';
import { MenuWeekHeader } from '../components/menu-week/MenuWeekHeader';
import { MenuWeekKpiRow } from '../components/menu-week/MenuWeekKpiRow';
import { MenuWeekGrid } from '../components/menu-week/MenuWeekGrid';
import { MenuWeekRightPanel } from '../components/menu-week/MenuWeekRightPanel';
import { RecipePickerDialog } from '../components/menu-week/RecipePickerDialog';

// --- Helpers ---

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const s = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const e = end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${s} — ${e}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type PickSlot = {
  dayOfWeek: number;
  mealType: 'breakfast' | 'lunch' | 'dinner';
} | null;

/**
 * MenuWeekPage — Dark Luxury Dashboard с реальными данными.
 * Layout: grid 1fr|360px. Sidebar глобальный.
 */
export function MenuWeekPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [pickSlot, setPickSlot] = useState<PickSlot>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.menu.getWeek.useQuery({ weekStart });

  const addItem = trpc.menu.addItem.useMutation({
    onSuccess: () => {
      utils.menu.getWeek.invalidate({ weekStart });
      setPickSlot(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeItem = trpc.menu.removeItem.useMutation({
    onSuccess: () => utils.menu.getWeek.invalidate({ weekStart }),
    onError: (err) => toast.error(err.message),
  });

  const toShopping = trpc.menu.toShopping.useMutation({
    onSuccess: (result) => toast.success(`Добавлено ${result.added} продуктов в покупки`),
    onError: (err) => toast.error(err.message),
  });

  const todayStr = formatDate(new Date());

  const prevWeek = () => setWeekStart((w) => shiftWeek(w, -7));
  const nextWeek = () => setWeekStart((w) => shiftWeek(w, 7));
  const goToday = () => setWeekStart(getMonday(new Date()));

  const items = data?.items ?? [];
  const totalMeals = items.length;
  const totalTime = items.reduce((sum, i) => sum + (i.recipeTotalTime ?? 0), 0);
  const timeStr = totalTime > 60
    ? `${Math.floor(totalTime / 60)}ч ${totalTime % 60}м`
    : `${totalTime} мин`;

  return (
    <div className="h-[calc(100vh-2rem)] w-full bg-[#05070A] p-6 overflow-hidden">
      <div className="h-full grid grid-cols-[1fr_360px] gap-6">
        {/* Main */}
        <main className="h-full flex flex-col gap-5 min-h-0 overflow-hidden">
          <MenuWeekHeader
            weekLabel={formatWeekRange(weekStart)}
            onPrev={prevWeek}
            onNext={nextWeek}
            onToday={goToday}
            onToShopping={() => toShopping.mutate({ weekStart })}
            toShoppingPending={toShopping.isPending}
            hasMeals={totalMeals > 0}
          />
          <MenuWeekKpiRow
            totalMeals={totalMeals}
            totalTime={timeStr}
          />
          <MenuWeekGrid
            items={items}
            weekStart={weekStart}
            todayStr={todayStr}
            isLoading={isLoading}
            onAddMeal={(dayOfWeek, mealType) => setPickSlot({ dayOfWeek, mealType })}
            onRemoveMeal={(itemId) => removeItem.mutate({ itemId })}
          />
        </main>

        {/* Right Panel */}
        <MenuWeekRightPanel totalMeals={totalMeals} />
      </div>

      {/* Диалог выбора рецепта */}
      {pickSlot && (
        <RecipePickerDialog
          onSelect={(recipeId) => {
            addItem.mutate({
              weekStart,
              dayOfWeek: pickSlot.dayOfWeek,
              mealType: pickSlot.mealType,
              recipeId,
            });
          }}
          onClose={() => setPickSlot(null)}
          loading={addItem.isPending}
        />
      )}
    </div>
  );
}
