import * as cheerio from "cheerio";
import { nanoid } from "nanoid";
import { scrapeRecipe } from "./recipeScraper";
import { db } from "../db/index";
import { recipes, recipeIngredients, recipeSteps } from "../db/schema";
import { eq } from "drizzle-orm";

// --- Types ---

export interface ImportJob {
  id: string;
  seedUrl: string;
  status: "running" | "done" | "cancelled" | "error";
  total: number;
  processed: number;
  success: number;
  skipped: number;
  failed: number;
  currentTitle: string | null;
  currentUrl: string | null;
  errors: { url: string; message: string }[];
  cancelled: boolean;
}

// --- In-memory state (один job одновременно) ---

let activeJob: ImportJob | null = null;

const FETCH_TIMEOUT_MS = 15_000;
const THROTTLE_MS = 2_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Blocklist URL-сегментов — не рецепты
const URL_BLOCKLIST = [
  "/wp-",
  "/feed",
  "/tag/",
  "/category/",
  "/page/",
  "/author/",
  "/search",
  "/admin",
  "/cart",
  "/policy",
  "/terms",
  "/login",
  "/register",
  "/comment",
  "/reply",
  "#",
];

// --- Public API ---

export function getActiveJob(): ImportJob | null {
  return activeJob;
}

export function cancelActiveJob(): boolean {
  if (!activeJob || activeJob.status !== "running") return false;
  activeJob.cancelled = true;
  activeJob.status = "cancelled";
  return true;
}

export function startSectionImport(seedUrl: string): ImportJob {
  if (activeJob && activeJob.status === "running") {
    throw new Error("Дождитесь завершения текущего импорта.");
  }

  const job: ImportJob = {
    id: nanoid(12),
    seedUrl,
    status: "running",
    total: 0,
    processed: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    currentTitle: null,
    currentUrl: null,
    errors: [],
    cancelled: false,
  };
  activeJob = job;

  // Запускаем асинхронно — не блокируем ответ клиенту
  runImport(job).catch((err) => {
    job.status = "error";
    job.errors.push({ url: seedUrl, message: String(err) });
  });

  return job;
}

// --- Import runner ---

