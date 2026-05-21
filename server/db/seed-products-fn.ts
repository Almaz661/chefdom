// Импорт товаров из Open Food Facts (G.2)
// Вызывается через /api/seed-products
// Open Food Facts — полностью бесплатно, без ключа.

import { client } from './index';

const OFF_API = 'https://world.openfoodfacts.org/cgi/search.pl';

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

function parseQuantity(qty: string | undefined): { amount: number | null; unit: string | null } {
  if (!qty) return { amount: null, unit: null };
  const m = qty.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Zа-яА-Я]+)/);
  if (!m) return { amount: null, unit: null };
  return { amount: parseFloat(m[1].replace(',', '.')), unit: m[2].toLowerCase() };
}

export async function runSeedProducts(): Promise<void> {
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

      for (const p of data.products) {
        const barcode = p.code?.trim();
        const nameRu = p.product_name_ru?.trim() || p.product_name?.trim();
        if (!barcode || !nameRu || barcode === '0') continue;

        const nameNl = p.product_name_nl?.trim() || null;
        const brand = p.brands?.trim() || null;
        const imageUrl = p.image_url?.trim() || null;
        const { amount, unit } = parseQuantity(p.quantity);

        try {
          await client`
            INSERT INTO products (barcode, name_ru, name_nl, brand, package_quantity, package_unit, image_url, off_id)
            VALUES (${barcode}, ${nameRu}, ${nameNl}, ${brand}, ${amount}, ${unit}, ${imageUrl}, ${barcode})
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
