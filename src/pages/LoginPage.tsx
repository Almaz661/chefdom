import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Delete } from "lucide-react";
import { trpc } from "../utils/trpc";
import { setAuth, isAuthenticated } from "../utils/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Если уже авторизована — сразу на главную
  useEffect(() => {
    if (isAuthenticated()) navigate("/", { replace: true });
  }, [navigate]);

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setAuth(data.userId, data.name, data.token);
      navigate("/", { replace: true });
    },
    onError: (err) => {
      setError(err.message);
      setPin("");
    },
  });

  const submit = (fullPin: string) => {
    setError(null);
    login.mutate({ pin: fullPin });
  };

  const press = (digit: string) => {
    if (login.isPending) return;
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) submit(next);
  };

  const erase = () => {
    if (login.isPending) return;
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-6">
      <div className="w-full max-w-xs">
        <h1 className="font-serif text-4xl font-semibold text-primary text-center mb-2 tracking-wide">
          ШефДом
        </h1>
        <p className="text-ink-muted text-center text-sm mb-10 tracking-wider uppercase">Введите PIN-код</p>

        {/* Точки PIN-кода */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                pin.length > i
                  ? "bg-primary"
                  : "bg-line-strong"
              }`}
            />
          ))}
        </div>

        {/* Сообщение об ошибке (минимум занимает место — не прыгает layout) */}
        <div className="min-h-[24px] mb-4">
          {error && (
            <p className="text-alert text-sm text-center font-medium">
              {error}
            </p>
          )}
        </div>

        {/* Клавиатура 3×4 */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(String(d))}
              disabled={login.isPending}
              className="h-16 rounded-xl bg-surface-elevated border border-line text-2xl font-serif font-medium text-ink hover:border-primary/40 hover:text-primary active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => press("0")}
            disabled={login.isPending}
            className="h-16 rounded-xl bg-surface-elevated border border-line text-2xl font-serif font-medium text-ink hover:border-primary/40 hover:text-primary active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            type="button"
            onClick={erase}
            disabled={login.isPending || pin.length === 0}
            className="h-16 rounded-xl flex items-center justify-center text-ink-muted hover:bg-paper hover:border-line border border-transparent active:scale-95 transition-all disabled:opacity-30"
            aria-label="Стереть"
          >
            <Delete size={24} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
