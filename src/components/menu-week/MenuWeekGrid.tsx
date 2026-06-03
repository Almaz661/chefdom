import { Plus } from 'lucide-react';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MEALS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];

// Демо-данные для наполнения таблицы
const DEMO_MEALS: Record<string, { name: string; time: string; photo: string } | null> = {
  '0-0': { name: 'Овсянка с ягодами', time: '15 мин', photo: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=200&h=140&fit=crop' },
  '1-0': { name: 'Омлет с овощами', time: '12 мин', photo: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=200&h=140&fit=crop' },
  '2-0': { name: 'Сырники', time: '25 мин', photo: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=140&fit=crop' },
  '3-0': { name: 'Гранола', time: '5 мин', photo: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=200&h=140&fit=crop' },
  '4-0': { name: 'Каша рисовая', time: '20 мин', photo: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=200&h=140&fit=crop' },
  '5-0': { name: 'Блины', time: '30 мин', photo: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=200&h=140&fit=crop' },
  '6-0': { name: 'Яйца Бенедикт', time: '25 мин', photo: 'https://images.unsplash.com/photo-1608039829572-9b0189250953?w=200&h=140&fit=crop' },

  '0-1': { name: 'Куриный суп', time: '40 мин', photo: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&h=140&fit=crop' },
  '1-1': { name: 'Паста с лососем', time: '30 мин', photo: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=200&h=140&fit=crop' },
  '2-1': { name: 'Борщ', time: '60 мин', photo: 'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=200&h=140&fit=crop' },
  '3-1': { name: 'Цезарь с курицей', time: '20 мин', photo: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=200&h=140&fit=crop' },
  '4-1': { name: 'Том Ям', time: '35 мин', photo: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&h=140&fit=crop' },
  '5-1': { name: 'Стейк с овощами', time: '25 мин', photo: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=200&h=140&fit=crop' },
  '6-1': { name: 'Лазанья', time: '50 мин', photo: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=200&h=140&fit=crop' },

  '0-2': { name: 'Запечённый лосось', time: '35 мин', photo: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=140&fit=crop' },
  '1-2': { name: 'Курица с рисом', time: '40 мин', photo: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&h=140&fit=crop' },
  '2-2': { name: 'Тефтели', time: '45 мин', photo: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=200&h=140&fit=crop' },
  '3-2': { name: 'Рататуй', time: '50 мин', photo: 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=200&h=140&fit=crop' },
  '5-2': { name: 'Утка с черносливом', time: '90 мин', photo: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=200&h=140&fit=crop' },
  '6-2': { name: 'Пицца домашняя', time: '45 мин', photo: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=140&fit=crop' },

  '0-3': { name: 'Йогурт с орехами', time: '3 мин', photo: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=140&fit=crop' },
  '2-3': { name: 'Фруктовый смузи', time: '5 мин', photo: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=200&h=140&fit=crop' },
  '4-3': { name: 'Орехи и сухофрукты', time: '—', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=200&h=140&fit=crop' },
  '6-3': { name: 'Чизкейк', time: '—', photo: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=200&h=140&fit=crop' },
};

export function MenuWeekGrid() {
  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-2 mb-2">
        <div /> {/* spacer for meal labels */}
        {DAYS.map((day, i) => (
          <div key={day} className="text-center">
            <span className={`text-xs font-semibold ${i === 0 ? 'text-[#e8b94a]' : 'text-white/50'}`}>
              {day}
            </span>
            {i === 0 && (
              <div className="w-1 h-1 rounded-full bg-[#e8b94a] mx-auto mt-1 shadow-[0_0_4px_rgba(232,185,74,0.6)]" />
            )}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex-1 overflow-y-auto grid grid-cols-[60px_repeat(7,1fr)] grid-rows-4 gap-2 min-h-0">
        {MEALS.map((meal, mealIdx) => (
          <>
            {/* Meal row label */}
            <div key={`label-${meal}`} className="flex items-center">
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider writing-mode-vertical rotate-180 [writing-mode:vertical-rl]">
                {meal}
              </span>
            </div>

            {/* Cells for each day */}
            {DAYS.map((_, dayIdx) => {
              const key = `${dayIdx}-${mealIdx}`;
              const mealData = DEMO_MEALS[key];

              return mealData ? (
                <MealCard key={key} {...mealData} />
              ) : (
                <MealCardEmpty key={key} />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

function MealCard({ name, time, photo }: { name: string; time: string; photo: string }) {
  return (
    <div className="rounded-[14px] border border-white/[0.05] bg-[#0c1021]/60 overflow-hidden hover:border-[#c9953c]/20 hover:shadow-[0_4px_16px_rgba(201,149,60,0.08)] transition-all duration-200 cursor-pointer group flex flex-col">
      {/* Photo — 65-70% of card */}
      <div className="relative flex-[7] min-h-0 overflow-hidden">
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10]/80 via-transparent to-transparent" />
        {/* Time badge */}
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
          <span className="text-[9px] text-white/70 font-medium">{time}</span>
        </div>
      </div>
      {/* Info — 30-35% of card */}
      <div className="flex-[3] px-2 py-1.5 flex items-center">
        <p className="text-[10px] text-white/70 font-medium leading-tight line-clamp-2 group-hover:text-white/90 transition-colors">
          {name}
        </p>
      </div>
    </div>
  );
}

function MealCardEmpty() {
  return (
    <div className="rounded-[14px] border border-dashed border-white/[0.06] flex items-center justify-center hover:border-[#c9953c]/20 hover:bg-[#c9953c]/[0.02] transition-all duration-200 cursor-pointer group">
      <Plus size={14} className="text-white/15 group-hover:text-[#c9953c]/50 transition-colors" />
    </div>
  );
}
