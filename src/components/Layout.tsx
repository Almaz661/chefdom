import { ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Home, BookOpen, CalendarDays, ShoppingCart, Refrigerator,
  Snowflake, Package, Receipt, BarChart3, Settings, LogOut, ChefHat, ArrowLeft,
} from "lucide-react";
import { clearAuth } from "../utils/auth";
import { trpc } from "../utils/trpc";

const navItems = [
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
  const location = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const isHome = location.pathname === "/";

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => { clearAuth(); navigate("/login", { replace: true }); },
    });
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-[227px] lg:flex-col"
        style={{ background: '#0f1428', borderRight: '1px solid #2d3548' }}>
        <div className="flex items-center gap-2 px-4 py-6 border-b border-line mb-6">
          <ChefHat size={20} className="text-primary" strokeWidth={1.5} />
          <span className="text-lg font-semibold text-primary">ШефДом</span>
        </div>
        <nav className="flex-1 flex flex-col gap-2 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to} to={to} end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-medium transition-all ${
                  isActive
                    ? "text-primary border-l-[3px] border-primary pl-[13px]"
                    : "text-ink-soft hover:text-primary hover:bg-surface-hover"
                }`
              }
              style={({ isActive }) => isActive ? { background: '#252d4a' } : {}}
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 pb-6">
          <button onClick={logout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-medium text-ink-soft hover:text-alert w-full">
            <LogOut size={16} strokeWidth={1.5} /> Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:ml-[227px] pb-20 lg:pb-0 min-h-screen p-6">
        {!isHome && (
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-ink-soft hover:text-primary text-sm font-medium mb-4 transition-colors">
            <ArrowLeft size={16} strokeWidth={1.5} /> Назад
          </button>
        )}
        {children}
      </main>

      {/* Mobile nav */}
      <nav className="fixed bottom-0 inset-x-0 lg:hidden flex border-t border-line"
        style={{ background: '#0f1428' }}>
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-medium min-h-[56px] ${
                isActive ? "text-primary" : "text-ink-muted"
              }`
            }>
            <Icon size={20} strokeWidth={1.5} /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