async function runImport(job: ImportJob): Promise<void> {
  let parsedSeed: URL;
  try {
    parsedSeed = new URL(job.seedUrl);
  } catch {
    job.status = "error";
    job.errors.push({ url: job.seedUrl, message: "Некорректный URL раздела" });
    return;
  }

  const hostname = parsedSeed.hostname;
  const seedPath = parsedSeed.pathname.replace(/\/$/, "");

  // Категория из URL раздела (например /desserts/ → "Десерты")
  const sectionCategory = guessSectionCategory(seedPath);

  // Собираем URL рецептов со всех страниц пагинации
  const recipeUrls = new Set<string>();
  let pageNum = 1;
  const maxPages = 300; // safety limit (поддержка больших разделов)

  // Определяем работающий формат пагинации (пробуем разные варианты)
  let workingFormat: PageFormat | null = null;

  while (pageNum <= maxPages) {
    if (job.cancelled) return;

    let html: string | null = null;

    if (pageNum === 1) {
      try {
        html = await fetchHtml(job.seedUrl);
      } catch {
        break;
      }
    } else {
      // Если формат уже найден — используем его
      if (workingFormat) {
        const pageUrl = buildPageUrl(job.seedUrl, pageNum, workingFormat);
        try {
          html = await fetchHtml(pageUrl);
        } catch {
          break;
        }
      } else {
        // Пробуем все форматы пагинации, выбираем тот что вернул новые ссылки
        const formats: PageFormat[] = ["query-page", "slash-num", "num-html", "wordpress"];
        for (const fmt of formats) {
          const tryUrl = buildPageUrl(job.seedUrl, pageNum, fmt);
          try {
            const tryHtml = await fetchHtml(tryUrl);
            const $try = cheerio.load(tryHtml);
            const tryLinks = discoverRecipeLinks($try, hostname, seedPath);
            // Если есть НОВЫЕ ссылки которых нет на первой странице — формат рабочий
            const newLinks = tryLinks.filter((l) => !recipeUrls.has(l));
            if (newLinks.length > 0) {
              html = tryHtml;
              workingFormat = fmt;
              console.log(`[sectionImport] ${job.id}: формат пагинации = ${fmt}`);
              break;
            }
          } catch {
            // не тот формат, пробуем следующий
          }
        }
        if (!html) break; // ни один формат не сработал
      }
    }

    const $ = cheerio.load(html);
    const links = discoverRecipeLinks($, hostname, seedPath);

    if (links.length === 0) break;

    let newCount = 0;
    for (const link of links) {
      if (!recipeUrls.has(link)) {
        recipeUrls.add(link);
        newCount++;
      }
    }

    if (newCount === 0) break;

    pageNum++;
  }

  job.total = recipeUrls.size;
  console.log(
    `[sectionImport] ${job.id}: найдено ${job.total} URL на ${pageNum} стр.`,
  );

  // Логируем первые 10
  const first10 = [...recipeUrls].slice(0, 10);
  for (const u of first10) {
    console.log(`[sectionImport]   ${u}`);
  }

  // Импортируем по одному с throttle
  for (const url of recipeUrls) {
    if (job.cancelled) return;

    job.currentUrl = url;
    job.currentTitle = null;

    // Дедуп: проверить source_url в БД
    const existing = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.sourceUrl, url))
      .limit(1);

    if (existing.length > 0) {
      job.skipped++;
      job.processed++;
      continue;
    }

    try {
      const scraped = await scrapeRecipe(url);
      job.currentTitle = scraped.title;

      // Если категория из URL раздела известна — используем её,
      // иначе оставляем то что определил scrapeRecipe (по названию)
      const finalCategory = sectionCategory ?? scraped.category;

      await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(recipes)
          .values({
            title: scraped.title,
            description: scraped.description,
            imageUrl: scraped.imageUrl,
            servings: scraped.servings,
            prepTime: scraped.prepTime,
            cookTime: scraped.cookTime,
            totalTime: scraped.totalTime,
            sourceUrl: scraped.sourceUrl,
            source: scraped.source,
            category: finalCategory,
            cuisine: scraped.cuisine,
            difficulty: scraped.difficulty,
            calories: scraped.calories,
          })
          .returning({ id: recipes.id });

        if (scraped.ingredients.length > 0) {
          await tx.insert(recipeIngredients).values(
            scraped.ingredients.map((ing, idx) => ({
              recipeId: created.id,
              name: ing.name,
              amount: ing.amount !== null ? String(ing.amount) : null,
              unit: ing.unit,
              groupName: ing.groupName,
              sortOrder: idx,
            })),
          );
        }

        if (scraped.steps.length > 0) {
          await tx.insert(recipeSteps).values(
            scraped.steps.map((s, idx) => ({
              recipeId: created.id,
              stepNumber: idx + 1,
              instruction: s.instruction,
              imageUrl: s.imageUrl,
              timerMinutes: s.timerMinutes,
            })),
          );
        }
      });

      job.success++;
    } catch (err) {
      job.failed++;
      job.errors.push({
        url,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    job.processed++;

    // Throttle — не бомбить сайт
    await sleep(THROTTLE_MS);
  }

  if (!job.cancelled) {
    job.status = "done";
  }
  job.currentUrl = null;
  job.currentTitle = null;
  console.log(
    `[sectionImport] ${job.id}: завершено. success=${job.success} skipped=${job.skipped} failed=${job.failed}`,
  );
}

// --- Discovery ---

function discoverRecipeLinks(
  $: cheerio.CheerioAPI,
  hostname: string,
  seedPath: string,
): string[] {
  // Удаляем chrome ДО поиска ссылок
  $(
    "nav, header, footer, aside, .sidebar, .widget, .menu, .breadcrumbs, .related-posts, .popular-posts, script, style, noscript",
  ).remove();

  const urls: string[] = [];
  const seen = new Set<string>();

  // Стратегия 1: <article> → первая ссылка с заголовка
  $("article").each((_, article) => {
    const link = $(article).find("h1 a, h2 a, h3 a").first().attr("href");
    if (link) tryAdd(link, urls, seen, hostname, seedPath);
  });

  // Стратегия 2: fallback на классы
  if (urls.length === 0) {
    $(
      '.post a, .recipe-card a, .card a, [class*="recipe-"] a, [class*="post-"] a',
    ).each((_, el) => {
      const link = $(el).attr("href");
      if (link) tryAdd(link, urls, seen, hostname, seedPath);
    });
  }

  // Стратегия 3: heading-links в content area
  if (urls.length === 0) {
    $("h2 a, h3 a").each((_, el) => {
      const link = $(el).attr("href");
      if (link) tryAdd(link, urls, seen, hostname, seedPath);
    });
  }

  // Стратегия 4 (универсальная): собираем ВСЕ ссылки на странице,
  // отфильтровываем через tryAdd. Работает для сайтов где нет
  // article/post-классов (povar.ru, gastronom.ru и т.п.)
  if (urls.length === 0) {
    $("a[href]").each((_, el) => {
      const link = $(el).attr("href");
      if (link) tryAdd(link, urls, seen, hostname, seedPath);
    });
  }

  return urls;
}

function tryAdd(
  rawHref: string,
  urls: string[],
  seen: Set<string>,
  hostname: string,
  seedPath: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(rawHref, `https://${hostname}`);
  } catch {
    return;
  }

  const href = parsed.href;
  if (seen.has(href)) return;

  // Тот же hostname
  if (parsed.hostname !== hostname && parsed.hostname !== `www.${hostname}`) {
    return;
  }

  const path = parsed.pathname.replace(/\/$/, "");

  // Не blocklist
  for (const bl of URL_BLOCKLIST) {
    if (path.includes(bl) || href.includes(bl)) return;
  }

  // Не seed сам
  if (path === seedPath) return;

  // Не родитель seed-пути
  if (seedPath.startsWith(path + "/") && path !== "") return;

  // Не сиблинг (та же глубина что seed, другой last segment)
  const seedParts = seedPath.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (
    pathParts.length === seedParts.length &&
    pathParts.length > 1 &&
    pathParts.slice(0, -1).join("/") === seedParts.slice(0, -1).join("/") &&
    pathParts[pathParts.length - 1] !== seedParts[seedParts.length - 1]
  ) {
    // Это может быть сиблинг (другой раздел) ИЛИ рецепт.
    // Пропускаем только если last segment короткий (категория).
    const lastSeg = pathParts[pathParts.length - 1];
    if (lastSeg.length < 4) return;
  }

  // Last segment ≥ 4 символа, содержит буквы
  const lastSeg = pathParts[pathParts.length - 1] || "";
  if (lastSeg.length < 4) return;
  if (!/[a-zA-Zа-яА-Я]/.test(lastSeg)) return;

  seen.add(href);
  urls.push(href);
}

