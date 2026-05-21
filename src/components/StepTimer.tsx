import { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";

// F.2 — таймер для шага рецепта с Web Notifications
// При истечении показывает браузерное уведомление

interface StepTimerProps {
  minutes: number;
  stepNumber: number;
  recipeName?: string;
}

export function StepTimer({ minutes, stepNumber, recipeName }: StepTimerProps) {
  const totalSeconds = minutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const sendNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("⏱ Таймер завершён!", {
        body: `Шаг ${stepNumber}${recipeName ? ` — ${recipeName}` : ""}: ${minutes} мин истекло`,
        icon: "/favicon.svg",
      });
    }
  };

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            setFinished(true);
            sendNotification();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const toggle = async () => {
    if (!running) await requestNotificationPermission();
    if (finished) {
      setFinished(false);
      setRemaining(totalSeconds);
    }
    setRunning(!running);
  };

  const reset = () => {
    setRunning(false);
    setFinished(false);
    setRemaining(totalSeconds);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = ((totalSeconds - remaining) / totalSeconds) * 100;

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors ${
      finished ? "bg-green-50 border-green-200"
        : running ? "bg-primary-light border-primary"
        : "bg-cream border-line"
    }`}>
      <Timer size={16} className={finished ? "text-green-600" : running ? "text-primary" : "text-ink-muted"} />
      <div className="flex flex-col gap-0.5">
        <span className={`text-sm font-medium tabular-nums ${finished ? "text-green-700" : "text-ink"}`}>
          {finished ? "Готово!" : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
        </span>
        {running && (
          <div className="w-16 h-1 bg-paper rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <button
          onClick={toggle}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            running ? "bg-primary text-paper" : "bg-paper border border-line text-ink-soft hover:text-primary"
          }`}
          aria-label={running ? "Пауза" : "Старт"}
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
        </button>
        {(running || finished || remaining < totalSeconds) && (
          <button
            onClick={reset}
            className="w-7 h-7 rounded-lg bg-paper border border-line text-ink-soft hover:text-ink flex items-center justify-center"
            aria-label="Сбросить"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
