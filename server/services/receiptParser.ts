// G.19 — парсер текста чека из OCR.
// Эвристический: чеки разных магазинов отличаются, OCR не идеален.
// Если распозналось плохо — пользователь правит позиции на месте
// или удаляет чек и фотографирует снова.

export interface ParsedReceipt {
  storeName: string | null;
  purchaseDate: string | null; // YYYY-MM-DD
  currency: 'EUR' | 'RUB';
  totalAmount: number | null;
  items: ParsedItem[];
}

export interface ParsedItem {
  productName: string;
  price: number | null;
}

// Известные сети. Регексп ищется по всему тексту чека (case-insensitive).
const KNOWN_STORES: Array<[RegExp, string, 'EUR' | 'RUB']> = [
  // Нидерланды
  [/albert\s*heijn|\bA\.?H\b/i, 'Albert Heijn', 'EUR'],
  [/jumbo/i, 'Jumbo', 'EUR'],
  [/lidl/i, 'Lidl', 'EUR'],
  [/aldi/i, 'Aldi', 'EUR'],
  [/dirk/i, 'Dirk', 'EUR'],
  [/plus\s+supermarkt|^plus$/im, 'Plus', 'EUR'],
  [/spar\b/i, 'Spar', 'EUR'],
  [/hoogvliet/i, 'Hoogvliet', 'EUR'],
  [/coop\b/i, 'Coop', 'EUR'],
  // Россия
  [/пятёрочка|пятерочка/i, 'Пятёрочка', 'RUB'],
  [/перекрёсток|перекресток/i, 'Перекрёсток', 'RUB'],
  [/магнит/i, 'Магнит', 'RUB'],
  [/ашан/i, 'Ашан', 'RUB'],
  [/лента/i, 'Лента', 'RUB'],
  [/окей|о'?кей/i, 'О\'кей', 'RUB'],
  [/вкусвилл/i, 'ВкусВилл', 'RUB'],
  [/дикси/i, 'Дикси', 'RUB'],
  [/billa/i, 'Billa', 'RUB'],
  [/metro/i, 'Metro', 'RUB'],
];

function detectStoreAndCurrency(text: string): {
  storeName: string | null;
  currency: 'EUR' | 'RUB';
} {
  for (const [re, name, currency] of KNOWN_STORES) {
    if (re.test(text)) return { storeName: name, currency };
  }
  if (/₽|\bруб(?:\.|лей|ля)?\b/i.test(text)) {
    return { storeName: null, currency: 'RUB' };
  }
  return { storeName: null, currency: 'EUR' };
}

// Дата: 31.05.2026 / 31-05-2026 / 31/05/2026 или ISO YYYY-MM-DD
function detectDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

// Извлекаем «цену» — последнее число в строке.
// Поддержка: 1,99 · 1.99 · 12.345,67 (NL) · 12,345.67 (US) · €1,99 · -2,07
function extractTrailingPrice(line: string): number | null {
  const cleaned = line
    .replace(/[€₽$]/g, ' ')
    .replace(/\s+(?:EUR|RUB)\b/gi, ' ');
  const matches = cleaned.match(
    /-?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})|-?\d+[.,]\d{1,2}|-?\d+/g,
  );
  if (!matches || matches.length === 0) return null;
  let last = matches[matches.length - 1];
  last = last.replace(/\s/g, '');
  const lastComma = last.lastIndexOf(',');
  const lastDot = last.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // 12.345,67 → 12345.67
      last = last.replace(/\./g, '').replace(',', '.');
    } else {
      // 12,345.67 → 12345.67
      last = last.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    last = last.replace(',', '.');
  }
  const n = parseFloat(last);
  return Number.isFinite(n) ? n : null;
}

// Строки, которые гарантированно НЕ позиции товара.
const SKIP_LINE: RegExp[] = [
  /^\s*$/,
  /^\s*[-=*_+]+\s*$/,
  // Служебные слова (NL + EN + RU)
  /^\s*(итого|всего|сумма|total|totaal|subtotaal|subtotal|te\s+betalen|к\s*оплате|сумма\s*к\s*оплате)\b/i,
  /\bbtw\b|\bvat\b|\bnetto\b|\bbruto\b/i,
  /\b(kassa|kassabon|ticket|bon|chequ?e)\b/i,
  /^\s*(спасибо|приходите|bedankt|thank\s*you|hartelijk\s*dank|tot\s*ziens)/i,
  /\b(?:tel|phone|телефон|адрес|address|kvk|inn|инн|kassier|merchant|terminal|period|transaction|token|client|debit|mastercard|maestro|visa|payment|authorization|pinbetaling|contact\s*less|read\s*method|chip|card)\b/i,
  /^\s*\d{1,2}[:.]\d{2}(?::\d{2})?\s*$/, // только время
  /^\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s*$/, // только дата
  /^\s*(?:касс|cash|карта|оплата|sale|n\d+\s+\d+)/i,
  // Длинные цифровые ID / штрих-коды / транзакции
  /^\s*[A-Z0-9]{12,}\s*$/,
  /^\s*\d{6,}\s*$/,
  /^\s*[A-Z]{1,3}\d{4,}/,
  /^\s*\d+\s+\d+\s+\d+/, // три и более числовых блока (служебка)
  // Адресные строки (улицы, индексы)
  /\b\d{4}\s*[A-Z]{2}\b/, // голландский индекс типа "6663 RL"
  /\b(plein|straat|laan|weg|kade|gracht)\b/i, // улицы NL
];

