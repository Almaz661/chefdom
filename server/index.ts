import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { runMigrations } from "./db/migrate";
import { runSeed } from "./db/seed";
import { appRouter } from "./routers/_app";
import { createContext } from "./trpc";
import { client } from "./db/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Render проксирует запросы — чтобы req.ip отдавал реальный IP клиента,
// а не IP внутреннего прокси.
app.set("trust proxy", true);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// tRPC API
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// Health-check для Render и для проверки после деплоя.
// Проверяет не только что Express отвечает, но и что БД достижима —
// раньше Render думал «всё ок» даже когда Neon недоступен.
//
// Возвращаем ВСЕГДА 200 (а не 503 при сбое БД) намеренно:
//   - Render использует HTTP-статус для решения "rollback при failure";
//     на Render Free + Neon Free cold-start БД может занять >3с при
//     первом обращении после простоя, и 503 спровоцировал бы rollback
//     совершенно здорового деплоя.
//   - Внешние мониторинги (UptimeRobot и т.п.) умеют парсить body и
//     алертить на `db: "error"` — то что нужно для реальных алертов.
//   - При полном падении Neon Render всё равно увидит ошибки в логах
//     запросов на /trpc/* (они отвалятся 500), а не от health.
//
// SELECT 1 с таймаутом 5 секунд — Neon обычно отвечает <100мс, при
// холодном старте до 2-3с, 5с — запас.
app.get("/api/health", async (_req, res) => {
  let dbOk = false;
  let dbError: string | null = null;
  const dbStart = Date.now();
  try {
    await Promise.race([
      client`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout 5s")), 5000),
      ),
    ]);
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error(`[health] DB check failed: ${dbError}`);
  }
  const dbMs = Date.now() - dbStart;
  res.status(200).json({
    ok: true,
    service: "chefdom",
    db: dbOk ? "ok" : "error",
    dbMs,
    dbError: dbOk ? undefined : dbError,
    ts: new Date().toISOString(),
  });
});

// Middleware для админских GET-эндпоинтов (/api/seed-*, /api/calc-nutrition).
// Требует валидный Bearer-токен из таблицы sessions — так же как
// protectedProcedure в tRPC. До этого эндпоинты были полностью публичные
// и любой по URL мог запустить реселектинг USDA на ~30 минут (DoS вектор).
async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await client<{ user_id: number }[]>`
    SELECT user_id FROM sessions
    WHERE token = ${token} AND expires_at > NOW()
    LIMIT 1
  `;
  if (rows.length === 0) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Одноразовый запуск импорта ингредиентов из USDA (G.1)
app.get("/api/seed-ingredients", requireSession, async (_req, res) => {
  res.json({ ok: true, message: "Импорт запущен в фоне. Смотри логи Render." });
  setImmediate(async () => {
    try {
      const { runSeedIngredients } = await import("./db/seed-ingredients-fn");
      await runSeedIngredients();
    } catch (err) {
      console.error("[seed-ingredients] Ошибка:", err);
    }
  });
});

// Одноразовый запуск импорта товаров из Open Food Facts (G.2)
app.get("/api/seed-products", requireSession, async (_req, res) => {
  res.json({ ok: true, message: "Импорт товаров запущен в фоне. Смотри логи Render." });
  setImmediate(async () => {
    try {
      const { runSeedProducts } = await import("./db/seed-products-fn");
      await runSeedProducts();
    } catch (err) {
      console.error("[seed-products] Ошибка:", err);
    }
  });
});

// Авто-расчёт КБЖУ для всех рецептов (G.4).
// Использует общий helper calcRecipeNutrition. Best-effort:
// рецепты которые не получилось рассчитать (нет в USDA) пропускаются
// без затирания существующих значений.
//
// NB: дублирует tRPC recipes.recalcAllNutrition (там кнопка в Настройках),
// оставлен для обратной совместимости с админ-флоу через curl.
app.get("/api/calc-nutrition", requireSession, async (_req, res) => {
  res.json({ ok: true, message: "Расчёт КБЖУ запущен в фоне. Смотри логи Render." });
  setImmediate(async () => {
    try {
      const { db } = await import("./db/index");
      const { recipes } = await import("./db/schema");
      const { calcRecipeNutrition } = await import("./services/nutritionCalc");

      const allRecipes = await db.select({ id: recipes.id }).from(recipes);
      console.log(`[calc-nutrition] Рецептов для обработки: ${allRecipes.length}`);
      let updated = 0;

      for (const recipe of allRecipes) {
        try {
          const result = await calcRecipeNutrition(recipe.id);
          if (result && result.matched > 0) updated++;
        } catch (err) {
          console.warn(`[calc-nutrition] рецепт ${recipe.id}:`, err instanceof Error ? err.message : err);
        }
      }

      console.log(`[calc-nutrition] Готово. Обновлено: ${updated}/${allRecipes.length}`);
    } catch (err) {
      console.error("[calc-nutrition] Ошибка:", err);
    }
  });
});

// Раздача собранного фронта (production: dist/ создаётся командой `npm run build`).
// Локально при `npm run dev:server` dist/ может не быть — это не ошибка,
// для локальной разработки фронт запускается отдельно через `npm run dev:client`.
const distDir = path.resolve(__dirname, "../dist");
const indexHtml = path.join(distDir, "index.html");

if (fs.existsSync(indexHtml)) {
  app.use(express.static(distDir));

  // SPA fallback: всё, что не /api и не /trpc → отдаём index.html
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/trpc")) {
      return next();
    }
    res.sendFile(indexHtml);
  });
} else {
  console.log(
    "[boot] dist/ не найден — фронт не подаётся (локальная разработка?)",
  );
}

const PORT = Number(process.env.PORT) || 3000;

async function start(): Promise<void> {
  console.log("[boot] старт ШефДом!");
  console.log("[boot] запуск миграций...");
  await runMigrations();

  console.log("[boot] запуск seed...");
  await runSeed();

  // Явный bind на 0.0.0.0 — Render port-scanner иногда не видит дефолтный bind Node
  // (который может уйти на IPv6 ::1). Принуждаем все IPv4 интерфейсы.
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[boot] сервер слушает 0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[boot] фатальная ошибка при старте:", err);
  process.exit(1);
});
