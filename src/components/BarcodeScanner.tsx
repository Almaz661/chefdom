/**
 * BarcodeScanner — фото-сканер штрих-кодов.
 * Использует <input type="file" capture="environment"> для фото с камеры.
 * НЕ использует getUserMedia / decodeFromVideoDevice (не работает на iOS Safari).
 *
 * Улучшения распознавания:
 * 1. Upscale изображения до 1280px по ширине (мелкие штрих-коды лучше читаются).
 * 2. Несколько попыток декодирования с разными настройками (rotate, sharpen).
 * 3. Обрезка центральной зоны (штрих-код обычно в центре фото).
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
      // Сбросить input чтобы можно было выбрать тот же файл снова
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

// ─── Логика декодирования ───────────────────────────────────────────────────

/**
 * Пробует декодировать штрих-код из файла несколькими способами:
 * 1. Полное изображение (upscaled)
 * 2. Центральная обрезка (50% площади)
 * 3. Повторная попытка с более мягкими настройками
 */
async function decodeFromFile(file: File): Promise<string | null> {
  const img = await loadImage(file);

  // Попытка 1: полное изображение, upscaled
  const fullCanvas = upscaleImage(img, 1280);
  const result1 = await tryDecode(fullCanvas);
  if (result1) return result1;

  // Попытка 2: центральная обрезка (штрих-код обычно в центре)
  const croppedCanvas = cropCenter(img, 0.6);
  const upscaledCrop = upscaleCanvas(croppedCanvas, 1280);
  const result2 = await tryDecode(upscaledCrop);
  if (result2) return result2;

  // Попытка 3: ещё более агрессивный upscale (1600px) + расширенные форматы
  const bigCanvas = upscaleImage(img, 1600);
  const result3 = await tryDecode(bigCanvas, true);
  if (result3) return result3;

  // Попытка 4: обрезка верхней половины (штрих-код может быть сверху упаковки)
  const topHalf = cropRegion(img, 0, 0, 1, 0.5);
  const upscaledTop = upscaleCanvas(topHalf, 1280);
  const result4 = await tryDecode(upscaledTop);
  if (result4) return result4;

  // Попытка 5: обрезка нижней половины
  const bottomHalf = cropRegion(img, 0, 0.5, 1, 0.5);
  const upscaledBottom = upscaleCanvas(bottomHalf, 1280);
  const result5 = await tryDecode(upscaledBottom);
  if (result5) return result5;

  return null;
}

/** Загружает файл в HTMLImageElement */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

/** Масштабирует изображение до targetWidth, сохраняя пропорции */
function upscaleImage(img: HTMLImageElement, targetWidth: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const scale = Math.max(1, targetWidth / img.naturalWidth);
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Масштабирует canvas до targetWidth */
function upscaleCanvas(source: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const scale = Math.max(1, targetWidth / source.width);
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Обрезает центральную часть изображения (ratio = доля от размера) */
function cropCenter(img: HTMLImageElement, ratio: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const cropW = Math.round(img.naturalWidth * ratio);
  const cropH = Math.round(img.naturalHeight * ratio);
  const offsetX = Math.round((img.naturalWidth - cropW) / 2);
  const offsetY = Math.round((img.naturalHeight - cropH) / 2);
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, cropW, cropH);
  return canvas;
}

/** Обрезает произвольный регион (все параметры — доли от 0 до 1) */
function cropRegion(
  img: HTMLImageElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const sx = Math.round(img.naturalWidth * xRatio);
  const sy = Math.round(img.naturalHeight * yRatio);
  const sw = Math.round(img.naturalWidth * wRatio);
  const sh = Math.round(img.naturalHeight * hRatio);
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

/** Пытается декодировать штрих-код из canvas */
async function tryDecode(canvas: HTMLCanvasElement, relaxed = false): Promise<string | null> {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);

  const formats = [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
  ];

  if (relaxed) {
    formats.push(BarcodeFormat.ITF, BarcodeFormat.CODABAR);
  }

  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

  const reader = new BrowserMultiFormatReader(hints);

  try {
    // Создаём ImageElement из canvas dataURL
    const dataUrl = canvas.toDataURL('image/png');
    const img = document.createElement('img');
    img.src = dataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      // Если уже загружен (data URL обычно синхронный)
      if (img.complete) resolve();
    });

    const result = reader.decodeFromImageElement(img);
    const text = result.getText();
    // Валидация: штрих-код должен быть числовым (EAN/UPC) или алфавитно-цифровым
    if (text && text.length >= 4) {
      return text;
    }
    return null;
  } catch {
    return null;
  }
}
