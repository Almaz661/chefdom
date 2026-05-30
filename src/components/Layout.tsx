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
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col lg:bg-paper lg:border-r lg:border-line lg:px-4 lg:py-6 lg:shadow-sm">
        <div className="px-3 mb-10">
          <h1 className="font-serif text-2xl font-bold text-primary tracking-tight">
            ШефДом!
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">Кухня под контролем</p>
        </div>
        <nav className="flex-1 flex flex-col gap-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-paper shadow-md"
                    : "text-ink-soft hover:bg-cream hover:text-ink hover:translate-x-0.5"
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line pt-3 mt-3">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-muted hover:text-alert hover:bg-alert/5 transition-all w-full"
          >
            <LogOut size={18} strokeWidth={2} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Контент */}
      <main className="lg:pl-64 pb-20 lg:pb-0 min-h-screen">{children}</main>

      {/* Нижняя навигация — мобильная (до lg) */}
      <nav className="fixed bottom-0 inset-x-0 glass border-t border-line/50 lg:hidden flex safe-bottom shadow-lg">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-medium min-h-[60px] transition-all duration-200 ${
                isActive
                  ? "text-primary scale-105"
                  : "text-ink-muted hover:text-ink"
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
