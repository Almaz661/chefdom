import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

// Глобальный стор тостов — не нужен Redux/Zustand, хватит event-based подхода
type Listener = (toasts: ToastItem[]) => void;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l([...toasts]));
}

let counter = 0;

export const toast = {
  success(message: string, duration = 4000) {
    const id = String(++counter);
    toasts = [...toasts, { id, message, type: 'success' }];
    notify();
    setTimeout(() => toast.dismiss(id), duration);
  },
  error(message: string, duration = 6000) {
    const id = String(++counter);
    toasts = [...toasts, { id, message, type: 'error' }];
    notify();
    setTimeout(() => toast.dismiss(id), duration);
  },
  info(message: string, duration = 4000) {
    const id = String(++counter);
    toasts = [...toasts, { id, message, type: 'info' }];
    notify();
    setTimeout(() => toast.dismiss(id), duration);
  },
  dismiss(id: string) {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  },
};

// Hook для подписки на тосты
function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);
  return items;
}

// Иконки по типу
const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-emerald-400 shrink-0" />,
  error:   <AlertCircle size={16} className="text-red-400 shrink-0" />,
  info:    <Info        size={16} className="text-blue-400 shrink-0" />,
};

const BG: Record<ToastType, string> = {
  success: 'bg-emerald-950/80 border-emerald-800/40',
  error:   'bg-red-950/80 border-red-800/40',
  info:    'bg-blue-950/80 border-blue-800/40',
};

// Контейнер тостов — монтируется один раз в Layout
export function ToastContainer() {
  const items = useToasts();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-white text-sm font-medium max-w-sm pointer-events-auto ${BG[item.type]}`}
        >
          {ICONS[item.type]}
          <span className="flex-1">{item.message}</span>
          <button
            onClick={() => toast.dismiss(item.id)}
            className="text-white/40 hover:text-white/80 transition-colors ml-1"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
