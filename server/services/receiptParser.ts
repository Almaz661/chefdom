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

// Строки-скидки: «Artikelkorting 30%», «Korting», «Скидка 10%» и т.д.
// Они НЕ являются товарами, но имеют связанную отрицательную цену.
// Мы их сохраняем как позиции с отрицательной ценой (для отображения скидки).
function isDiscountLine(line: string): boolean {
  return /\b(korting|discount|скидка|акция|sale)\b/i.test(line);
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
// Важно: BTW-код (B, A, BB, B1) ВСЕГДА начинается с буквы. Если первый
// символ — цифра, это часть числа (например хвост «0,79» или «-2,07»),
// и его нельзя срезать. Поэтому regex требует ведущей буквы:
// `[A-Z][A-Z0-9]{0,2}` — буква + опц. ещё 0–2 буквы/цифры.
function priceOnlyValue(line: string): number | null {
  const cleaned = line
    .replace(/€|EUR/gi, ' ')
    .replace(/\b[A-Z][A-Z0-9]{0,2}\b\s*$/, ' ')
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
  // Одиночные BTW-коды на отдельной строке (B, A, BB, B1, B2)
  /^\s*[A-Z][A-Z0-9]?\s*$/,
  // POI, CLIENT TICKET и прочие идентификаторы
  /^\s*POI\s*:/i,
  /^\s*CLIENT\s*TICKET/i,
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
      // Если pendingName — скидка, она принимает ТОЛЬКО отрицательную цену
      if (pendingName && isDiscountLine(pendingName)) {
        if (p < 0) {
          tryCommit(p);
        }
        // Положительная цена после скидки — это цена следующего товара,
        // скидка осталась без цены (теряем) и переходим к следующему кандидату
        else {
          pendingName = null;
          // Но цена p должна быть привязана к предыдущему pendingName если он был
          // По факту pendingName = null, так что цена пропадёт. Это ок — она будет
          // привязана к следующему имени или уже была привязана.
        }
        continue;
      }
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

/**
 * Стратегия параллельных колонок.
 *
 * Срабатывает когда OCR выдал чек «двумя колонками»: сначала ВСЕ имена
 * товаров подряд (одна за другой), потом ВСЕ цены подряд. Это бывает
 * на ALDI чеках при определённой ориентации фото.
 *
 * Алгоритм:
 *   1. Идём по тексту, складываем кандидаты-имена в `names` и цены в `prices`,
 *      сохраняя порядок появления.
 *   2. «N x X,XX €» (qty line) — пропускаем, в результат не идёт.
 *   3. Если строка состоит ТОЛЬКО из символа валюты («€» / «EUR»), считаем
 *      что это «хвост» предыдущей цены — игнорируем (число уже учтено).
 *   4. Если имён больше чем цен — пробуем склеить соседние имена,
 *      где второе начинается со строчной буквы (продолжение фразы,
 *      например «Barissimo» + «intense»).
 *   5. Если в итоге `len(names) === len(prices)`, матчим по индексу.
 */
function parseParallelColumns(
  text: string,
  total: number | null,
): ItemCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const names: string[] = [];
  const prices: number[] = [];

  for (const l of lines) {
    if (isSkipLine(l)) continue;
    if (isQuantityLine(l)) continue;
    // Одиночный «€» / «EUR» / «$» — хвост предыдущей цены, игнорируем
    if (/^[€$₽]\s*$/.test(l) || /^EUR\s*$/i.test(l) || /^RUB\s*$/i.test(l)) {
      continue;
    }
    // Одиночные BTW-коды на отдельной строке (B, A, BB и т.д.)
    if (/^\s*[A-Z][A-Z0-9]?\s*$/.test(l)) continue;

    if (isPriceOnlyLine(l)) {
      const p = priceOnlyValue(l);
      if (p === null) continue;
      if (!looksLikePrice(p)) continue;
      // Не считаем итог позицией
      if (total !== null && Math.abs(p - total) < 0.01) continue;
      prices.push(p);
      continue;
    }

    if (looksLikeProductName(l)) {
      // Однострочное «Молоко 1,29» — игнорируем здесь, оно уже было обработано
      // в parseAll. Если parseAll не справился, а тут такие строки — лучше
      // оставить «как есть»: имя без цены не добавляем.
      const hasTrailingPrice = /\d[.,]\d{2}\s*(?:€|EUR)?\s*$/.test(l);
      if (hasTrailingPrice) continue;
      // Скидочные строки НЕ добавляем как имя в параллельных колонках —
      // их отрицательная цена уже в массиве prices и будет привязана по индексу.
      // Если добавить скидку как имя — сдвинется матчинг (10 имён vs 9 цен).
      if (isDiscountLine(l)) continue;
      names.push(l);
    }
  }

  // Склейка имён-продолжений: если имён больше чем цен, склеиваем пары,
  // где второе имя начинается со строчной буквы (latin или кириллица).
  while (names.length > prices.length && names.length >= 2) {
    let merged = false;
    for (let i = 1; i < names.length; i++) {
      const next = names[i];
      const firstChar = next.charAt(0);
      const isLower =
        firstChar &&
        firstChar === firstChar.toLowerCase() &&
        firstChar !== firstChar.toUpperCase();
      if (isLower) {
        names[i - 1] = `${names[i - 1]} ${next}`;
        names.splice(i, 1);
        merged = true;
        break;
      }
    }
    if (!merged) break;
  }

  if (names.length === 0 || prices.length === 0) return [];
  // Если всё-таки не сошлось по числу — берём min(names, prices)
  // (лучше показать половину чем ничего).
  const n = Math.min(names.length, prices.length);
  if (n < 2) return [];

  const out: ItemCandidate[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ name: names[i], price: prices[i] });
  }
  return out;
}

