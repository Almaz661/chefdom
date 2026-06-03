import { ScanLine, Plus, Loader2 } from 'lucide-react';
import { GoldButton } from '../ui/GoldButton';

const TAB_TITLES: Record<'fridge' | 'freezer' | 'pantry', string> = {
  fridge: 'Холодильник',
  freezer: 'Морозилка',
  pantry: 'Кладовая',
};

export function InventoryHeader({
  tab,
  showScanner,
  onToggleScanner,
  onAdd,
  onRecalcExpiry,
  recalcPending,
}: {
  tab: 'fridge' | 'freezer' | 'pantry';
  showScanner: boolean;
  onToggleScanner: () => void;
  onAdd: () => void;
  onRecalcExpiry: () => void;
  recalcPending: boolean;
}) {
  return (
    <div className="space-y-1 shrink-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">{TAB_TITLES[tab]}</h1>
          <p className="text-white/40 text-sm mt-0.5">Контроль продуктов, сроков и запасов</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Recalc expiry */}
          <GoldButton
            variant="outline"
            className="text-xs px-3 py-2"
            onClick={onRecalcExpiry}
          >
            {recalcPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <span>📅</span>
            )}
            {recalcPending ? 'Считаю…' : 'Сроки'}
          </GoldButton>

          {/* Scanner */}
          <GoldButton
            variant={showScanner ? 'solid' : 'outline'}
            className="text-xs px-3 py-2"
            onClick={onToggleScanner}
          >
            <ScanLine size={14} />
          </GoldButton>

          {/* Add */}
          <GoldButton className="text-xs px-3 py-2" onClick={onAdd}>
            <Plus size={14} />
            Добавить
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