// --- Pagination ---

type PageFormat = "wordpress" | "query-page" | "slash-num" | "num-html";

function buildPageUrl(seedUrl: string, page: number, format: PageFormat): string {
  const parsed = new URL(seedUrl);
  const path = parsed.pathname.replace(/\/$/, "");

  switch (format) {
    case "query-page":
      // ?page=N
      parsed.searchParams.set("page", String(page));
      return parsed.href;
    case "slash-num":
      // /list/desert/2/  (povar.ru, gastronom.ru)
      parsed.pathname = `${path}/${page}/`;
      return parsed.href;
    case "num-html":
      // /recipes/desert/2.html
      parsed.pathname = `${path}/${page}.html`;
      return parsed.href;
    case "wordpress":
    default:
      // /category/page/2/
      parsed.pathname = `${path}/page/${page}/`;
      return parsed.href;
  }
}

// Угадывает категорию из URL раздела
function guessSectionCategory(seedPath: string): string | null {
  const lower = seedPath.toLowerCase();
  const rules: [RegExp, string][] = [
    [/desert|dessert|десерт|sweet|sladk/i, "Десерты"],
    [/sup|soup|суп|borsh|борщ/i, "Супы"],
    [/salat|salad|салат/i, "Салаты"],
    [/zavtrak|breakfast|завтрак/i, "Завтраки"],
    [/vipech|выпечк|baking|cakes|tort|тортов|pirog|пирог/i, "Выпечка"],
    [/napitk|drink|напитки|beverag|cocktail|коктейл/i, "Напитки"],
    [/zakusk|appetizer|закуск|starter/i, "Закуски"],
    [/zagotovk|preserv|заготовк|варенье|jam/i, "Заготовки"],
    [/sous|sauce|соус|маринад|marinad/i, "Соусы"],
    [/garnir|side|гарнир/i, "Гарниры"],
    [/myaso|meat|мясо|kuric|курица|chicken|svinin|свинин|govjadin|говядин/i, "Мясо"],
    [/riba|fish|рыба|seafood|moreprodukt|морепродукт/i, "Рыба"],
    [/vtoroe|main|основн|hot|горячее/i, "Основные блюда"],
  ];
  for (const [re, cat] of rules) {
    if (re.test(lower)) return cat;
  }
  return null;
}

// --- Helpers ---

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
