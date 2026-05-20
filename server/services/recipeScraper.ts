import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import { Buffer } from "node:buffer";

// Парсер рецепта по URL. 4 стратегии в порядке убывания надёжности:
// 1. JSON-LD Schema.org — современный стандарт, ~80% сайтов
// 2. Сайт-специфика (menunedeli.ru) — для сайтов с неполным JSON-LD
// 3. Microdata (itemtype="schema.org/Recipe") — старый стандарт
// 4. Generic fallback — title + og:image, без ингредиентов и шагов

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface ScrapedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  groupName: string | null;
}

export interface ScrapedStep {
  instruction: string;
  imageUrl: string | null;
  timerMinutes: number | null;
}

export interface ScrapedRecipe {
  title: string;
  description: string | null;
  imageUrl: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  sourceUrl: string;
  source: string;
  category: string | null;
  cuisine: string | null;
  difficulty: string | null;
  calories: number | null;
  ingredients: ScrapedIngredient[];
  steps: ScrapedStep[];
}

export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Некорректный URL");
  }

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const sourceUrl = url;
  const source = parsedUrl.hostname.replace(/^www\./, "");

  // Стратегия 1: JSON-LD
  const jsonLd = parseJsonLd($, url);
  if (jsonLd && isValidRecipe(jsonLd)) {
    return finalize(jsonLd, sourceUrl, source);
  }

  // Стратегия 2: сайт-специфика
  if (source.includes("menunedeli.ru")) {
    const menu = parseMenunedeli($, url);
    if (menu && isValidRecipe(menu)) {
      return finalize(menu, sourceUrl, source);
    }
  }

  // Стратегия 3: microdata
  const micro = parseMicrodata($, url);
  if (micro && isValidRecipe(micro)) {
    return finalize(micro, sourceUrl, source);
  }

  // Стратегия 4: generic fallback (минимум — title + image)
  const generic = parseGeneric($, url);
  if (generic.title && generic.title.length > 0) {
    // Если JSON-LD дал хоть что-то (но не прошло isValidRecipe), используем его
    // вместо чистого generic — обычно там хоть title правильный.
    if (jsonLd && jsonLd.title) {
      return finalize(jsonLd, sourceUrl, source);
    }
    return finalize(generic, sourceUrl, source);
  }

  throw new Error(
    "Не удалось распознать рецепт на этом сайте. Попробуйте другой URL или добавьте вручную.",
  );
}

function isValidRecipe(r: Partial<ScrapedRecipe>): boolean {
  return (
    !!r.title &&
    r.title.length > 0 &&
    (r.ingredients?.length ?? 0) >= 1 &&
    (r.steps?.length ?? 0) >= 1
  );
}

