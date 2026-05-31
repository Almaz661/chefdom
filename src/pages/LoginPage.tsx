import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Delete, ChefHat } from "lucide-react";
import { trpc } from "../utils/trpc";
import { setAuth, isAuthenticated } from "../utils/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (isAuthenticated()) navigate("/", { replace: true }); }, [navigate]);

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => { setAuth(data.userId, data.name, data.token); navigate("/", { replace: true }); },
    onError: (err) => { setError(err.message); setPin(""); },
  });

  const submit = (p: string) => { setError(null); login.mutate({ pin: p }); };
  const press = (d: string) => { if (login.isPending || pin.length >= 4) return; const n = pin + d; setPin(n); if (n.length === 4) submit(n); };
  const erase = () => { if (login.isPending) return; setPin(p => p.slice(0, -1)); setError(null); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#0a0e27' }}>
      <div className="w-full max-w-[280px]">
        <div className="flex flex-col items-center mb-14">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(212,165,116,0.1)' }}>
            <ChefHat size={26} className="text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold text-primary tracking-wide">ШефДом</h1>
          <p className="text-ink-muted text-[11px] mt-2 uppercase tracking-[0.25em]">Введите PIN</p>
        </div>

        <div className="flex justify-center gap-5 mb-8">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${pin.length > i ? "bg-primary shadow-[0_0_8px_rgba(212,165,116,0.5)]" : ""}`}
              style={pin.length <= i ? { background: '#2d3548' } : {}} />
          ))}
        </div>

        <div className="min-h-[20px] mb-6">
          {error && <p className="text-alert text-xs text-center">{error}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <button key={d} onClick={() => press(String(d))} disabled={login.isPending}
              className="h-[56px] rounded-xl text-xl font-medium text-ink hover:text-primary hover:border-primary/40 active:scale-[0.96] transition-all disabled:opacity-40"
              style={{ background: '#1a1f3a', border: '1px solid #2d3548' }}>
              {d}
            </button>
          ))}
          <div />
          <button onClick={() => press("0")} disabled={login.isPending}
            className="h-[56px] rounded-xl text-xl font-medium text-ink hover:text-primary hover:border-primary/40 active:scale-[0.96] transition-all disabled:opacity-40"
            style={{ background: '#1a1f3a', border: '1px solid #2d3548' }}>0</button>
          <button onClick={erase} disabled={login.isPending || pin.length === 0}
            className="h-[56px] rounded-xl flex items-center justify-center text-ink-muted hover:text-ink active:scale-[0.96] transition-all disabled:opacity-20">
            <Delete size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
