import { ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
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
  ChefHat,
  ArrowLeft,
} from "lucide-react";
import { clearAuth } from "../utils/auth";
import { trpc } from "../utils/trpc";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

const navItems: NavItem[] = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/recipes", label: "Рецепты", icon: BookOpen },
  { to: "/menu", label: "Меню", icon: CalendarDays },
  { to: "/shopping", label: "Покупки", icon: ShoppingCart },
  { to: "/inventory", label: "Инвентарь", icon: Refrigerator },
  { to: "/preserves", label: "Заготовки", icon: Snowflake },
  { to: "/receipts", label: "Чеки", icon: Receipt },
  { to: "/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/what-to-cook", label: "Что готовить", icon: ChefHat },
  { to: "/products", label: "Продукты", icon: Package },
  { to: "/settings", label: "Настройки", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();

  // Показываем кнопку «назад» на всех страницах кроме главной
  const isHome = location.pathname === "/";

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        navigate("/login", { replace: true });
      },
    });
  };

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 lg:flex-col bg-surface border-r border-line px-3 py-6">
        <div className="px-3 mb-10">
          <h1 className="font-serif text-xl font-semibold text-primary tracking-wide">
            ШефДом
          </h1>
        </div>
        <nav className="flex-1 flex flex-col gap-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "text-primary bg-primary-light"
                    : "text-ink-muted hover:text-ink-soft hover:bg-surface-hover"
                }`
              }
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-ink-muted hover:text-alert transition-colors"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Выйти
        </button>
      </aside>

      {/* Content */}
      <main className="lg:pl-56 flex-1 pb-20 lg:pb-0 min-h-screen">
        {/* Кнопка «Назад» — мобильная, на всех страницах кроме главной */}
        {!isHome && (
          <div className="lg:hidden px-4 pt-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm transition-colors"
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span>Назад</span>
            </button>
          </div>
        )}
        {children}
      </main>

      {/* Mobile nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-surface border-t border-line lg:hidden flex">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-medium min-h-[56px] ${
                isActive ? "text-primary" : "text-ink-muted"
              }`
            }
          >
            <Icon size={20} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
