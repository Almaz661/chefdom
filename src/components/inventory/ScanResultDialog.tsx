import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { trpc } from '../../utils/trpc';
import { GlassCard } from '../ui/GlassCard';

const STORAGE_OPTIONS: { key: 'fridge' | 'freezer' | 'pantry'; label: string }[] = [
  { key: 'fridge', label: 'Холодильник' },
  { key: 'freezer', label: 'Морозилка' },
  { key: 'pantry', label: 'Кладовая' },
];

export function ScanResultDialog({
  barcode,
  storageType: defaultStorage,
  onClose,
}: {
  barcode: string;
  storageType: 'fridge' | 'freezer' | 'pantry';
  onClose: () => void;
}) {
  const [storageType, setStorageType] = useState<'fridge' | 'freezer' | 'pantry'>(defaultStorage);
  const [expiryDate, setExpiryDate] = useState('');
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('');
  const [customUnit, setCustomUnit] = useState('');

  const utils = trpc.useUtils();

  const lookup = trpc.products.getByBarcode.useQuery(
    { barcode },
    { retry: false },
  );

  const add = trpc.inventory.add.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
    },
  });

  const product = lookup.data;
  const notFound = lookup.isError || (lookup.isSuccess && !product);
  const isLoading = lookup.isLoading;

  const handleAdd = () => {
    if (product) {
      add.mutate({
        productName: product.brand
          ? `${product.brand} ${product.nameRu}`
          : product.nameRu,
        quantity: product.packageQuantity
          ? Number(product.packageQuantity)
          : null,
        unit: product.packageUnit || null,
        storageType,
        expiryDate: expiryDate || null,
      });
    } else if (customName.trim()) {
      add.mutate({
        productName: customName.trim(),
        quantity: customQty ? Number(customQty) : null,
        unit: customUnit.trim() || null,
        storageType,
        expiryDate: expiryDate || null,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <GlassCard className="relative w-full sm:w-[400px] sm:max-w-[95vw] p-7 rounded-t-[24px] sm:rounded-[24px]">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>

          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
              <span className="ml-3 text-white/50 text-sm">Ищу товар…</span>
            </div>
          )}

          {product && !isLoading && (
            <>
              <h3 className="text-lg font-bold text-white mb-2">Товар найден</h3>
              <p className="text-sm text-white/70 mb-1">
                <span className="font-medium">
                  {product.brand ? `${product.brand} ${product.nameRu}` : product.nameRu}
                </span>
              </p>
              {(product.packageQuantity || product.packageUnit) && (
                <p className="text-xs text-white/35 mb-3">
                  {product.packageQuantity} {product.packageUnit}
                </p>
              )}
              <p className="text-xs text-white/25 mb-4">Штрих-код: {barcode}</p>

              {/* Storage selector */}
              <fieldset className="mb-4">
                <legend className="block text-[11px] text-white/35 mb-2 uppercase tracking-wider font-semibold">Куда положить?</legend>
                <div className="flex gap-1 p-1 rounded-xl border border-[var(--color-line)] bg-white/[0.03]">
                  {STORAGE_OPTIONS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStorageType(key)}
                      className={`flex-1 px-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        storageType === key
                          ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                          : 'text-white/35 hover:text-white/55'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Expiry */}
              <label className="block mb-5">
                <span className="block text-[11px] text-white/35 mb-2 uppercase tracking-wider font-semibold">
                  Срок годности
                </span>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full h-12 px-4 input-dark [color-scheme:dark]"
                />
              </label>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost flex-1 h-12"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={add.isPending}
                  className="flex-1 h-12 rounded-xl btn-gold"
                >
                  {add.isPending ? 'Добавляю…' : 'В инвентарь'}
                </button>
              </div>
            </>
          )}

          {notFound && !isLoading && (
            <>
              <h3 className="text-lg font-bold text-white mb-2">Товар не найден</h3>
              <p className="text-xs text-white/35 mb-4">Штрих-код: {barcode}. Добавьте вручную:</p>

              <div className="space-y-3">
                {/* Storage selector */}
                <fieldset>
                  <legend className="block text-[11px] text-white/35 mb-2 uppercase tracking-wider font-semibold">Куда положить?</legend>
                  <div className="flex gap-1 p-1 rounded-xl border border-[var(--color-line)] bg-white/[0.03]">
                    {STORAGE_OPTIONS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStorageType(key)}
                        className={`flex-1 px-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                          storageType === key
                            ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                            : 'text-white/35 hover:text-white/55'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Название продукта"
                  autoFocus
                  className="w-full h-12 px-4 input-dark"
                />
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    placeholder="Кол-во"
                    step="any"
                    min="0"
                    className="flex-1 h-12 px-4 input-dark"
                  />
                  <input
                    type="text"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="Ед."
                    className="w-24 h-12 px-4 input-dark"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full h-12 px-4 input-dark [color-scheme:dark]"
                  />
                  <p className="text-[11px] text-white/25 mt-1.5 ml-1">Срок годности (необязательно)</p>
                </div>
              </div>

              <div className="flex gap-3 pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost flex-1 h-12"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!customName.trim() || add.isPending}
                  className="flex-1 h-12 rounded-xl btn-gold"
                >
                  {add.isPending ? 'Добавляю…' : 'Добавить'}
                </button>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
