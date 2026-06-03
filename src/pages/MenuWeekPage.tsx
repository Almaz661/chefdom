import { MenuWeekHeader } from '../components/menu-week/MenuWeekHeader';
import { MenuWeekKpiRow } from '../components/menu-week/MenuWeekKpiRow';
import { MenuWeekGrid } from '../components/menu-week/MenuWeekGrid';
import { MenuWeekRightPanel } from '../components/menu-week/MenuWeekRightPanel';

/**
 * MenuWeekPage — Dark Luxury Dashboard.
 * 2-колоночный layout внутри глобального App layout:
 * Main (1fr) | Right Panel (360px фиксированная).
 * Никакого внутреннего sidebar — используется глобальный.
 */
export function MenuWeekPage() {
  return (
    <div className="h-[calc(100vh-2rem)] w-full bg-[#05070A] p-6 overflow-hidden">
      <div className="h-full grid grid-cols-[1fr_360px] gap-6">
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
