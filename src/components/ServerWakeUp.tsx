import { useEffect, useState, ReactNode } from "react";
import { Loader2, RefreshCw, ChefHat } from "lucide-react";
import { trpc } from "../utils/trpc";

// Показывает «Сервер просыпается...» если сервер не отвечает дольше 3 секунд.
// Кнопка «Обновить страницу» появляется если ждёт больше 90 секунд.
// По плану раздел 16.2.

export function ServerWakeUp({ children }: { children: ReactNode }) {
  const [slow, setSlow] = useState(false);
  const [veryLong, setVeryLong] = useState(false);
  const [startTime] = useState(() => Date.now());

  const health = trpc.auth.getUser.useQuery(
    { userId: 1 },
    {
      retry: 20,
      retryDelay: 3000,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    // Через 3 секунды — показываем «просыпается»
    const t1 = setTimeout(() => {
      if (health.isLoading) setSlow(true);
    }, 3000);

    // Через 90 секунд — показываем кнопку «Обновить»
    const t2 = setTimeout(() => {
      if (health.isLoading) setVeryLong(true);
    }, 90000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Как только сервер ответил — убираем экран ожидания
  if (!health.isLoading || health.isSuccess || health.isError) {
    return <>{children}</>;
  }

  if (!slow) {
    // Первые 3 секунды — ничего не показываем, обычная загрузка
    return <>{children}</>;
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-8 text-center">
      <ChefHat size={56} className="text-primary mb-6" strokeWidth={1.5} />
      <Loader2 size={32} className="animate-spin text-primary mb-4" />
      <p className="font-serif text-xl text-ink mb-2">
        Сервер просыпается...
      </p>
      <p className="text-ink-muted text-sm mb-6">
        Подождите 30–60 секунд. Прошло: {elapsed} сек.
      </p>
      {veryLong && (
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 h-12 px-6 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors"
        >
          <RefreshCw size={18} />
          Обновить страницу
        </button>
      )}
    </div>
  );
}