// Слова, по которым опознаём «итог»
function detectTotal(text: string): number | null {
  const lines = text.split(/\r?\n/);
  // Идём с конца — итог обычно внизу
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (
      /^\s*(итого|total|totaal|te\s+betalen|сумма\s*к\s*оплате|к\s*оплате|сумма)\b/i.test(
        l,
      )
    ) {
      const p = extractTrailingPrice(l);
      if (p !== null) return p;
    }
  }
  // Иногда «TOTAAL» отдельной строкой, а сумма ниже. Возвращаем максимальную
  // «цене-подобную» цифру в нижней трети чека.
  const lower = lines.slice(Math.floor(lines.length * 0.6));
  let max = 0;
  for (const l of lower) {
    const p = extractTrailingPrice(l);
    if (p !== null && p > max && p < 9999) max = p;
  }
  return max > 0 ? max : null;
}

// «Чистим» имя позиции: убираем хвост-цену, валютные знаки, лишние пробелы
function stripPriceTail(line: string): string {
  return line
    .replace(/[€₽$]/g, ' ')
    .replace(
      /-?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})\s*$|-?\d+[.,]\d{1,2}\s*$/,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

// Похоже ли это на цену (обычная цена продукта в чеке)
function looksLikePrice(n: number): boolean {
  return Number.isFinite(n) && n > -1000 && n < 1000 && n !== 0;
}

// Похоже ли это на название товара
function looksLikeProductName(s: string): boolean {
  if (s.length < 2 || s.length > 80) return false;
  // Должна быть хоть одна буква
  if (!/\p{L}/u.test(s)) return false;
  // Не должно быть слишком много цифр (вряд ли название состоит из них)
  const digits = (s.match(/\d/g) ?? []).length;
  if (digits / s.length > 0.5) return false;
  return true;
}

interface ItemCandidate {
  name: string;
  price: number;
}

/**
 * Стратегия 1 — построчная.
 * На каждой строке смотрим: если в конце есть число похожее на цену И
 * перед ним есть текст похожий на имя товара — это позиция.
 */
function parseLineByLine(text: string, total: number | null): ItemCandidate[] {
  const items: ItemCandidate[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (SKIP_LINE.some((re) => re.test(line))) continue;

    const price = extractTrailingPrice(line);
    if (price === null) continue;
    if (!looksLikePrice(price)) continue;
    // Не считаем итог позицией
    if (total !== null && Math.abs(price - total) < 0.01) continue;

    const name = stripPriceTail(line);
    if (!looksLikeProductName(name)) continue;

    items.push({ name, price });
  }
  return items;
}

/**
 * Стратегия 2 — параллельные колонки.
 * Если OCR разделил чек на два «куска»: список названий и список цен —
 * пробуем сматчить по индексу. Срабатывает когда parseLineByLine
 * нашёл мало позиций, но в тексте много чисел и много текстовых строк.
 */
function parseParallelColumns(
  text: string,
  total: number | null,
): ItemCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Текстовые «имя-кандидаты» (без цены в строке)
  const names: string[] = [];
  // Числа-кандидаты (цены)
  const prices: number[] = [];

  for (const l of lines) {
    if (SKIP_LINE.some((re) => re.test(l))) continue;
    // Строка с одним числом и больше ничего → цена
    const justNumberMatch = l.match(
      /^[\s€₽$]*(-?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})|-?\d+[.,]\d{1,2})[\s€₽$]*$/,
    );
    if (justNumberMatch) {
      const p = extractTrailingPrice(l);
      if (p !== null && looksLikePrice(p)) {
        // Не итог
        if (total === null || Math.abs(p - total) > 0.01) {
          prices.push(p);
        }
      }
      continue;
    }
    // Строка с буквами и без цены → имя
    if (looksLikeProductName(l) && !/\d[.,]\d{2}\b/.test(l)) {
      names.push(l);
    }
  }

  const n = Math.min(names.length, prices.length);
  if (n < 2) return [];
  const out: ItemCandidate[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ name: names[i], price: prices[i] });
  }
  return out;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const { storeName, currency } = detectStoreAndCurrency(text);
  const purchaseDate = detectDate(text);
  const totalAmount = detectTotal(text);

  // Сначала пробуем построчно — это даёт самые точные имена
  let items = parseLineByLine(text, totalAmount);

  // Если построчно ничего не получилось (1 позиция и меньше) —
  // пробуем «параллельные колонки»
  if (items.length <= 1) {
    const parallel = parseParallelColumns(text, totalAmount);
    if (parallel.length > items.length) items = parallel;
  }

  return {
    storeName,
    purchaseDate,
    currency,
    totalAmount,
    items: items.map((i) => ({ productName: i.name, price: i.price })),
  };
}
