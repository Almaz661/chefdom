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
    // Если title из JSON-LD мусорный — подменить на h1 или og:title или из URL
    if (jsonLd.title && isJunkTitle(jsonLd.title)) {
      const h1 = $("h1").first().text().trim();
      const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || "";
      if (h1 && !isJunkTitle(h1)) {
        jsonLd.title = h1;
      } else if (ogTitle && !isJunkTitle(ogTitle)) {
        // Убираем суффикс сайта из og:title
        const siteName = $('meta[property="og:site_name"]').attr("content")?.trim() || "";
        jsonLd.title = stripSiteNameSuffix(ogTitle, siteName);
      } else {
        // Последний fallback — из URL
        const fromUrl = titleFromUrl(url);
        if (fromUrl) jsonLd.title = fromUrl;
      }
    }
    return finalize(jsonLd, sourceUrl, source);
  }

  // Стратегия 2: сайт-специфика
  if (source.includes("menunedeli.ru")) {
    const menu = parseMenunedeli($, url);
    if (menu && isValidRecipe(menu)) {
      return finalize(menu, sourceUrl, source);
    }
  }

  if (source.includes("povar.ru")) {
    const povar = parsePovarRu($, url);
    if (povar && isValidRecipe(povar)) {
      return finalize(povar, sourceUrl, source);
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

/** Определяет «мусорный» title — общее название сайта/каталога, а не рецепта */
function isJunkTitle(title: string): boolean {
  const lower = title.toLowerCase();
  const junkPatterns = [
    "каталог рецептов",
    "каталог",
    "рецепты с фото",
    "пошаговые рецепты",
    "главная",
    "все рецепты",
    "кулинарные рецепты",
  ];
  return junkPatterns.some((p) => lower.includes(p));
}

/** Извлекает человекочитаемое название из URL (транслит → заглавная буква) */
function titleFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    // Берём последний сегмент: salat_cezar_s_kuricei_i_suharikami-304.html
    const lastSeg = path.split("/").filter(Boolean).pop() || "";
    // Убираем расширение и числовой суффикс
    const clean = lastSeg
      .replace(/\.html?$/i, "")
      .replace(/-\d+$/, "")
      .replace(/[_-]/g, " ")
      .trim();
    if (clean.length < 3) return null;
    // Заглавная первая буква
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  } catch {
    return null;
  }
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
  "ст. л.",
  "ст. ложка",
  "ст. ложки",
  "ст. ложек",
  "ст",
  "ст.",
  "столовая",
  "столовых",
  "ложка",
  "ложки",
  "ложек",
  "ч.л",
  "ч.л.",
  "ч. л.",
  "ч. ложка",
  "ч. ложки",
  "ч. ложек",
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
  "веточка",
  "веточки",
  "кусок",
  "куска",
  "кусков",
];

