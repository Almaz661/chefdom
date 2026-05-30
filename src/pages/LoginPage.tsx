import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Delete } from "lucide-react";
import { trpc } from "../utils/trpc";
import { setAuth, isAuthenticated } from "../utils/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      <div className="w-full max-w-[280px]">
        {/* Brand */}
        <h1 className="font-serif text-3xl font-semibold text-primary text-center mb-1 tracking-wide">
          ШефДом
        </h1>
        <p className="text-ink-muted text-xs text-center mb-12 uppercase tracking-[0.2em]">
          Введите PIN
        </p>

        {/* PIN dots */}
        <div className="flex justify-center gap-5 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                pin.length > i ? "bg-primary" : "bg-line-strong"
              }`}
            />
          ))}
        </div>

        {/* Error */}
        <div className="min-h-[20px] mb-6">
          {error && (
            <p className="text-alert text-xs text-center">{error}</p>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(String(d))}
              disabled={login.isPending}
              className="h-14 rounded-lg bg-surface-elevated border border-line text-xl font-serif text-ink hover:border-primary/40 hover:text-primary active:scale-95 transition-all disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => press("0")}
            disabled={login.isPending}
            className="h-14 rounded-lg bg-surface-elevated border border-line text-xl font-serif text-ink hover:border-primary/40 hover:text-primary active:scale-95 transition-all disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            onClick={erase}
            disabled={login.isPending || pin.length === 0}
            className="h-14 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink active:scale-95 transition-all disabled:opacity-20"
            aria-label="Стереть"
          >
            <Delete size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
