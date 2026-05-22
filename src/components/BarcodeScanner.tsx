import { useEffect, useRef, useState } from "react";
import { X, Camera as CameraIcon, RotateCw } from "lucide-react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

// G.19 — компонент сканирования штрих-кодов через камеру.
// Использует @zxing/library (работает на iOS Safari, в отличие от
// нативного BarcodeDetector). Запрашивает заднюю камеру (environment).
//
// Требования:
//  - HTTPS (Render даёт автоматически)
//  - разрешение пользователя на камеру (запрашивается при mount)
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [status, setStatus] = useState<"loading" | "scanning" | "denied" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    async function start() {
      try {
        // На iOS Safari listVideoInputDevices() не работает без
        // предварительного getUserMedia (браузер не показывает камеры
        // пока пользователь не дал разрешение). Поэтому сначала
        // запрашиваем стрим, потом перечисляем устройства.
        const preStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        // Останавливаем превью-стрим — ZXing создаст свой
        preStream.getTracks().forEach((t) => t.stop());

        const devices = await reader.listVideoInputDevices();
        // Предпочитаем заднюю камеру (на телефонах) — обычно в label слово "back"
        const back = devices.find((d) => /back|rear|environment/i.test(d.label));
        const deviceId = back?.deviceId ?? devices[0]?.deviceId;

        if (!deviceId) {
          setStatus("error");
          setErrorMessage("Камера не найдена. Проверьте что у устройства есть камера и разрешение выдано.");
          return;
        }

        if (stopped) return;
        setStatus("scanning");

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result, err) => {
            if (stopped) return;
            if (result) {
              const text = result.getText();
              if (text) {
                onDetected(text);
              }
            } else if (err && !(err instanceof NotFoundException)) {
              // NotFoundException бросается каждый кадр когда ничего не найдено,
              // это ОК. Только реальные ошибки логируем.
              // Молчим — иначе спам.
            }
          },
        );
      } catch (err) {
        if (stopped) return;
        const msg = err instanceof Error ? err.message : "Не удалось включить камеру";
        if (
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
        ) {
          setStatus("denied");
          setErrorMessage("Доступ к камере запрещён. Разрешите в настройках браузера.");
        } else {
          setStatus("error");
          setErrorMessage(msg);
        }
      }
    }

    start();

    return () => {
      stopped = true;
      try {
        reader.reset();
      } catch {}
    };
  }, [onDetected]);

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col z-50"
      role="dialog"
      aria-label="Сканирование штрих-кода"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-paper border-b border-line">
        <h3 className="font-serif text-lg font-semibold text-ink inline-flex items-center gap-2">
          <CameraIcon size={18} /> Наведи на штрих-код
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="w-10 h-10 rounded-lg text-ink-soft hover:bg-cream flex items-center justify-center"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          className="max-w-full max-h-full"
          playsInline
          muted
        />
        {/* Прицельная рамка */}
        {status === "scanning" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-3/4 max-w-md aspect-[3/2] border-2 border-primary rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </div>
        )}

        {(status === "loading" || status === "denied" || status === "error") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
            <div className="bg-paper rounded-2xl p-6 max-w-sm w-full text-center">
              {status === "loading" && (
                <>
                  <RotateCw
                    size={32}
                    className="text-primary mx-auto mb-3 animate-spin"
                    strokeWidth={2}
                  />
                  <p className="text-ink-soft">Запускаю камеру…</p>
                </>
              )}
              {status === "denied" && (
                <>
                  <p className="font-serif text-lg font-semibold text-ink mb-2">
                    Нет доступа к камере
                  </p>
                  <p className="text-ink-soft text-sm mb-4">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 h-11 rounded-lg bg-primary text-paper font-medium"
                  >
                    Закрыть
                  </button>
                </>
              )}
              {status === "error" && (
                <>
                  <p className="font-serif text-lg font-semibold text-ink mb-2">
                    Ошибка камеры
                  </p>
                  <p className="text-ink-soft text-sm mb-4">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 h-11 rounded-lg bg-primary text-paper font-medium"
                  >
                    Закрыть
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-paper text-xs text-center py-3 bg-black/80">
        Камера автоматически распознаёт штрих-код. Закрой окно после считывания.
      </p>
    </div>
  );
}
