import { useState } from "react";
import { Search, Package, Barcode } from "lucide-react";
import { trpc } from "../utils/trpc";
import { BarcodeScanner } from "../components/BarcodeScanner";

export function ProductsPage() {
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [mode, setMode] = useState<"search" | "barcode">("search");

  const searchResults = trpc.products.search.useQuery(
    { query },
    { enabled: query.length >= 2 }
  );

  const barcodeResult = trpc.products.getByBarcode.useQuery(
    { barcode },
    { enabled: barcode.length >= 4, retry: false }
  );

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink mb-6">
        Продукты
      </h1>

      {/* Переключатель режимов */}
      <div className="flex gap-1 bg-cream rounded-lg p-1 mb-6">
        <button
          onClick={() => setMode("search")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            mode === "search" ? "bg-paper text-primary shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Search size={18} />
          По названию
        </button>
        <button
          onClick={() => setMode("barcode")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            mode === "barcode" ? "bg-paper text-primary shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Barcode size={18} />
          По штрих-коду
        </button>
      </div>

      {mode === "search" && (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти продукт..."
            className="w-full h-12 px-4 bg-paper border border-line rounded-lg text-ink focus:outline-none focus:border-primary mb-4"
          />
          {searchResults.data && searchResults.data.length > 0 ? (
            <ul className="space-y-2">
              {searchResults.data.map((p) => (
                <li key={p.id} className="bg-paper border border-line rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-ink">{p.nameRu}</p>
                  {p.brand && <p className="text-xs text-ink-muted">{p.brand}</p>}
                  {p.barcode && <p className="text-xs text-ink-muted font-mono">{p.barcode}</p>}
                </li>
              ))}
            </ul>
          ) : query.length >= 2 && !searchResults.isLoading ? (
            <div className="text-center py-12 text-ink-muted text-sm">
              Ничего не найдено
            </div>
          ) : (
            <div className="bg-paper border border-line border-dashed rounded-2xl p-8 text-center">
              <Package size={32} className="text-line-strong mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-ink-soft text-sm">Введите название продукта для поиска</p>
            </div>
          )}
        </>
      )}

      {mode === "barcode" && (
        <>
          {/* Фото-сканер */}
          <div className="mb-4">
            <BarcodeScanner onDetected={(code) => setBarcode(code)} />
          </div>

          {/* Ручной ввод */}
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-xs">или вручную:</span>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Введите штрих-код..."
              inputMode="numeric"
              className="w-full h-12 pl-24 pr-4 bg-paper border border-line rounded-lg text-ink focus:outline-none focus:border-primary font-mono"
            />
          </div>
          {barcodeResult.data ? (
            <div className="bg-paper border border-line rounded-xl px-4 py-4">
              <p className="text-base font-medium text-ink mb-1">{barcodeResult.data.nameRu}</p>
              {barcodeResult.data.brand && <p className="text-sm text-ink-muted">{barcodeResult.data.brand}</p>}
              {barcodeResult.data.packageQuantity && (
                <p className="text-sm text-ink-muted">
                  {barcodeResult.data.packageQuantity} {barcodeResult.data.packageUnit}
                </p>
              )}
              <p className="text-xs text-ink-muted font-mono mt-2">{barcodeResult.data.barcode}</p>
            </div>
          ) : barcodeResult.isError ? (
            <div className="text-center py-8 text-ink-muted text-sm">
              Товар не найден по этому штрих-коду
            </div>
          ) : (
            <div className="bg-paper border border-line border-dashed rounded-2xl p-8 text-center">
              <Barcode size={32} className="text-line-strong mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-ink-soft text-sm">Введите штрих-код с упаковки</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
