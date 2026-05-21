// G.19 — парсер текста чека из OCR.
// Эвристический. Поддерживает два формата:
//
// 1) Однострочный (Albert Heijn, Jumbo, российские сети):
//      «Молоко 1,29»
//
// 2) Двухстрочный (ALDI, Lidl) — название и цена на разных строках:
//      «Volle kwark»
//      «1,29 € B»
//    Особый случай нескольких единиц на ALDI:
//      «Paprikamix Net»
//      «1,99 € B»
//      «2 x 2,39 €»     ← инфо о количестве (мы её игнорируем — общая цена есть отдельно)
//      «Barissimo intense»
//      «4,78 € B»
//
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

// Известные сети. `\s*` между буквами — на случай если OCR разорвал
// название пробелами (на сканах ALDI часто получается «A L D I»).
const KNOWN_STORES: Array<[RegExp, string, 'EUR' | 'RUB']> = [
  // Нидерланды
  [/a\s*l\s*b\s*e\s*r\s*t\s*\s*h\s*e\s*i\s*j\s*n|\bA\.?H\b/i, 'Albert Heijn', 'EUR'],
  [/j\s*u\s*m\s*b\s*o/i, 'Jumbo', 'EUR'],
  [/l\s*i\s*d\s*l/i, 'Lidl', 'EUR'],
  [/a\s*l\s*d\s*i/i, 'Aldi', 'EUR'],
  [/d\s*i\s*r\s*k/i, 'Dirk', 'EUR'],
  [/plus\s+supermarkt|^plus$/im, 'Plus', 'EUR'],
  [/\bspar\b/i, 'Spar', 'EUR'],
  [/hoogvliet/i, 'Hoogvliet', 'EUR'],
  [/\bcoop\b/i, 'Coop', 'EUR'],
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

// Преобразуем строку-число с разными разделителями в JS number.
function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Регексп для строк, состоящих ТОЛЬКО из цены (с возможными €, B, BB, A, и т.д.)
// Покрывает: «1,29», «1,29 €», «-2,07», «4,78 € B», «0,99», «19,28 €»
const PRICE_ONLY_RE = /^-?\d{1,4}[.,]\d{2}\s*(?:€|EUR)?\s*(?:[A-Z0-9]{1,3})?\s*$/;

// «N x X,XX €» — строка о количестве. Проверяет что это именно
// «количество × цена-за-штуку», а не позиция товара.
function isQuantityLine(line: string): boolean {
  return /^\s*\d+\s*[xXхХ\*×]\s*\d{1,4}[.,]\d{2}\s*(?:€|EUR)?\s*$/.test(line);
}

// Пытаемся достать «хвостовую» цену из произвольной строки (для one-line формата).
function extractTrailingPrice(line: string): number | null {
  const cleaned = line
    .replace(/[€₽$]/g, ' ')
    .replace(/\s+(?:EUR|RUB)\b/gi, ' ');
  const matches = cleaned.match(
    /-?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})|-?\d+[.,]\d{1,2}/g,
  );
  if (!matches || matches.length === 0) return null;
  return parseNumber(matches[matches.length - 1]);
}

// Достаём само число из строки-цены (вырезав €, EUR, BTW-коды).
function priceOnlyValue(line: string): number | null {
  const cleaned = line
    .replace(/€|EUR/gi, ' ')
    .replace(/\b[A-Z0-9]{1,3}\b\s*$/, ' ')
    .trim();
  return parseNumber(cleaned);
}

// Строки, которые гарантированно НЕ позиции товара.
const SKIP_LINE: RegExp[] = [
  /^\s*$/,
  /^\s*[-=*_+]+\s*$/,
  // Заголовки служебных разделов
  /^\s*(итого|всего|сумма|total|totaal|subtotaal|subtotal|te\s*betalen|к\s*оплате|сумма\s*к\s*оплате)\s*$/i,
  /^\s*(EUR|RUB)\s*$/,
  // Налоговые/банковские термины
  /\bbtw\b|\bvat\b|\bnetto\b|\bbruto\b/i,
  /\b(kassa|kassabon|ticket|bon|chequ?e)\b/i,
  /^\s*(спасибо|приходите|bedankt|thank\s*you|hartelijk\s*dank|tot\s*ziens)/i,
  /\b(?:tel|phone|телефон|адрес|address|kvk|inn|инн|kassier|merchant|terminal|period|transaction|token|client|debit|mastercard|maestro|visa|payment|authorization|pinbetaling|contact\s*less|read\s*method|chip|card|sequence)\b/i,
  /^\s*\d{1,2}[:.]\d{2}(?::\d{2})?\s*$/,
  /^\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s*$/,
  /^\s*(?:касс|cash|карта|оплата|sale|n\d+\s+\d+)/i,
  // Длинные цифровые ID / штрих-коды / транзакции
  /^\s*[A-Z0-9]{12,}\s*$/,
  /^\s*\d{6,}\s*$/,
  /^\s*\d+\s+\d+\s+\d+/,
  // Адресные паттерны NL
  /\b\d{4}\s*[A-Z]{2}\b/,
  /\b(plein|straat|laan|weg|kade|gracht)\b/i,
  // Названия магазинов сами по себе (с возможными пробелами между букв)
  /^\s*a\s*l\s*d\s*i\s*$/i,
  /^\s*l\s*i\s*d\s*l\s*$/i,
  /^\s*j\s*u\s*m\s*b\s*o\s*$/i,
  /^\s*a\s*l\s*b\s*e\s*r\s*t\s*\s*h\s*e\s*i\s*j\s*n\s*$/i,
];

