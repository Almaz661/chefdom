// Импорт товаров из Open Food Facts (G.2) с переводом на русский через DeepL
// Вызывается через /api/seed-products

import { client } from './index';

const OFF_API = 'https://world.openfoodfacts.org/cgi/search.pl';
const DEEPL_API = 'https://api-free.deepl.com/v2/translate';

const CATEGORIES = [
  'dairy', 'meats', 'fish', 'vegetables', 'fruits',
  'cereals', 'breads', 'beverages', 'snacks', 'condiments',
  'frozen-foods', 'canned-foods', 'pasta', 'oils',
];

interface OFFProduct {
  code: string;
  product_name_ru?: string;
  product_name_nl?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  image_url?: string;
}

interface OFFResponse {
  products: OFFProduct[];
}

async function fetchCategory(category: string, page: number): Promise<OFFResponse> {
  const params = new URLSearchParams({
    action: 'process',
    tagtype_0: 'categories',
    tag_contains_0: 'contains',
    tag_0: category,
    fields: 'code,product_name_ru,product_name_nl,product_name,brands,quantity,image_url',
    json: '1',
    page_size: '100',
    page: String(page),
  });

  const res = await fetch(`${OFF_API}?${params}`, {
    headers: { 'User-Agent': 'ShefDom/1.0 (home kitchen app)' },
  });
  if (!res.ok) throw new Error(`OFF HTTP ${res.status}`);
  return res.json() as Promise<OFFResponse>;
}

// Пакетный перевод через DeepL — переводим сразу до 50 строк за раз
async function translateBatch(texts: string[], apiKey: string): Promise<string[]> {
  if (texts.length === 0) return [];
  try {
    const body = new URLSearchParams();
    body.append('target_lang', 'RU');
    for (const t of texts) body.append('text', t);

    const res = await fetch(DEEPL_API, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      console.error(`[deepl] HTTP ${res.status}`);
      return texts; // fallback — оставляем оригинал
    }

    const data = await res.json() as { translations: { text: string }[] };
    return data.translations.map(t => t.text);
  } catch (e) {
    console.error('[deepl] Ошибка перевода:', e);
    return texts; // fallback
  }
}

function parseQuantity(qty: string | undefined): { amount: number | null; unit: string | null } {
  if (!qty) return { amount: null, unit: null };
  const m = qty.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Zа-яА-Я]+)/);
  if (!m) return { amount: null, unit: null };
  return { amount: parseFloat(m[1].replace(',', '.')), unit: m[2].toLowerCase() };
}

export async function runSeedProducts(): Promise<void> {
  const deeplKey = process.env.DEEPL_API_KEY;
  if (!deeplKey) {
    console.error('[seed-products] DEEPL_API_KEY не задан — товары будут без перевода');
  }

  console.log('[seed-products] Начинаю импорт из Open Food Facts...');
  let inserted = 0;

  for (const cat of CATEGORIES) {
    let page = 1;
    const maxPages = 3;

    while (page <= maxPages) {
      let data: OFFResponse;
      try {
        data = await fetchCategory(cat, page);
      } catch (e) {
        console.error(`[seed-products] Ошибка ${cat} стр.${page}:`, e);
        break;
      }

      if (!data.products || data.products.length === 0) break;

      // Собираем товары которые нуждаются в переводе
      const toProcess: { barcode: string; nameEn: string; nameNl: string | null; brand: string | null; imageUrl: string | null; amount: number | null; unit: string | null }[] = [];

      for (const p of data.products) {
        const barcode = p.code?.trim();
        if (!barcode || barcode === '0') continue;

        // Если есть русское название — используем его, иначе переводим
        const nameRuOriginal = p.product_name_ru?.trim();
        const nameEn = p.product_name?.trim() || p.product_name_nl?.trim() || '';
        if (!nameRuOriginal && !nameEn) continue;

        toProcess.push({
          barcode,
          nameEn: nameRuOriginal || nameEn, // если есть рус — не переводим
          nameNl: p.product_name_nl?.trim() || null,
          brand: p.brands?.trim() || null,
          imageUrl: p.image_url?.trim() || null,
          ...parseQuantity(p.quantity),
        });
      }

      // Переводим только те у которых нет русского названия
      const needTranslation = toProcess.filter(p => {
        const hasRu = data.products.find(d => d.code === p.barcode)?.product_name_ru?.trim();
        return !hasRu && deeplKey;
      });

      let translations: string[] = [];
      if (needTranslation.length > 0 && deeplKey) {
        // Пакетами по 50
        const batches: string[][] = [];
        for (let i = 0; i < needTranslation.length; i += 50) {
          batches.push(needTranslation.slice(i, i + 50).map(p => p.nameEn));
        }
        for (const batch of batches) {
          const translated = await translateBatch(batch, deeplKey);
          translations.push(...translated);
        }
      }

      let transIdx = 0;
      for (const p of toProcess) {
        const hasRu = data.products.find(d => d.code === p.barcode)?.product_name_ru?.trim();
        let nameRu: string;

        if (hasRu) {
          nameRu = hasRu;
        } else if (deeplKey && translations.length > transIdx) {
          nameRu = translations[transIdx++];
        } else {
          nameRu = p.nameEn;
        }

        if (!nameRu) continue;

        try {
          await client`
            INSERT INTO products (barcode, name_ru, name_nl, brand, package_quantity, package_unit, image_url, off_id)
            VALUES (${p.barcode}, ${nameRu}, ${p.nameNl}, ${p.brand}, ${p.amount}, ${p.unit}, ${p.imageUrl}, ${p.barcode})
            ON CONFLICT (barcode) DO UPDATE SET
              name_ru = EXCLUDED.name_ru,
              name_nl = EXCLUDED.name_nl,
              brand = EXCLUDED.brand,
              image_url = EXCLUDED.image_url
          `;
          inserted++;
        } catch (_e) {
          // пропускаем дубли
        }
      }

      await new Promise(r => setTimeout(r, 500));
      page++;
    }
    console.log(`[seed-products] ${cat}: готово`);
  }

  console.log(`[seed-products] Завершено. Добавлено/обновлено: ${inserted}`);
}
