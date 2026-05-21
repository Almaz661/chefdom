// G.19 — парсер текста чека из OCR.
// Работает на эвристиках, потому что чеки разных магазинов сильно различаются.
// Главная задача: вытащить магазин, дату, валюту, позиции (название + цена), итог.
// Пользователь всегда может удалить чек и пересфотографировать,
// если распознано плохо.

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

// Сети, по которым умеем угадывать магазин. Ключ — что искать в тексте
// (case-insensitive, без диакритики), значение — каноническое имя.
const KNOWN_STORES: Array<[RegExp, string, 'EUR' | 'RUB']> = [
  // Нидерланды
  [/albert\s*heijn|\bah\b/i, 'Albert Heijn', 'EUR'],
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

function detectStoreAndCurrency(
  text: string,
): { storeName: string | null; currency: 'EUR' | 'RUB' } {
  for (const [re, name, currency] of KNOWN_STORES) {
    if (re.test(text)) {
      return { storeName: name, currency };
    }
  }
  // Если магазин не угадали — пробуем определить валюту по символу.
  // Если в тексте есть ₽ или «руб» — RUB, иначе по умолчанию EUR.
  if (/₽|\bруб(?:\.|лей|ля)?\b/i.test(text)) {
    return { storeName: null, currency: 'RUB' };
  }
  return { storeName: null, currency: 'EUR' };
}

// Ищем дату в форматах:
//   31.05.2026 / 31-05-2026 / 31/05/2026   (день первый)
//   2026-05-31  (ISO)
function detectDate(text: string): string | null {
  // ISO YYYY-MM-DD
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // dd.mm.yyyy / dd-mm-yyyy / dd/mm/yyyy
  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

// Извлекаем число (цена) из строки. Поддерживаем:
//   1,99   1.99   €1,99   1 99   12.345,67 (NL)   12,345.67 (US)
// Берём ПОСЛЕДНЕЕ число строки (потому что цена обычно справа).
function extractTrailingPrice(line: string): number | null {
  // Убираем валютные символы из конца чтобы не мешали
  const cleaned = line.replace(/[€₽$]/g, ' ').replace(/\s+EUR\b|\s+RUB\b/gi, ' ');
  // Все числа в строке (с десятичной точкой или запятой)
  const matches = cleaned.match(/-?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})|\d+[.,]\d{1,2}|\d+/g);
  if (!matches || matches.length === 0) return null;
  // Берём последнее
  const last = matches[matches.length - 1];
  // Нормализуем: убираем пробелы, в десятичной части используем точку
  let normalized = last.replace(/\s/g, '');
  // Если есть и запятая и точка — последний разделитель = десятичный
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // запятая после точки → точки это тысячи
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      // точка после запятой → запятые это тысячи
      normalized = normalized.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // только запятая — десятичный разделитель
    normalized = normalized.replace(',', '.');
  }
  const n = parseFloat(normalized);
  if (Number.isNaN(n)) return null;
  return n;
}

// Регекспы строк, которые точно НЕ являются позицией товара.
const SKIP_LINE = [
  /^\s*$/,
  /^\s*[-=*_]+\s*$/, // разделители
  /^\s*(итого|всего|сумма|total|subtotal|btw|vat|kassa|kassabon|ticket)\b/i,
  /^\s*(спасибо|приходите|bedankt|thank you)/i,
  /^\s*(?:тел|tel|phone|адрес|address|kvk|btw|inn)/i,
  /^\s*\d{1,2}[:.]\d{2}\s*$/, // только время
  /^\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s*$/, // только дата
  /^\s*(?:касс|cash|card|карта|оплата|sale)/i,
];

// Ищем итог — строка вида «Итого ... 12.34» или «TOTAL ... 12.34».
function detectTotal(text: string): number | null {
  const totalLine = text
    .split(/\r?\n/)
    .find((l) => /^\s*(итого|total|totaal|сумма к оплате|к оплате)\b/i.test(l));
  if (!totalLine) return null;
  return extractTrailingPrice(totalLine);
}

// Парсим позиции. Эвристика:
//  - строка не служебная (см. SKIP_LINE)
//  - в строке есть число с десятичной частью (вероятная цена)
//  - текст до цены — хотя бы 2 буквы (название)
function detectItems(text: string, total: number | null): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (SKIP_LINE.some((re) => re.test(line))) continue;

    const price = extractTrailingPrice(line);
    if (price === null) continue;
    // Отсеиваем итог (он уже в total)
    if (total !== null && Math.abs(price - total) < 0.01) continue;
    // Цена должна быть «похожа» на цену продукта: > 0 и < 9999
    if (price <= 0 || price > 9999) continue;

    // Имя товара = строка без последнего числа
    let name = line
      .replace(/\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})|\d+[.,]\d{1,2}|\d+\s*$/g, '')
      .replace(/[€₽$]|\b(?:EUR|RUB)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    // Убираем хвостовые цифры/знаки
    name = name.replace(/[\s\-x×*]+\d+\s*$/i, '').trim();
    if (name.length < 2) continue;
    // В названии должна быть хоть одна буква (а то какая-нибудь «1234 5,67»)
    if (!/\p{L}/u.test(name)) continue;

    items.push({ productName: name, price });
  }
  return items;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const { storeName, currency } = detectStoreAndCurrency(text);
  const purchaseDate = detectDate(text);
  const totalAmount = detectTotal(text);
  const items = detectItems(text, totalAmount);

  return {
    storeName,
    purchaseDate,
    currency,
    totalAmount,
    items,
  };
}