function isSkipLine(line: string): boolean {
  return SKIP_LINE.some((re) => re.test(line));
}

function isPriceOnlyLine(line: string): boolean {
  return PRICE_ONLY_RE.test(line.trim());
}

// Похоже ли строка на название товара
function looksLikeProductName(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (!/\p{L}/u.test(t)) return false;
  const digits = (t.match(/\d/g) ?? []).length;
  if (digits / t.length > 0.4) return false;
  if (isSkipLine(t)) return false;
  if (isQuantityLine(t)) return false;
  if (isPriceOnlyLine(t)) return false;
  return true;
}

function looksLikePrice(n: number): boolean {
  return Number.isFinite(n) && n > -1000 && n < 1000 && n !== 0;
}

// Поиск итога чека.
function detectTotal(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  // Ищем заголовок итога снизу
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (
      /^\s*(итого|total|totaal|te\s*betalen|сумма\s*к\s*оплате|к\s*оплате|сумма)\b/i.test(
        l,
      )
    ) {
      // Сумма может быть в этой же строке
      const inline = extractTrailingPrice(l);
      if (inline !== null && inline > 0 && inline < 99999) return inline;
      // Или на одной из следующих 4 строк (могут быть «EUR», «TE BETALEN», и т.п.)
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const next = lines[j];
        if (!next) continue;
        if (/^(EUR|RUB)$/i.test(next)) continue;
        if (/^\s*(итого|total|totaal|te\s*betalen)\b/i.test(next)) continue;
        const p = extractTrailingPrice(next);
        if (p !== null && p > 0 && p < 99999) return p;
      }
    }
  }
  // Фолбэк — самая большая цена в нижней трети
  const lower = lines.slice(Math.floor(lines.length * 0.6));
  let max = 0;
  for (const l of lower) {
    const p = extractTrailingPrice(l);
    if (p !== null && p > max && p < 9999) max = p;
  }
  return max > 0 ? max : null;
}

interface ItemCandidate {
  name: string;
  price: number;
}

/**
 * Главный парсер.
 * Идёт построчно, состояние: pendingName — имя, ожидающее цену.
 *
 * Для каждой строки:
 *   - служебная / пустая / адрес / название магазина → пропуск
 *   - «N x X,XX» → пропуск (количество, информационная строка)
 *   - цена-only → если есть pendingName, создаём позицию
 *   - название с хвостовой ценой («Молоко 1,29») → создаём позицию сразу
 *   - название без цены → запоминаем как pendingName
 */
function parseAll(text: string, total: number | null): ItemCandidate[] {
  const items: ItemCandidate[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  let pendingName: string | null = null;

  const tryCommit = (price: number): boolean => {
    if (!looksLikePrice(price)) return false;
    if (total !== null && Math.abs(price - total) < 0.01) return false;
    if (!pendingName) return false;
    items.push({ name: pendingName, price });
    pendingName = null;
    return true;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (isSkipLine(line)) continue;

    // «N x X,XX €» — информационная строка о количестве, пропускаем.
    // Общая цена этого товара придёт позже как обычная цена-only.
    if (isQuantityLine(line)) continue;

    // Цена-only?
    if (isPriceOnlyLine(line)) {
      const p = priceOnlyValue(line);
      if (p === null) continue;
      tryCommit(p);
      continue;
    }

    // Кандидат-имя. Проверяем сначала однострочный формат.
    if (looksLikeProductName(line)) {
      // Хвостовая цена в этой же строке («Молоко 1,29»)?
      const tailMatch = line.match(/(.+?)\s+(-?\d{1,4}[.,]\d{2})\s*(?:€|EUR)?\s*$/);
      if (tailMatch) {
        const namePart = tailMatch[1].trim();
        const pricePart = parseNumber(tailMatch[2]);
        if (
          pricePart !== null &&
          looksLikePrice(pricePart) &&
          looksLikeProductName(namePart) &&
          (total === null || Math.abs(pricePart - total) > 0.01)
        ) {
          // Однострочная позиция. pendingName сбрасываем (на случай если
          // оно зависло без цены — лучше потерять, чем привязать к чужой).
          pendingName = null;
          items.push({ name: namePart, price: pricePart });
          continue;
        }
      }
      // Иначе это имя для двухстрочного формата — запомним и будем ждать цену.
      pendingName = line;
    }
  }

  return items;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const { storeName, currency } = detectStoreAndCurrency(text);
  const purchaseDate = detectDate(text);
  const totalAmount = detectTotal(text);

  const items = parseAll(text, totalAmount);

  return {
    storeName,
    purchaseDate,
    currency,
    totalAmount,
    items: items.map((i) => ({ productName: i.name, price: i.price })),
  };
}
