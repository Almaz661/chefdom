import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { runMigrations } from "./db/migrate";
import { runSeed } from "./db/seed";
import { appRouter } from "./routers/_app";
import { createContext } from "./trpc";

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

// Health-check для Render и для проверки после деплоя
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "chefdom",
    ts: new Date().toISOString(),
  });
});

// Одноразовый запуск импорта ингредиентов из USDA (G.1)
app.get("/api/seed-ingredients", async (req, res) => {
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
app.get("/api/seed-products", async (req, res) => {
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

// Авто-расчёт КБЖУ для всех рецептов (G.4)
app.get("/api/calc-nutrition", async (req, res) => {
  res.json({ ok: true, message: "Расчёт КБЖУ запущен в фоне. Смотри логи Render." });
  setImmediate(async () => {
    try {
      const { db } = await import("./db/index");
      const { recipes, recipeIngredients, ingredients } = await import("./db/schema");
      const { eq, ilike, sql } = await import("drizzle-orm");

      const allRecipes = await db.select({ id: recipes.id, servings: recipes.servings }).from(recipes);
      console.log(`[calc-nutrition] Рецептов для обработки: ${allRecipes.length}`);
      let updated = 0;

      for (const recipe of allRecipes) {
        const ings = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipe.id));
        let kcal = 0, protein = 0, fats = 0, carbs = 0, matched = 0;

        for (const ing of ings) {
          const [found] = await db.select().from(ingredients).where(ilike(ingredients.nameRu, `%${ing.name}%`)).limit(1);
          if (!found) continue;
          const amount = ing.amount ? parseFloat(ing.amount) : 100;
          const f = amount / 100;
          kcal += found.kcalPer100g ? parseFloat(found.kcalPer100g) * f : 0;
          protein += found.proteinG ? parseFloat(found.proteinG) * f : 0;
          fats += found.fatsG ? parseFloat(found.fatsG) * f : 0;
          carbs += found.carbsG ? parseFloat(found.carbsG) * f : 0;
          matched++;
        }

        if (matched === 0) continue;
        const s = recipe.servings || 1;
        await db.execute(sql`UPDATE recipes SET calories=${Math.round(kcal/s)}, protein_g=${Math.round(protein/s*10)/10}, fats_g=${Math.round(fats/s*10)/10}, carbs_g=${Math.round(carbs/s*10)/10} WHERE id=${recipe.id}`);
        updated++;
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
