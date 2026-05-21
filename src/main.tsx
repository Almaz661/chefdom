import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "./utils/trpc";
import App from "./App";
import { ServerWakeUp } from "./components/ServerWakeUp";
import "./index.css";

// F.3 — регистрация Service Worker для offline режима.
// Дополнительно: при загрузке проверяем, нет ли «зависшего» старого кеша
// (shefdom-v1) — если есть, чистим всё и перезагружаемся один раз. Это
// освобождает пользователей, у которых браузер застрял на pre-v2 версии.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const cacheKeys = "caches" in window ? await caches.keys() : [];
      const hasOldCache = cacheKeys.includes("shefdom-v1");
      const alreadyCleaned = sessionStorage.getItem("sw-cleaned-v2") === "1";
      if (hasOldCache && !alreadyCleaned) {
        sessionStorage.setItem("sw-cleaned-v2", "1");
        // unregister все SW и удалить все cacheStorage
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
        location.reload();
        return;
      }
    } catch {
      // тихо игнорируем — не блокируем загрузку приложения
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ServerWakeUp>
            <App />
          </ServerWakeUp>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
);
