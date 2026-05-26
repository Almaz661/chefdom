import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "./utils/trpc";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ServerWakeUp } from "./components/ServerWakeUp";
import "./index.css";

// F.3 — регистрация Service Worker для offline режима.
// __BUILD_TIMESTAMP__ подставляется Vite при билде (define в vite.config.ts).
// Используем его как версию кеша — при каждом деплое timestamp меняется,
// что инвалидирует старые кеши автоматически.
declare const __BUILD_TIMESTAMP__: string;
const CURRENT_CACHE_VERSION = `shefdom-v${__BUILD_TIMESTAMP__}`;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const cacheKeys = "caches" in window ? await caches.keys() : [];
      const hasCurrentCache = cacheKeys.includes(CURRENT_CACHE_VERSION);
      const hasAnyOldCache = cacheKeys.some((k) => k !== CURRENT_CACHE_VERSION && k.startsWith("shefdom-"));
      const alreadyCleaned = sessionStorage.getItem(`sw-cleaned-${CURRENT_CACHE_VERSION}`) === "1";
      if (hasAnyOldCache && !hasCurrentCache && !alreadyCleaned) {
        sessionStorage.setItem(`sw-cleaned-${CURRENT_CACHE_VERSION}`, "1");
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
          <ErrorBoundary>
            <ServerWakeUp>
              <App />
            </ServerWakeUp>
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
);
