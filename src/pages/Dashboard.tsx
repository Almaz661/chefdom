import { Link } from "react-router-dom";
import {
  ChefHat,
  ShoppingCart,
  ArrowRight,
  BookOpen,
  CalendarDays,
} from "lucide-react";
import { getAuth } from "../utils/auth";

// Приветствие меняется по времени суток
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Доброе утро";
  if (h >= 11 && h < 17) return "Добрый день";
  if (h >= 17 && h < 22) return "Добрый вечер";
  return "Доброй ночи";
}

// «Вторник, 19 мая» — российский формат, заглавная буква в начале
function formatToday(): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function Dashboard() {
  const auth = getAuth();
  const name = auth?.name || "Семья";
  // JS: 0=Вс, 1=Пн ... 6=Сб. Конвертируем в индекс с понедельника.
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-6">
      {/* Приветствие */}
      <header>
        <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-ink mb-1">
          {getGreeting()}, {name}
        </h1>
        <p className="text-ink-soft">{formatToday()}</p>
      </header>

      {/*
        Алерт сроков годности появится здесь когда:
        — есть инвентарь (появится в Блоке 10)
        — в инвентаре есть позиции, истекающие в ближайшие 2 дня (этап B.1)
        Пока скрыт — не показываем пустой алерт «у вас всё хорошо», это шум.
      */}

      {/* Блюдо дня — пустое состояние */}
      <section className="bg-paper rounded-2xl border border-line overflow-hidden">
        <div className="aspect-[16/9] bg-cream flex items-center justify-center border-b border-line">
          <ChefHat
            size={56}
            className="text-line-strong"
            strokeWidth={1.5}
          />
        </div>
        <div className="p-6">
          <p className="text-xs text-ink-muted font-medium uppercase tracking-wider mb-2">
            Сегодня в меню
          </p>
          <h2 className="font-serif text-2xl font-semibold text-ink mb-2">
            На сегодня меню ещё не запланировано
          </h2>
          <p className="text-ink-soft mb-4 max-w-md">
            Добавь рецепты в меню недели, и здесь появится блюдо дня с фото и
            кнопкой «Готовить сейчас».
          </p>
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 text-primary font-medium hover:text-primary-dark transition-colors"
          >
            Открыть меню недели
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Две главные карточки */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/what-to-cook"
          className="bg-paper rounded-2xl border border-line p-6 hover:border-primary hover:shadow-sm transition-all group"
        >
          <ChefHat
            size={32}
            className="text-primary mb-3"
            strokeWidth={1.5}
          />
          <h3 className="font-serif text-xl font-semibold text-ink mb-1">
            Что приготовить?
          </h3>
          <p className="text-ink-soft text-sm mb-3">Из того, что есть дома</p>
          <span className="inline-flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
            Подобрать рецепт
            <ArrowRight size={16} />
          </span>
        </Link>

        <Link
          to="/shopping"
          className="bg-paper rounded-2xl border border-line p-6 hover:border-primary hover:shadow-sm transition-all group"
        >
          <ShoppingCart
            size={32}
            className="text-primary mb-3"
            strokeWidth={1.5}
          />
          <h3 className="font-serif text-xl font-semibold text-ink mb-1">
            Список покупок
          </h3>
          <p className="text-ink-soft text-sm mb-3">Список пуст</p>
          <span className="inline-flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
            Открыть
            <ArrowRight size={16} />
          </span>
        </Link>
      </div>

      {/* Недавно готовила — пустое состояние */}
      <section>
        <h3 className="font-serif text-lg font-semibold text-ink mb-3">
          Недавно готовила
        </h3>
        <div className="bg-paper border border-line border-dashed rounded-2xl p-8 text-center">
          <BookOpen
            size={32}
            className="text-line-strong mx-auto mb-3"
            strokeWidth={1.5}
          />
          <p className="text-ink-soft text-sm">
            Пока ничего не готовила.
            <br />
            История появится после первого приготовления.
          </p>
        </div>
      </section>

      {/* Меню недели — мини-полоса */}
      <section className="bg-paper rounded-2xl border border-line p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h3 className="font-serif text-lg font-semibold text-ink inline-flex items-center gap-2">
            <CalendarDays
              size={20}
              className="text-ink-soft"
              strokeWidth={2}
            />
            Меню недели
          </h3>
          <Link
            to="/menu"
            className="text-primary text-sm font-medium hover:text-primary-dark inline-flex items-center gap-1"
          >
            Изменить
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((label, idx) => {
            const isToday = idx === todayIdx;
            return (
              <div key={label} className="flex flex-col items-center gap-2">
                <span
                  className={`text-xs font-medium ${
                    isToday ? "text-primary" : "text-ink-muted"
                  }`}
                >
                  {label}
                </span>
                <div
                  className={`w-9 h-9 rounded-full border-2 ${
                    isToday
                      ? "bg-primary-light border-primary"
                      : "border-line bg-cream"
                  }`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-ink-muted text-xs text-center mt-5">
          Тапни на день в меню недели, чтобы добавить блюдо.
        </p>
      </section>
    </div>
  );
}
