/**
 * BarcodeScanner — фото-сканер штрих-кодов.
 * Использует <input type="file" capture="environment"> для фото с камеры.
 * НЕ использует getUserMedia / decodeFromVideoDevice (не работает на iOS Safari).
 *
 * Стратегия распознавания:
 * 1. Загружаем фото → рисуем на canvas в разных вариантах (масштабы, обрезки)
 * 2. Для каждого варианта пробуем декодировать двумя способами:
 *    a) Низкоуровневый: getImageData → RGBLuminanceSource → BinaryBitmap → MultiFormatReader
 *    b) Высокоуровневый: canvas → blob URL → BrowserMultiFormatReader.decodeFromImageUrl
 * 3. Предобработка: контраст, бинаризация, инверсия
 */

import { useState, useRef } from 'react';
import { Camera, Loader2, RotateCcw } from 'lucide-react';
import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
} from '@zxing/library';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setError(null);

    try {
      const barcode = await decodeFromFile(file);
      if (barcode) {
        onDetected(barcode);
        setError(null);
      } else {
        setError('Штрих-код не распознан. Попробуйте сфотографировать ближе и ровнее.');
      }
    } catch {
      setError('Ошибка при обработке фото. Попробуйте ещё раз.');
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
        id="barcode-capture"
      />

      <label
        htmlFor="barcode-capture"
        className={`flex items-center justify-center gap-2 w-full h-14 rounded-xl font-medium text-sm cursor-pointer transition-colors ${
          scanning
            ? 'bg-cream text-ink-muted pointer-events-none'
            : 'bg-primary text-paper hover:bg-primary/90 active:bg-primary/80'
        }`}
      >
        {scanning ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Распознаю...
          </>
        ) : (
          <>
            <Camera size={20} />
            Сфотографировать штрих-код
          </>
        )}
      </label>

      {error && (
        <div className="flex items-start gap-2 w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <RotateCcw size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <p className="text-xs text-ink-muted text-center">
        Наведите камеру на штрих-код. Для лучшего результата держите телефон ровно и близко к упаковке.
      </p>
    </div>
  );
}

// ─── Конфигурация ZXing ─────────────────────────────────────────────────────

const HINTS = new Map();
HINTS.set(DecodeHintType.TRY_HARDER, true);
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
]);

// ─── Основная логика декодирования ──────────────────────────────────────────

async function decodeFromFile(file: File): Promise<string | null> {
  const img = await loadImage(file);

  // Стратегии обрезки и масштабирования
  const strategies = buildStrategies(img);

  for (const canvas of strategies) {
    // Попытка с оригинальным canvas
    const r1 = await tryDecodeCanvas(canvas);
    if (r1) return r1;

    // Попытка с повышенным контрастом
    const enhanced = enhanceContrast(canvas, 1.8);
    const r2 = await tryDecodeCanvas(enhanced);
    if (r2) return r2;

    // Попытка с бинаризацией (чёткий чёрно-белый)
    const bw = binarize(canvas, 128);
    const r3 = await tryDecodeCanvas(bw);
    if (r3) return r3;

    // Попытка с более высоким порогом бинаризации
    const bw2 = binarize(canvas, 100);
    const r4 = await tryDecodeCanvas(bw2);
    if (r4) return r4;
  }

  return null;
}

/**
 * Декодирует штрих-код из canvas через BrowserMultiFormatReader.
 * Использует два метода:
 * 1. canvas → Blob URL → decodeFromImageUrl (async, надёжный)
 * 2. canvas → img element → decodeFromImageElement (sync, fallback)
 */
async function tryDecodeCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const reader = new BrowserMultiFormatReader(HINTS);

    // Метод 1: Blob URL (более надёжный — не грузит огромный data URL)
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/png'
        );
      });
      const blobUrl = URL.createObjectURL(blob);
      try {
        const result = await (reader as any).decodeFromImageUrl(blobUrl);
        const text = result?.getText?.();
        if (text && text.length >= 4) return text;
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      // fallback ниже
    }

    // Метод 2: img element из data URL (fallback)
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('img load failed'));
        if (img.complete && img.naturalWidth > 0) resolve();
      });
      const result = reader.decodeFromImageElement(img);
      const text = result?.getText?.();
      if (text && text.length >= 4) return text;
    } catch {
      // не распознано
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Стратегии обрезки ──────────────────────────────────────────────────────

function buildStrategies(img: HTMLImageElement): HTMLCanvasElement[] {
  const results: HTMLCanvasElement[] = [];

  // 1. Полное изображение, нормализованное до 1280px
  results.push(scaleToWidth(img, Math.min(img.naturalWidth, 1280)));

  // 2. Полное изображение, увеличенное до 1600px (если мелкий штрих-код)
  if (img.naturalWidth < 1600) {
    results.push(scaleToWidth(img, 1600));
  }

  // 3. Центральная обрезка 60%
  results.push(cropAndScale(img, 0.2, 0.2, 0.6, 0.6, 1280));

  // 4. Горизонтальная полоса по центру (штрих-коды горизонтальные)
  results.push(cropAndScale(img, 0, 0.3, 1, 0.4, 1280));

  // 5. Нижняя часть (штрих-код часто внизу упаковки)
  results.push(cropAndScale(img, 0, 0.55, 1, 0.45, 1280));

  // 6. Верхняя часть
  results.push(cropAndScale(img, 0, 0, 1, 0.45, 1280));

  // 7. Узкая горизонтальная полоса в самом центре (20% высоты)
  results.push(cropAndScale(img, 0.1, 0.4, 0.8, 0.2, 1280));

  return results;
}

// ─── Утилиты ────────────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function scaleToWidth(img: HTMLImageElement, targetWidth: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const scale = targetWidth / img.naturalWidth;
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cropAndScale(
  img: HTMLImageElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
  targetWidth: number
): HTMLCanvasElement {
  const sx = Math.round(img.naturalWidth * xRatio);
  const sy = Math.round(img.naturalHeight * yRatio);
  const sw = Math.round(img.naturalWidth * wRatio);
  const sh = Math.round(img.naturalHeight * hRatio);

  const scale = targetWidth / sw;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function enhanceContrast(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(factor * (data[i] - 128) + 128);
    data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
    data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function binarize(source: HTMLCanvasElement, threshold: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const val = gray < threshold ? 0 : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function clamp(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}
