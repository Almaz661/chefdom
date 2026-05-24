import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Refrigerator,
  Snowflake,
  Package,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { clearAuth } from "../utils/auth";
import { trpc } from "../utils/trpc";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

// Полный список — для сайдбара десктопа. Мобильная нижняя нав показывает первые 5.
const navItems: NavItem[] = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/recipes", label: "Рецепты", icon: BookOpen },
  { to: "/menu", label: "Меню", icon: CalendarDays },
  { to: "/shopping", label: "Покупки", icon: ShoppingCart },
  { to: "/inventory", label: "Инвентарь", icon: Refrigerator },
  { to: "/preserves", label: "Заготовки", icon: Snowflake },
  { to: "/products", label: "Продукты", icon: Package },
  { to: "/receipts", label: "Чеки", icon: Receipt },
  { to: "/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/settings", label: "Настройки", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  // Логаут: сначала просим сервер удалить сессию из БД (чтобы украденный
  // токен стал бесполезен), потом чистим localStorage. Если запрос упадёт
  // (например, сервер засыпает на Render Free) — всё равно делаем локальный
  // логаут, чтобы пользователь не застревал.
  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        navigate("/login", { replace: true });
      },
    });
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Сайдбар — десктоп (lg+) */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col lg:bg-paper lg:border-r lg:border-line lg:px-3 lg:py-6">
        <div className="px-3 mb-8">
          <h1 className="font-serif text-2xl font-semibold text-primary">
            ШефДом!
          </h1>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-light text-primary"
                    : "text-ink-soft hover:bg-cream hover:text-ink"
                }`
              }
            >
              <Icon size={20} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-muted hover:text-alert hover:bg-cream transition-colors"
        >
          <LogOut size={20} strokeWidth={2} />
          Выйти
        </button>
      </aside>

      {/* Контент */}
      <main className="lg:pl-60 pb-20 lg:pb-0 min-h-screen">{children}</main>

      {/* Нижняя навигация — мобильная (до lg) */}
      <nav className="fixed bottom-0 inset-x-0 bg-paper border-t border-line lg:hidden flex">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-1 text-[11px] font-medium min-h-[56px] ${
                isActive ? "text-primary" : "text-ink-muted"
              }`
            }
          >
            <Icon size={22} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
