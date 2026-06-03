import { Plus, Clock } from 'lucide-react';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MEALS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];

const DEMO_MEALS: Record<string, { name: string; time: string; photo: string } | null> = {
  '0-0': { name: 'Овсянка с ягодами', time: '15 мин', photo: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&h=280&fit=crop' },
  '1-0': { name: 'Омлет с овощами', time: '12 мин', photo: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&h=280&fit=crop' },
  '2-0': { name: 'Сырники со сметаной', time: '25 мин', photo: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=280&fit=crop' },
  '3-0': { name: 'Гранола с йогуртом', time: '5 мин', photo: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&h=280&fit=crop' },
  '4-0': { name: 'Каша рисовая', time: '20 мин', photo: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=400&h=280&fit=crop' },
  '5-0': { name: 'Блины с ягодами', time: '30 мин', photo: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400&h=280&fit=crop' },
  '6-0': { name: 'Яйца Бенедикт', time: '25 мин', photo: 'https://images.unsplash.com/photo-1608039829572-9b0189250953?w=400&h=280&fit=crop' },
  '0-1': { name: 'Куриный суп', time: '40 мин', photo: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=280&fit=crop' },
  '1-1': { name: 'Паста с лососем', time: '30 мин', photo: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400&h=280&fit=crop' },
  '2-1': { name: 'Борщ украинский', time: '60 мин', photo: 'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=400&h=280&fit=crop' },
  '3-1': { name: 'Цезарь с курицей', time: '20 мин', photo: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=280&fit=crop' },
  '4-1': { name: 'Том Ям', time: '35 мин', photo: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=280&fit=crop' },
  '5-1': { name: 'Стейк с овощами', time: '25 мин', photo: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=280&fit=crop' },
  '6-1': { name: 'Лазанья болоньезе', time: '50 мин', photo: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400&h=280&fit=crop' },
  '0-2': { name: 'Запечённый лосось', time: '35 мин', photo: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=280&fit=crop' },
  '1-2': { name: 'Курица с рисом', time: '40 мин', photo: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=280&fit=crop' },
  '2-2': { name: 'Тефтели в соусе', time: '45 мин', photo: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400&h=280&fit=crop' },
  '3-2': { name: 'Рататуй', time: '50 мин', photo: 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=400&h=280&fit=crop' },
  '4-2': { name: 'Плов узбекский', time: '60 мин', photo: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=280&fit=crop' },
  '5-2': { name: 'Утка с черносливом', time: '90 мин', photo: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=280&fit=crop' },
  '6-2': { name: 'Пицца домашняя', time: '45 мин', photo: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=280&fit=crop' },
  '0-3': { name: 'Йогурт с орехами', time: '3 мин', photo: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=280&fit=crop' },
  '2-3': { name: 'Фруктовый смузи', time: '5 мин', photo: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=280&fit=crop' },
  '4-3': { name: 'Орехи и сухофрукты', time: '—', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=280&fit=crop' },
  '6-3': { name: 'Чизкейк', time: '—', photo: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400&h=280&fit=crop' },
};

export function MenuWeekGrid() {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#080c18]/60 backdrop-blur-xl shadow-[0_16px_64px_rgba(0,0,0,0.5)] p-5">
      {/* Day headers */}
      <div className="grid grid-cols-[44px_repeat(7,1fr)] gap-[6px] mb-3 shrink-0">
        <div />
        {DAYS.map((day, i) => (
          <div key={day} className="text-center py-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${i === 0 ? 'text-[#e8b94a]' : 'text-white/40'}`}>
              {day}
            </span>
            {i === 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#e8b94a] mx-auto mt-1 shadow-[0_0_8px_rgba(232,185,74,0.7)]" />
            )}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-[44px_repeat(7,1fr)] grid-rows-4 gap-[6px] h-full">
          {MEALS.map((meal, mealIdx) => (
            <div key={meal} className="contents">
              {/* Meal label */}
              <div className="flex items-center justify-center">
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                  {meal}
                </span>
              </div>

              {/* Day cells */}
              {DAYS.map((_, dayIdx) => {
                const key = `${dayIdx}-${mealIdx}`;
                const mealData = DEMO_MEALS[key];
                return mealData ? (
                  <MealCard key={key} {...mealData} />
                ) : (
                  <MealCardEmpty key={key} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MealCard({ name, time, photo }: { name: string; time: string; photo: string }) {
  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[#0b0f1e]/80 overflow-hidden hover:border-[#c9953c]/30 hover:shadow-[0_8px_32px_rgba(201,149,60,0.15)] transition-all duration-300 cursor-pointer group flex flex-col h-full">
      {/* Photo — 70% */}
      <div className="relative flex-[7] min-h-0 overflow-hidden">
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070A]/95 via-[#05070A]/20 to-transparent" />
        {/* Time badge */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/[0.06]">
          <div className="flex items-center gap-1">
            <Clock size={9} className="text-[#e8b94a]" />
            <span className="text-[10px] text-white/80 font-semibold">{time}</span>
          </div>
        </div>
      </div>
      {/* Info — 30% */}
      <div className="flex-[3] px-3 py-2.5 flex items-center">
        <p className="text-[12px] text-white/75 font-semibold leading-snug line-clamp-2 group-hover:text-white transition-colors duration-200">
          {name}
        </p>
      </div>
    </div>
  );
}

function MealCardEmpty() {
  return (
    <div className="rounded-[16px] border border-dashed border-white/[0.07] flex items-center justify-center hover:border-[#c9953c]/30 hover:bg-[#c9953c]/[0.04] hover:shadow-[0_4px_16px_rgba(201,149,60,0.08)] transition-all duration-300 cursor-pointer group h-full">
      <div className="w-9 h-9 rounded-full border border-white/[0.08] flex items-center justify-center group-hover:border-[#c9953c]/40 group-hover:bg-[#c9953c]/10 transition-all duration-300">
        <Plus size={14} className="text-white/15 group-hover:text-[#e8b94a] transition-colors duration-300" />
      </div>
    </div>
  );
}
