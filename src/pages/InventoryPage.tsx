import { useState } from 'react';
import { daysUntilExpiry } from '../../utils/dateUtils';
import { Loader2 } from 'lucide-react';
import { trpc } from '../utils/trpc';
import { toast } from '../components/ui/Toast';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { InventoryHeader } from '../components/inventory/InventoryHeader';
import { InventoryTabs } from '../components/inventory/InventoryTabs';
import { InventoryKpiRow } from '../components/inventory/InventoryKpiRow';
import { InventoryExpiringSection } from '../components/inventory/InventoryExpiringSection';
import { InventoryAllExpiry } from '../components/inventory/InventoryAllExpiry';
import { InventoryProductList } from '../components/inventory/InventoryProductList';
import { AddInventoryDialog } from '../components/inventory/AddInventoryDialog';
import { ScanResultDialog } from '../components/inventory/ScanResultDialog';
import type { ViewItem } from '../components/inventory/InventoryExpiringSection';

/** Сколько дней до истечения срока */

export function InventoryPage() {
  const [tab, setTab] = useState<'fridge' | 'freezer' | 'pantry'>('fridge');
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [expiryPeriod, setExpiryPeriod] = useState<number>(3);
  const [showAllExpiry, setShowAllExpiry] = useState(false);
  const [scanResult, setScanResult] = useState<{
    found: boolean;
    name?: string;
    brand?: string;
    packageQuantity?: string | null;
    packageUnit?: string | null;
    barcode: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: allItems = [], isLoading } = trpc.inventory.list.useQuery();
  const { data: allPreserves = [] } = trpc.preserves.list.useQuery();

  const remove = trpc.inventory.remove.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });
  const removePreserve = trpc.preserves.remove.useMutation({
    onSuccess: () => utils.preserves.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });
  const toggleBasic = trpc.inventory.update.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });
  const recalc = trpc.inventory.recalcExpiry.useMutation({
    onSuccess: (data) => {
      utils.inventory.list.invalidate();
      if (data.updated > 0) {
        toast.success(`Проставлено сроков: ${data.updated} из ${data.total} продуктов`);
      } else {
        toast.info('У всех продуктов уже есть сроки или не нашлось совпадений');
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // --- Data transformations (logic preserved 1:1) ---

  const inventoryView: ViewItem[] = allItems
    .filter((i) => i.storageType === tab)
    .map((i) => ({
      id: i.id,
      source: 'inventory' as const,
      productName: i.productName,
      quantity: i.quantity,
      unit: i.unit,
      expiryDate: i.expiryDate,
      category: i.category,
      minQuantity: i.minQuantity ?? null,
      isBasic: (i as any).isBasic === 1,
    }));

  const preservesView: ViewItem[] =
    tab === 'freezer'
      ? allPreserves
          .filter((p) => p.preserveType === 'frozen')
          .map((p) => ({
            id: p.id,
            source: 'preserve' as const,
            productName: p.name,
            quantity: p.quantity,
            unit: p.unit,
            expiryDate: p.expiryDate,
            category: 'Заготовки',
            minQuantity: null,
            isBasic: false,
          }))
      : [];

  const items: ViewItem[] = [...inventoryView, ...preservesView];

  // Expiring items
  const expiring = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days !== null && days <= expiryPeriod;
  });

  // Normal items (not expiring)
  const normal = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days === null || days > expiryPeriod;
  });

  // All items with expiry sorted
  const allWithExpiry = items
    .filter((i) => i.expiryDate !== null)
    .sort((a, b) => {
      const dA = daysUntilExpiry(a.expiryDate) ?? 9999;
      const dB = daysUntilExpiry(b.expiryDate) ?? 9999;
      return dA - dB;
    });

  // KPI counts
  const basicCount = items.filter((i) => i.isBasic).length;

  // Handlers
  const handleRemove = (it: ViewItem) => {
    if (it.source === 'preserve') {
      removePreserve.mutate({ id: it.id });
    } else {
      remove.mutate({ id: it.id });
    }
  };

  const handleToggleBasic = (it: ViewItem) => {
    if (it.source === 'inventory') {
      toggleBasic.mutate({ id: it.id, isBasic: !it.isBasic });
    }
  };

  const handleRecalcExpiry = () => {
    if (confirm('Проставить сроки годности всем продуктам без даты?')) {
      recalc.mutate();
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] w-full bg-[#05070A] p-6 overflow-hidden relative">
      {/* Kitchen Atelier background — only on Pantry tab */}
      {tab === 'pantry' && (
        <>
          <img
            src="/images/ingredients/kitchen.webp"
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-[#05070A]/25 pointer-events-none" />
        </>
      )}
      <div className="relative h-full max-w-5xl mx-auto flex flex-col gap-5">
        {/* Header */}
        <InventoryHeader
          tab={tab}
          showScanner={showScanner}
          onToggleScanner={() => setShowScanner(!showScanner)}
          onAdd={() => setShowAdd(true)}
          onRecalcExpiry={handleRecalcExpiry}
          recalcPending={recalc.isPending}
        />

        {/* Scanner */}
        {showScanner && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#080c18]/60 backdrop-blur-xl p-5 shrink-0">
            <BarcodeScanner
              onDetected={(code) => {
                setScanResult({ found: false, barcode: code });
                setShowScanner(false);
              }}
            />
          </div>
        )}

        {/* Tabs */}
        <InventoryTabs active={tab} onChange={setTab} />

        {/* KPI */}
        <InventoryKpiRow
          totalItems={items.length}
          expiringCount={expiring.length}
          basicCount={basicCount}
        />

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-[#c9a84c]" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
            {/* Expiring section */}
            <InventoryExpiringSection
              items={expiring}
              expiryPeriod={expiryPeriod}
              onExpiryPeriodChange={setExpiryPeriod}
              onRemove={handleRemove}
            />

            {/* All expiry toggle */}
            <InventoryAllExpiry
              items={allWithExpiry}
              expiryPeriod={expiryPeriod}
              isOpen={showAllExpiry}
              onToggle={() => setShowAllExpiry(!showAllExpiry)}
            />

            {/* Main product list */}
            <InventoryProductList
              items={normal}
              tab={tab}
              onRemove={handleRemove}
              onToggleBasic={handleToggleBasic}
            />
          </div>
        )}
      </div>

      {/* Add dialog */}
      {showAdd && (
        <AddInventoryDialog
          storageType={tab}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Scan result dialog */}
      {scanResult && (
        <ScanResultDialog
          barcode={scanResult.barcode}
          storageType={tab}
          onClose={() => setScanResult(null)}
        />
      )}
    </div>
  );
}
