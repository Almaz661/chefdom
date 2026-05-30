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
      {/* ═══ Sidebar — спокойное, почти монохромное ═══ */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 lg:flex-col bg-paper border-r border-line px-3 py-8">
        {/* Logo — золотистый акцент */}
        <div className="px-3 mb-12 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ChefHat size={16} className="text-primary" strokeWidth={1.5} />
          </div>
          <span className="font-serif text-lg font-semibold text-primary">ШефДом</span>
        </div>

        {/* Nav — активный пункт = золотистая плашка */}
        <nav className="flex-1 flex flex-col gap-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-primary/12 text-primary"
                    : "text-ink-muted hover:text-ink-soft hover:bg-surface-elevated"
                }`
              }
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line pt-4 mt-4">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-ink-muted hover:text-alert transition-colors w-full"
          >
            <LogOut size={16} strokeWidth={1.5} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="lg:pl-56 pb-20 lg:pb-0 min-h-screen">{children}</main>

      {/* Mobile nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-paper border-t border-line lg:hidden flex safe-bottom">
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
