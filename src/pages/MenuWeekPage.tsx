import { AppSidebar } from '../components/sidebar/AppSidebar';
import { MenuWeekHeader } from '../components/menu-week/MenuWeekHeader';
import { MenuWeekKpiRow } from '../components/menu-week/MenuWeekKpiRow';
import { MenuWeekGrid } from '../components/menu-week/MenuWeekGrid';
import { MenuWeekRightPanel } from '../components/menu-week/MenuWeekRightPanel';

/**
 * MenuWeekPage — Dark Luxury Dashboard.
 * 3-колоночный layout: Sidebar (280px) | Main (1fr) | Right Panel (360px).
 * 100vh, без скролла на уровне страницы.
 */
export function MenuWeekPage() {
  return (
    <div className="h-screen w-full bg-[#05070A] p-6 overflow-hidden">
      <div className="h-full grid grid-cols-[280px_1fr_360px] gap-6">
        {/* Левая колонка — Sidebar */}
        <AppSidebar />

        {/* Центральная колонка — Main */}
        <main className="h-full flex flex-col gap-5 min-h-0 overflow-hidden">
          <MenuWeekHeader />
          <MenuWeekKpiRow />
          <MenuWeekGrid />
        </main>

        {/* Правая колонка — Right Panel */}
        <MenuWeekRightPanel />
      </div>
    </div>
  );
}
