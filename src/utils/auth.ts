// Сессия в localStorage. 30 дней без серверной валидации (домашнее приложение,
// валидацию подключим в Блоке 13 при смене PIN).

const KEY = "chefdom_auth";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export interface AuthState {
  userId: number;
  name: string;
  expiresAt: number;
}

export function getAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setAuth(userId: number, name: string): void {
  const state: AuthState = {
    userId,
    name,
    expiresAt: Date.now() + TTL_MS,
  };
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearAuth(): void {
  localStorage.removeItem(KEY);
}

export function isAuthenticated(): boolean {
  return getAuth() !== null;
}
