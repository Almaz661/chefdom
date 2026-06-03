/**
 * Скрипт загрузки реальных фото продуктов.
 * Источники: Open Food Facts → Wikidata/Wikipedia → SVG placeholder.
 *
 * Запуск: npx tsx scripts/downloadProductImages.ts
 *
 * Логика:
 * 1. Берёт все продукты из inventory (уникальные названия)
 * 2. Проверяет есть ли уже фото в /public/images/products/
 * 3. Если нет — ищет в Open Food Facts API
 * 4. Если нет — ищет в Wikipedia API
 * 5. Скачивает и конвертирует в webp (или сохраняет как есть)
 *
 * Безопасно запускать повторно — скачивает только отсутствующие.
 */

import fs from 'fs';
import path from 'path';
import { client } from '../server/db/index';

const IMAGES_DIR = path.resolve(__dirname, '../public/images/products');
const DELAY_MS = 500; // пауза между запросами чтобы не забанили

// Нормализация имени файла
function toFileName(productName: string): string {
  return productName
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

// Проверить существует ли фото
function hasImage(productName: string): boolean {
  const base = toFileName(productName);
  const extensions = ['.webp', '.jpg', '.jpeg', '.png'];
  return extensions.some(ext => fs.existsSync(path.join(IMAGES_DIR, base + ext)));
}

// Поиск фото в Open Food Facts
async function searchOpenFoodFacts(query: string): Promise<string | null> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=1&fields=image_front_url,image_url`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChefDom/1.0 (contact@chefdom.app)' },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      products?: Array<{ image_front_url?: string; image_url?: string }>;
    };
    const product = data.products?.[0];
    return product?.image_front_url || product?.image_url || null;
  } catch {
    return null;
  }
}

// Поиск фото в Wikipedia
async function searchWikipedia(query: string): Promise<string | null> {
  try {
    // Пробуем русскую Wikipedia
    const url = `https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChefDom/1.0' },
    });
    if (!res.ok) {
      // Пробуем английскую
      const enUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const enRes = await fetch(enUrl, {
        headers: { 'User-Agent': 'ChefDom/1.0' },
      });
      if (!enRes.ok) return null;
      const enData = await enRes.json() as { thumbnail?: { source?: string } };
      return enData.thumbnail?.source || null;
    }
    const data = await res.json() as { thumbnail?: { source?: string } };
    return data.thumbnail?.source || null;
  } catch {
    return null;
  }
}

// Скачать файл по URL
async function downloadImage(imageUrl: string, savePath: string): Promise<boolean> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'ChefDom/1.0' },
    });
    if (!res.ok) return false;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('image')) return false;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) return false; // слишком маленький файл — placeholder

    fs.writeFileSync(savePath, buffer);
    return true;
  } catch {
    return false;
  }
}

// Определить расширение из URL
function getExtension(url: string): string {
  if (url.includes('.webp')) return '.webp';
  if (url.includes('.png')) return '.png';
  if (url.includes('.jpeg') || url.includes('.jpg')) return '.jpg';
  return '.jpg'; // default
}

async function main() {
  console.log('[download-images] Начинаю загрузку фото продуктов...');

  // Создаём директорию если нет
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Получаем уникальные названия продуктов из inventory
  const rows = await client<{ product_name: string }[]>`
    SELECT DISTINCT product_name FROM inventory
    UNION
    SELECT DISTINCT name_ru AS product_name FROM products WHERE name_ru IS NOT NULL
  `;

  const productNames = rows.map(r => r.product_name).filter(Boolean);
  console.log(`[download-images] Найдено ${productNames.length} уникальных продуктов`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const name of productNames) {
    // Пропускаем если фото уже есть
    if (hasImage(name)) {
      skipped++;
      continue;
    }

    const fileName = toFileName(name);
    if (!fileName) {
      failed++;
      continue;
    }

    console.log(`[download-images] Ищу фото для: "${name}"...`);

    // 1. Open Food Facts
    let imageUrl = await searchOpenFoodFacts(name);

    // 2. Wikipedia fallback
    if (!imageUrl) {
      imageUrl = await searchWikipedia(name);
    }

    if (!imageUrl) {
      console.log(`  → Не найдено`);
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    // 3. Скачиваем
    const ext = getExtension(imageUrl);
    const savePath = path.join(IMAGES_DIR, fileName + ext);

    const ok = await downloadImage(imageUrl, savePath);
    if (ok) {
      console.log(`  → Скачано: ${fileName}${ext}`);
      downloaded++;
    } else {
      console.log(`  → Ошибка загрузки`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n[download-images] Готово!`);
  console.log(`  Скачано: ${downloaded}`);
  console.log(`  Пропущено (уже есть): ${skipped}`);
  console.log(`  Не найдено: ${failed}`);

  process.exit(0);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('[download-images] Ошибка:', err);
  process.exit(1);
});
