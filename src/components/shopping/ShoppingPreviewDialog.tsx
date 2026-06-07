import { Refrigerator, Snowflake, Package, Loader2, X } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

type StorageType = 'fridge' | 'freezer' | 'pantry';

const STORAGE_LABELS: Record<StorageType, { label: string; icon: typeof Refrigerator }> = {
  fridge: { label: 'Холодильник', icon: Refrigerator },
  freezer: { label: 'Морозилка', icon: Snowflake },
  pantry: { label: 'Кладовая', icon: Package },
};

export interface PreviewItem {
  productName: string;
  quantity: number | null;
  unit: string | null;
  storageType: StorageType;
}

export function ShoppingPreviewDialog({
  items,
  onCycleStorage,
  onConfirm,
  onClose,
  isPending,
}: {
  items: PreviewItem[];
  onCycleStorage: (idx: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <GlassCard className="relative w-full sm:w-[440px] sm:max-w-[95vw] max-h-[80vh] flex flex-col rounded-t-[24px] sm:rounded-[24px] overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-[var(--color-line)] shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Раскладываем по местам</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-[11px] text-white/30 mt-1">
              Нажми на иконку чтобы изменить место хранения
            </p>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {items.map((item, idx) => {
                const storage = STORAGE_LABELS[item.storageType];
                const Icon = storage.icon;
                return (
                  <li
                    key={idx}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white/[0.03] border border-[var(--color-line)]"
                  >
                    <button
                      onClick={() => onCycleStorage(idx)}
                      className="w-9 h-9 rounded-lg border border-[var(--color-line)] bg-white/[0.04] flex items-center justify-center shrink-0 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/10 transition-all duration-200"
                      title={`Сейчас: ${storage.label}. Нажми чтобы изменить`}
                    >
                      <Icon size={18} className="text-[var(--color-primary)]" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/75 truncate">
                        {item.productName}
                      </p>
                      <p className="text-[11px] text-white/30">
                        → {storage.label}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--color-line)] flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-[var(--color-line)] text-white/50 font-medium hover:bg-white/[0.04] transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 h-12 rounded-xl btn-gold"
            >
              {isPending ? (
                <Loader2 size={18} className="animate-spin mx-auto" />
              ) : (
                `Подтвердить (${items.length})`
              )}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