function parseIngredientText(text: string): ScrapedIngredient {
  const trimmed = text.replace(/\s+/g, " ").trim();

  // Убираем «по вкусу» — это не единица и не количество
  const noTaste = trimmed.replace(/\bпо вкусу\b/gi, "").trim();
  const isByTaste = noTaste.length < trimmed.length;

  // Если после удаления «по вкусу» ничего не осталось кроме названия
  if (isByTaste && !noTaste.match(/\d/)) {
    const name = noTaste.replace(/^[-–—,.\s]+|[-–—,.\s]+$/g, "").trim();
    return { name: name || trimmed, amount: null, unit: "по вкусу", groupName: null };
  }

  const working = noTaste || trimmed;

  // Формат 1: «150 грамм Куриное филе» (число в начале)
  const matchStart = working.match(
    /^(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)\s*([а-яa-z.]+)?\s+(.+)$/i,
  );
  if (matchStart) {
    const parsed = parseAmountUnit(matchStart[1], matchStart[2]);
    const rest = matchStart[3].trim();
    if (parsed.unitMatch) {
      return { name: rest, amount: parsed.amount, unit: parsed.unit, groupName: null };
    }
    const fullName = matchStart[2] ? `${matchStart[2]} ${rest}` : rest;
    return { name: fullName.trim(), amount: parsed.amount, unit: null, groupName: null };
  }

  // Формат 2: «Куриное филе — 150 грамм» или «Куриное филе 150 г» (число после названия)
  const matchEnd = working.match(
    /^(.+?)\s*[-–—]\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)\s*([а-яa-z.]+)?$/i,
  );
  if (matchEnd) {
    const parsed = parseAmountUnit(matchEnd[2], matchEnd[3]);
    return { name: matchEnd[1].trim(), amount: parsed.amount, unit: parsed.unit, groupName: null };
  }

  // Формат 3: «Куриное филе 150 грамм» (число после названия без разделителя)
  // Также ловит «Мука пшеничная 3 ст. ложки»
  const matchEndNoSep = working.match(
    /^(.+?)\s+(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)\s+(.+)$/i,
  );
  if (matchEndNoSep) {
    const namePart = matchEndNoSep[1].trim();
    const afterNumber = matchEndNoSep[3].trim();
    // Убедиться что namePart содержит буквы (не число)
    if (/[а-яА-Яa-zA-Z]/.test(namePart)) {
      const parsed = parseAmountUnit(matchEndNoSep[2], undefined);
      // Проверяем — afterNumber это единица или часть названия?
      const afterLower = afterNumber.toLowerCase().replace(/\.$/, "");
      const isUnit = KNOWN_UNITS.some((u) => afterLower === u || afterLower.startsWith(u));
      if (isUnit) {
        return { name: namePart, amount: parsed.amount, unit: afterNumber, groupName: null };
      }
      // afterNumber может быть «грамм твердый» — единица + уточнение
      const unitFromAfter = extractUnitFromStart(afterNumber);
      if (unitFromAfter) {
        return { name: namePart, amount: parsed.amount, unit: unitFromAfter, groupName: null };
      }
      // Не единица — может быть число внутри названия, вернём как есть
      return { name: working, amount: null, unit: null, groupName: null };
    }
  }

  // Формат 3b: «Куриное филе 150» (число в конце без единицы)
  const matchEndNum = working.match(
    /^(.+?)\s+(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)$/i,
  );
  if (matchEndNum) {
    const namePart = matchEndNum[1].trim();
    if (/[а-яА-Яa-zA-Z]/.test(namePart)) {
      const parsed = parseAmountUnit(matchEndNum[2], undefined);
      return { name: namePart, amount: parsed.amount, unit: null, groupName: null };
    }
  }

  // Ничего не распознали — название целиком
  if (isByTaste) {
    return { name: working.replace(/^[-–—,.\s]+|[-–—,.\s]+$/g, "").trim() || trimmed, amount: null, unit: "по вкусу", groupName: null };
  }
  return { name: working, amount: null, unit: null, groupName: null };
}

function parseAmountUnit(amountStr: string, unitStr: string | undefined): { amount: number | null; unit: string | null; unitMatch: boolean } {
  const cleanAmount = amountStr.split(/[-–]/)[0].replace(",", ".");
  let amount: number | null = null;
  if (cleanAmount.includes("/")) {
    const [a, b] = cleanAmount.split("/").map(Number);
    if (b > 0) amount = a / b;
  } else {
    const n = parseFloat(cleanAmount);
    if (Number.isFinite(n)) amount = n;
  }

  const unitWord = (unitStr || "").toLowerCase().replace(/\.$/, "");
  const unitMatch = !!(
    unitWord &&
    KNOWN_UNITS.some((u) => unitWord === u || unitWord.startsWith(u))
  );

  return { amount, unit: unitMatch ? unitStr! : null, unitMatch };
}