/**
 * Возвращает индекс строки с итогом (первое вхождение).
 * Парсинг товаров идёт ТОЛЬКО до этой строки, чтобы мусор после
 * («POI», «BS…», номера терминала, токены) не попал в позиции.
 */
function findTotalLineIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (
      /^\s*(итого|total|totaal|subtotaal|te\s*betalen|сумма\s*к\s*оплате|к\s*оплате)\b/i.test(
        lines[i],
      )
    ) {
      return i;
    }
  }
  return lines.length;
}

/**
 * Предобработка OCR-текста: склейка разорванных строк.
 * OCR иногда разбивает число на несколько строк:
 *   «3»        «-2»        «3»
 *   «,73»      «,07»       «€»
 *                           «,73»
 *                           «€»
 * Склеиваем такие группы в одну строку-цену.
 *
 * Также: строки, состоящие только из «€» между частями числа — удаляем.
 */
function preprocessOcrText(text: string): string {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].trim();

    // Паттерн: число (1-4 цифры, опц. минус) → опц. «€» → «,XX» или «.XX» → опц. «€» «B»
    // Собираем вперёд, склеивая «€» и «,XX» строки
    if (/^-?\d{1,4}$/.test(current)) {
      let combined = current;
      let j = i + 1;

      // Пропускаем «€» между числом и десятичной частью
      while (j < lines.length && /^\s*€\s*$/.test(lines[j])) {
        j++;
      }

      // Ожидаем «,XX» или «.XX» (десятичная часть)
      if (j < lines.length && /^\s*[.,]\d{2}\s*(?:€|EUR)?\s*(?:[A-Z]{1,2})?\s*$/.test(lines[j])) {
        combined += lines[j].trim().replace(/€/g, ' ').trim();
        j++;

        // Пропускаем ещё «€» после десятичной части
        while (j < lines.length && /^\s*€\s*$/.test(lines[j])) {
          j++;
        }

        result.push(combined);
        i = j - 1; // перепрыгиваем обработанные строки
      } else {
        result.push(lines[i]);
      }
    }
    // Одиночные «€» — пропускаем (они уже были обработаны выше или не несут смысла)
    else if (/^\s*€\s*$/.test(current)) {
      // Проверяем: может это «€» перед «,XX» (часть разбитой цены)
      const next = lines[i + 1]?.trim();
      if (next && /^[.,]\d{2}/.test(next)) {
        // Пропускаем — будет обработано когда дойдём до числа перед этим €
        // Но если числа перед этим не было — просто пропускаем €
        continue;
      }
      // Иначе пропускаем одиночный €
      continue;
    } else {
      result.push(lines[i]);
    }
  }

  return result.join('\n');
}

export function parseReceiptText(text: string): ParsedReceipt {
  const { storeName, currency } = detectStoreAndCurrency(text);
  const purchaseDate = detectDate(text);
  const totalAmount = detectTotal(text);

  // Обрезаем текст до строки итога — позиции находятся ВЫШЕ итога,
  // ниже идут служебные строки (POI, токены, штрих-коды, реквизиты карты).
  const allLines = text.split(/\r?\n/);
  const cutoff = findTotalLineIndex(allLines);
  const itemsText = preprocessOcrText(allLines.slice(0, cutoff).join('\n'));

  // Стратегия 1 — построчно (название + цена близко друг к другу).
  // Хорошо работает для AH/Jumbo/российских чеков и для ALDI когда
  // OCR не «таблицует».
  let items = parseAll(itemsText, totalAmount);

  // Если основная стратегия дала мало результатов, пробуем «параллельные
  // колонки»: OCR мог расщепить чек на два блока (все имена → все цены).
  if (items.length <= 1) {
    const parallel = parseParallelColumns(itemsText, totalAmount);
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
