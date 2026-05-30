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
  ChefHat,
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
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-52 lg:flex-col lg:bg-paper lg:border-r lg:border-line lg:px-3 lg:py-8">
        {/* Brand */}
        <div className="px-3 mb-10">
          <h1 className="font-serif text-lg font-semibold text-primary tracking-wide">
            ШефДом
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-px">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "text-primary bg-primary-light"
                    : "text-ink-muted hover:text-ink-soft hover:bg-surface-elevated"
                }`
              }
            >
              <Icon size={15} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-ink-muted hover:text-alert transition-colors mt-4"
        >
          <LogOut size={15} strokeWidth={1.5} />
          Выйти
        </button>
      </aside>

      {/* ═══ Main Content ═══ */}
      <main className="lg:pl-52 pb-20 lg:pb-0 min-h-screen">{children}</main>

      {/* ═══ Mobile Bottom Nav ═══ */}
      <nav className="fixed bottom-0 inset-x-0 bg-paper border-t border-line lg:hidden flex safe-bottom">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium min-h-[54px] ${
                isActive ? "text-primary" : "text-ink-muted"
              }`
            }
          >
            <Icon size={19} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