/** Извлечь единицу из начала строки (например «грамм твердый» → «грамм») */
function extractUnitFromStart(text: string): string | null {
  const lower = text.toLowerCase();
  // Сортируем по длине (сначала длинные) чтобы «ст. ложки» матчилось раньше «ст»
  const sorted = [...KNOWN_UNITS].sort((a, b) => b.length - a.length);
  for (const u of sorted) {
    if (lower === u || lower.startsWith(u + " ") || lower.startsWith(u + ".")) {
      return text.slice(0, u.length);
    }
  }
  // Попробуем первое слово
  const firstWord = text.split(/\s/)[0].toLowerCase().replace(/\.$/, "");
  if (KNOWN_UNITS.some((u) => firstWord === u)) {
    return text.split(/\s/)[0];
  }
  return null;
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

// --- Strategy 2b: povar.ru ---

function parsePovarRu(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Partial<ScrapedRecipe> | null {
  // Название рецепта — в h1
  const title = $("h1").first().text().trim();
  if (!title) return null;

  const imageUrl = extractImageUrl(
    $('meta[property="og:image"]').attr("content") ||
      $(".bigImgBox img, .recipe-img img, .detailed img").first().attr("src"),
    baseUrl,
  );

  const description =
    $('meta[property="og:description"]').attr("content")?.trim() || null;

  // Ингредиенты — обычно в ul.detailed_ingredients li или table
  const ingredients: ScrapedIngredient[] = [];
  $(".detailed_ingredients li, .ingredients_list li, ul.detailed_full li").each(
    (_, el) => {
      const nameEl = $(el).find(".name, span[itemprop='recipeIngredient']").first();
      const qtyEl = $(el).find(".value, .count").first();

      if (nameEl.length > 0) {
        const name = nameEl.text().trim();
        const qtyText = qtyEl.text().trim();
        if (name) {
          const combined = qtyText ? `${name} ${qtyText}` : name;
          ingredients.push(parseIngredientText(combined));
        }
      } else {
        // Fallback — весь текст li
        const text = $(el).text().trim();
        if (text && text.length < 200) {
          ingredients.push(parseIngredientText(text));
        }
      }
    },
  );

  // Шаги — обычно в .detailed_step_description_big или ol
  const steps: ScrapedStep[] = [];
  $(".detailed_step_description_big, .step_description, .detailed_step_content p").each(
    (_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        const imgEl = $(el).closest(".detailed_step_photo_big, .step_photo").find("img");
        const stepImg = imgEl.length > 0 ? extractImageUrl(imgEl.attr("src"), baseUrl) : null;
        steps.push({ instruction: text, imageUrl: stepImg, timerMinutes: null });
      }
    },
  );

  if (steps.length === 0) {
    $(".instructions ol li, .detailed_full ol li").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        steps.push({ instruction: text, imageUrl: null, timerMinutes: null });
      }
    });
  }

  // Порции
  const servingsText = $(".detailed_full .icon-person, .servings-count").first().text().trim();
  const servings = parseServings(servingsText);

  // Время
  const timeText = $(".detailed_full .icon-time, .prep-time").first().text().trim();
  const totalTime = parseDuration(timeText) || parseMinutesFromText(timeText);

  return {
    title,
    description,
    imageUrl,
    servings,
    prepTime: null,
    cookTime: null,
    totalTime,
    category: null,
    cuisine: null,
    difficulty: null,
    calories: null,
    ingredients,
    steps,
  };
}

/** Парсит «45 минут» → 45, «1 час 20 минут» → 80 */
function parseMinutesFromText(text: string): number | null {
  if (!text) return null;
  let total = 0;
  const hMatch = text.match(/(\d+)\s*час/);
  if (hMatch) total += parseInt(hMatch[1], 10) * 60;
  const mMatch = text.match(/(\d+)\s*мин/);
  if (mMatch) total += parseInt(mMatch[1], 10);
  return total > 0 ? total : null;
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

  // Приоритет: h1 > og:title > title (h1 обычно точнее для рецепта)
  const h1 = $("h1").first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || "";
  const titleTag = $("title").text().trim();

  let rawTitle = h1 || ogTitle || titleTag;
  rawTitle = stripSiteNameSuffix(rawTitle, siteName);

  // Если h1 слишком общий (< 3 слов и = og:site_name), берём og:title
  if (rawTitle === siteName && ogTitle && ogTitle !== siteName) {
    rawTitle = stripSiteNameSuffix(ogTitle, siteName);
  }

  return {
    title: rawTitle,
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
