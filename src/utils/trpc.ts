import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../server/routers/_app";
import { clearAuth, getToken } from "./auth";

export const trpc = createTRPCReact<AppRouter>();

// Кастомный fetch — обёртка над window.fetch.
// Назначение:
//   1. Если в localStorage есть token — добавляем Authorization header
//      (читаем при КАЖДОМ запросе, а не один раз — чтобы после login
//      не нужно было пересоздавать клиент).
//   2. Если сервер ответил 401 (сессия невалидна / истекла) —
//      чистим auth и редиректим на /login. Защита от петли:
//      если уже на /login, не редиректим (иначе сам login будет
//      перезагружать страницу при ошибке).
async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(input, { ...init, headers });

  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login")
  ) {
    clearAuth();
    // Жёсткий редирект — гарантированно сбрасывает все query-кеши React Query,
    // которые могли бы продолжить рваться 401-ками.
    window.location.replace("/login");
  }

  return res;
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/trpc",
      transformer: superjson,
      fetch: fetchWithAuth,
    }),
  ],
});
