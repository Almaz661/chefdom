// Сессия в localStorage. Хранит token, который сервер выдал при auth.login.
// Токен шлётся в Authorization: Bearer <token> со всеми запросами (см. trpc.ts).
//
// 30 дней — соответствует expires_at сессии в БД. Если сервер вернёт 401
// (сессия невалидна / истекла / сменили PIN на другом устройстве) —
// клиент очистит auth и редиректнет на /login (см. trpc.ts).

const KEY = "chefdom_auth";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export interface AuthState {
  userId: number;
  name: string;
  token: string;
  expiresAt: number;
}

export function getAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    // Бэккомпат: до миграции 016 в localStorage не было token. Такие
    // «старые» сессии не пройдут проверку на сервере — лучше сразу
    // считать их невалидными и редиректнуть на /login.
    if (
      typeof parsed.userId !== "number" ||
      typeof parsed.name !== "string" ||
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      localStorage.removeItem(KEY);
      return null;
    }
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed as AuthState;
  } catch {
    return null;
  }
}

export function setAuth(userId: number, name: string, token: string): void {
  const state: AuthState = {
    userId,
    name,
    token,
    expiresAt: Date.now() + TTL_MS,
  };
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearAuth(): void {
  localStorage.removeItem(KEY);
}

export function getToken(): string | null {
  return getAuth()?.token ?? null;
}

export function isAuthenticated(): boolean {
  return getAuth() !== null;
}