function finalize(
  partial: Partial<ScrapedRecipe>,
  sourceUrl: string,
  source: string,
): ScrapedRecipe {
  return {
    title: (partial.title || "").slice(0, 300),
    description: truncate(partial.description, 5000),
    imageUrl: partial.imageUrl ?? null,
    servings: partial.servings && partial.servings > 0 ? partial.servings : 4,
    prepTime: partial.prepTime ?? null,
    cookTime: partial.cookTime ?? null,
    totalTime: partial.totalTime ?? null,
    sourceUrl,
    source,
    category: partial.category ?? null,
    cuisine: partial.cuisine ?? null,
    difficulty: partial.difficulty ?? null,
    calories: partial.calories ?? null,
    ingredients: (partial.ingredients ?? []).slice(0, 200),
    steps: (partial.steps ?? []).slice(0, 100),
  };
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

// --- Fetch ---

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
    if (!res.ok) {
      throw new Error(`Сайт вернул код ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "";
    let charset = "utf-8";
    const ctMatch = contentType.match(/charset=([^;]+)/i);
    if (ctMatch) {
      charset = ctMatch[1].trim().toLowerCase();
    } else {
      // Сканируем первые 2КБ на <meta charset=...>
      const head = buffer.subarray(0, 2048).toString("latin1");
      const metaMatch = head.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i);
      if (metaMatch) charset = metaMatch[1].toLowerCase();
    }

    if (charset === "utf-8" || charset === "utf8") {
      return buffer.toString("utf8");
    }
    if (iconv.encodingExists(charset)) {
      return iconv.decode(buffer, charset);
    }
    return buffer.toString("utf8");
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Сайт не отвечает (превышено время ожидания 15 секунд)");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Strategy 1: JSON-LD ---

function parseJsonLd(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Partial<ScrapedRecipe> | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const text = $(scripts[i]).text().trim();
    if (!text) continue;
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    const recipe = findRecipeNode(data);
    if (recipe) {
      return jsonLdToRecipe(recipe, baseUrl);
    }
  }
  return null;
}

function findRecipeNode(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  const obj = data as Record<string, unknown>;
  const type = obj["@type"];
  if (
    type === "Recipe" ||
    (Array.isArray(type) && (type as unknown[]).includes("Recipe"))
  ) {
    return obj;
  }
  if (obj["@graph"]) {
    return findRecipeNode(obj["@graph"]);
  }
  return null;
}

function jsonLdToRecipe(
  r: Record<string, unknown>,
  baseUrl: string,
): Partial<ScrapedRecipe> {
  const nutrition = r.nutrition as Record<string, unknown> | undefined;
  return {
    title: typeof r.name === "string" ? r.name.trim() : "",
    description:
      typeof r.description === "string" ? r.description.trim() : null,
    imageUrl: extractImageUrl(r.image, baseUrl),
    servings: parseServings(r.recipeYield),
    prepTime: parseDuration(r.prepTime),
    cookTime: parseDuration(r.cookTime),
    totalTime: parseDuration(r.totalTime),
    category: stringOrFirst(r.recipeCategory),
    cuisine: stringOrFirst(r.recipeCuisine),
    difficulty: null,
    calories: parseCalories(nutrition?.calories),
    ingredients: parseIngredientsArray(r.recipeIngredient),
    steps: parseStepsArray(r.recipeInstructions, baseUrl),
  };
}

function stringOrFirst(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") {
    return (v[0] as string).trim() || null;
  }
  return null;
}

function extractImageUrl(img: unknown, baseUrl: string): string | null {
  if (!img) return null;
  let raw: string | null = null;
  if (typeof img === "string") {
    raw = img;
  } else if (Array.isArray(img) && img.length > 0) {
    return extractImageUrl(img[0], baseUrl);
  } else if (typeof img === "object") {
    const obj = img as Record<string, unknown>;
    if (typeof obj.url === "string") raw = obj.url;
    else if (typeof obj["@id"] === "string") raw = obj["@id"] as string;
  }
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return null;
  }
}

function parseDuration(d: unknown): number | null {
  if (!d) return null;
  const s = String(d).trim();
  // ISO 8601: PT1H30M, PT45M, PT2H
  const iso = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (iso) {
    const h = parseInt(iso[1] || "0", 10);
    const m = parseInt(iso[2] || "0", 10);
    const total = h * 60 + m;
    return total > 0 ? total : null;
  }
  // Plain number → minutes
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseServings(y: unknown): number {
  if (typeof y === "number" && y > 0) return Math.round(y);
  if (Array.isArray(y) && y.length > 0) return parseServings(y[0]);
  if (y === null || y === undefined) return 4;
  const m = String(y).match(/\d+/);
  return m ? Math.max(1, parseInt(m[0], 10)) : 4;
}

function parseCalories(c: unknown): number | null {
  if (!c) return null;
  const m = String(c).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseIngredientsArray(list: unknown): ScrapedIngredient[] {
  if (!Array.isArray(list)) return [];
  const result: ScrapedIngredient[] = [];
  for (const item of list) {
    let text = "";
    if (typeof item === "string") {
      text = item;
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (typeof obj.text === "string") text = obj.text;
      else if (typeof obj.name === "string") text = obj.name;
    }
    text = text.trim();
    if (text) result.push(parseIngredientText(text));
  }
  return result;
}

const KNOWN_UNITS = [
  "г",
  "гр",
  "грамм",
  "граммов",
  "кг",
  "килограмм",
  "мл",
  "миллилитр",
  "л",
  "литр",
  "литров",
  "шт",
  "штук",
  "штука",
  "штуки",
  "ст.л",
  "ст.л.",
  "ст",
  "ст.",
  "столовая",
  "столовых",
  "ложка",
  "ложки",
  "ложек",
  "ч.л",
  "ч.л.",
  "ч.",
  "чайная",
  "чайных",
  "стакан",
  "стакана",
  "стаканов",
  "стак",
  "стак.",
  "зубчик",
  "зубчика",
  "зубчиков",
  "пучок",
  "пучка",
  "щепотка",
  "щепотки",
  "долька",
  "дольки",
  "долек",
  "пакет",
  "пакетик",
  "по",
  "веточка",
  "веточки",
  "кусок",
  "куска",
  "кусков",
];

function parseIngredientText(text: string): ScrapedIngredient {
  const trimmed = text.replace(/\s+/g, " ").trim();
  // Числа с дробью «1/2», диапазоны «2-3», десятичные «0,5»
  // Берём только первое число и единицу. Сложные кейсы — название целиком.
  const match = trimmed.match(
    /^(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)\s*([а-яa-z.]+)?\s+(.+)$/i,
  );
  if (match) {
    const amountStr = match[1].split(/[-–]/)[0].replace(",", ".");
    let amount: number | null = null;
    if (amountStr.includes("/")) {
      const [a, b] = amountStr.split("/").map(Number);
      if (b > 0) amount = a / b;
    } else {
      const n = parseFloat(amountStr);
      if (Number.isFinite(n)) amount = n;
    }
    const unitWord = (match[2] || "").toLowerCase().replace(/\.$/, "");
    const rest = match[3].trim();

    if (
      unitWord &&
      KNOWN_UNITS.some((u) => unitWord === u || unitWord.startsWith(u))
    ) {
      return { name: rest, amount, unit: match[2], groupName: null };
    }
    // Не похоже на единицу — вернём слово в название
    const fullName = match[2] ? `${match[2]} ${rest}` : rest;
    return { name: fullName.trim(), amount, unit: null, groupName: null };
  }
  return { name: trimmed, amount: null, unit: null, groupName: null };
}

function parseStepsArray(instr: unknown, baseUrl: string): ScrapedStep[] {
  if (!instr) return [];

  if (typeof instr === "string") {
    return instr
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => ({ instruction: s, imageUrl: null, timerMinutes: null }));
  }

  if (!Array.isArray(instr)) return [];

  const result: ScrapedStep[] = [];
  for (const item of instr) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) {
        result.push({ instruction: text, imageUrl: null, timerMinutes: null });
      }
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const type = obj["@type"];
      if (type === "HowToSection" && Array.isArray(obj.itemListElement)) {
        for (const sub of obj.itemListElement as unknown[]) {
          if (sub && typeof sub === "object") {
            const sObj = sub as Record<string, unknown>;
            const text = String(sObj.text || sObj.name || "").trim();
            if (text) {
              result.push({
                instruction: text,
                imageUrl: extractImageUrl(sObj.image, baseUrl),
                timerMinutes: null,
              });
            }
          }
        }
      } else {
        const text = String(obj.text || obj.name || "").trim();
        if (text) {
          result.push({
            instruction: text,
            imageUrl: extractImageUrl(obj.image, baseUrl),
            timerMinutes: null,
          });
        }
      }
    }
  }
  return result;
}

// --- Strategy 2: menunedeli.ru ---

function parseMenunedeli(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Partial<ScrapedRecipe> | null {
  const title =
    $("h1").first().text().trim() ||
    $("article h2").first().text().trim();
  if (!title) return null;

  const imageUrl = extractImageUrl(
    $('meta[property="og:image"]').attr("content") ||
      $("article img, .entry-content img").first().attr("src"),
    baseUrl,
  );

  // Ингредиенты часто в таблице или списке
  const ingredients: ScrapedIngredient[] = [];
  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    if (cells.length >= 2 && cells[0] && cells[1]) {
      // Обычно: [название, количество]
      const text = `${cells[1]} ${cells[0]}`.trim();
      if (text.length < 200) {
        ingredients.push(parseIngredientText(text));
      }
    }
  });

  if (ingredients.length === 0) {
    $(".entry-content ul li, ul.ingredients li").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 200) {
        ingredients.push(parseIngredientText(text));
      }
    });
  }

  const steps: ScrapedStep[] = [];
  $(".entry-content ol li").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 10) {
      steps.push({ instruction: text, imageUrl: null, timerMinutes: null });
    }
  });
  if (steps.length === 0) {
    // Fallback: параграфы внутри content
    $(".entry-content p").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 30 && text.length < 1500) {
        steps.push({ instruction: text, imageUrl: null, timerMinutes: null });
      }
    });
  }

  return {
    title,
    description: null,
    imageUrl,
    servings: 4,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    category: null,
    cuisine: null,
    difficulty: null,
    calories: null,
    ingredients,
    steps,
  };
}

// --- Strategy 3: Microdata ---

function parseMicrodata(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Partial<ScrapedRecipe> | null {
  const root = $('[itemtype*="schema.org/Recipe"]').first();
  if (root.length === 0) return null;

  const get = (prop: string) => root.find(`[itemprop="${prop}"]`).first();
  const getText = (prop: string) => get(prop).text().trim();
  const getAttr = (prop: string, attrs: string[]) => {
    const el = get(prop);
    for (const a of attrs) {
      const v = el.attr(a);
      if (v) return v;
    }
    return null;
  };

  const ingredients: ScrapedIngredient[] = [];
  root.find('[itemprop="recipeIngredient"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) ingredients.push(parseIngredientText(t));
  });

  const steps: ScrapedStep[] = [];
  const stepsRoot = root.find('[itemprop="recipeInstructions"]').first();
  if (stepsRoot.length > 0) {
    const liItems = stepsRoot.find("li");
    const collectFrom = liItems.length > 0 ? liItems : stepsRoot.find("p");
    collectFrom.each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.length > 5) {
        steps.push({ instruction: t, imageUrl: null, timerMinutes: null });
      }
    });
    if (steps.length === 0) {
      // Только один блок текста — разбиваем по переносам
      const t = stepsRoot.text().trim();
      t.split(/\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5)
        .forEach((s) => {
          steps.push({ instruction: s, imageUrl: null, timerMinutes: null });
        });
    }
  }

  return {
    title: getText("name") || $("h1").first().text().trim(),
    description: getText("description") || null,
    imageUrl: extractImageUrl(
      get("image").attr("src") || get("image").attr("content"),
      baseUrl,
    ),
    servings: parseServings(
      getText("recipeYield") || get("recipeYield").attr("content"),
    ),
    prepTime: parseDuration(getAttr("prepTime", ["content", "datetime"])),
    cookTime: parseDuration(getAttr("cookTime", ["content", "datetime"])),
    totalTime: parseDuration(getAttr("totalTime", ["content", "datetime"])),
    category: getText("recipeCategory") || null,
    cuisine: getText("recipeCuisine") || null,
    difficulty: null,
    calories: null,
    ingredients,
    steps,
  };
}

// --- Strategy 4: Generic ---

// Убирает суффикс «| Имя сайта» / «— Имя сайта» / «- Имя сайта» из title,
// если он совпадает с og:site_name. Это спасает от «Рецепт X | Меню недели».
function stripSiteNameSuffix(title: string, siteName: string): string {
  if (!siteName) return title;
  for (const sep of [" | ", " — ", " – ", " - ", " · "]) {
    const suffix = `${sep}${siteName}`;
    if (title.endsWith(suffix)) {
      return title.slice(0, -suffix.length).trim();
    }
  }
  return title;
}

function parseGeneric(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Partial<ScrapedRecipe> {
  const siteName =
    $('meta[property="og:site_name"]').attr("content")?.trim() || "";
  const rawTitle =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    $("title").text().trim();
  return {
    title: stripSiteNameSuffix(rawTitle, siteName),
    description:
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $('meta[name="description"]').attr("content")?.trim() ||
      null,
    imageUrl: extractImageUrl(
      $('meta[property="og:image"]').attr("content"),
      baseUrl,
    ),
    servings: 4,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    category: null,
    cuisine: null,
    difficulty: null,
    calories: null,
    ingredients: [],
    steps: [],
  };
}
