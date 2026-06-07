import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { trpc } from '../../utils/trpc';
import { GlassCard } from '../ui/GlassCard';

export function AddInventoryDialog({
  storageType,
  onClose,
}: {
  storageType: 'fridge' | 'freezer' | 'pantry';
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [minQuantity, setMinQuantity] = useState('');

  const utils = trpc.useUtils();

  const add = trpc.inventory.add.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    add.mutate({
      productName: name.trim(),
      quantity: quantity ? Number(quantity) : null,
      unit: unit.trim() || null,
      storageType,
      expiryDate: expiryDate || null,
      minQuantity: minQuantity ? Number(minQuantity) : null,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <GlassCard className="w-full sm:w-[400px] sm:max-w-[95vw] p-7 rounded-t-[24px] sm:rounded-[24px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Добавить продукт</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название продукта"
                autoFocus
                required
                className="w-full h-12 px-4 bg-white/[0.04] border border-[var(--color-line)] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Кол-во"
                step="any"
                min="0"
                className="flex-1 h-12 px-4 bg-white/[0.04] border border-[var(--color-line)] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
              />
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ед. (кг, л, шт)"
                className="w-28 h-12 px-4 bg-white/[0.04] border border-[var(--color-line)] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
              />
            </div>

            <div>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-12 px-4 bg-white/[0.04] border border-[var(--color-line)] rounded-xl text-white/70 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors [color-scheme:dark]"
              />
              <p className="text-[11px] text-white/25 mt-1.5 ml-1">Срок годности (необязательно)</p>
            </div>

            <div>
              <input
                type="number"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="Мин. остаток (авто-докупка)"
                step="any"
                min="0"
                className="w-full h-12 px-4 bg-white/[0.04] border border-[var(--color-line)] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
              />
              <p className="text-[11px] text-white/25 mt-1.5 ml-1">Когда остаток ниже — автоматически в покупки</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl border border-[var(--color-line)] text-white/50 font-medium hover:bg-white/[0.04] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={!name.trim() || add.isPending}
                className="flex-1 h-12 rounded-xl btn-gold"
              >
                {add.isPending ? 'Добавляю…' : 'Добавить'}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
