/**
 * Download Product Image Library from Pexels
 *
 * Запуск:
 *   PEXELS_API_KEY=ваш_ключ npx tsx scripts/download-product-images.ts
 *
 * Что делает:
 *   1. Читает PRODUCT_DICTIONARY
 *   2. Для каждого продукта ищет фото через Pexels API
 *   3. Скачивает первое подходящее фото
 *   4. Конвертирует в WebP 800x800
 *   5. Сохраняет в /public/images/products/{category}/{key}.webp
 *   6. Пропускает если файл уже существует (безопасный перезапуск)
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { PRODUCT_DICTIONARY, type ProductImageEntry } from './product-dictionary.js';

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error('❌ PEXELS_API_KEY не задан. Запусти: PEXELS_API_KEY=ключ npx tsx scripts/download-product-images.ts');
  process.exit(1);
}

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');

// Pexels поддерживает разные размеры. Берём "large2x" (1880px) и ресайзим.
// Если sharp не установлен — сохраняем как есть (jpeg).
let sharp: any = null;
try {
  sharp = (await import('sharp')).default;
  console.log('✅ sharp доступен — конвертация в WebP 800x800');
} catch {
  console.warn('⚠️  sharp не установлен — сохраняем оригинал (jpeg). Для WebP: npm install sharp');
}

// ═══ Утилиты ═══

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function download(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ChefDom/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function searchPexels(query: string): Promise<string | null> {
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    const options = {
      hostname: 'api.pexels.com',
      path: `/v1/search?query=${encodedQuery}&per_page=3&orientation=square`,
      headers: { Authorization: API_KEY },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const photos = json.photos;
          if (!photos || photos.length === 0) { resolve(null); return; }
          // Берём первое фото — large для качества
          const photo = photos[0];
          resolve(photo.src.large2x || photo.src.large || photo.src.medium);
        } catch {
          resolve(null);
        }
      });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

async function processEntry(entry: ProductImageEntry, index: number, total: number): Promise<'downloaded' | 'skipped' | 'failed'> {
  const categoryDir = path.join(OUTPUT_DIR, entry.category);
  ensureDir(categoryDir);

  const outputPath = path.join(OUTPUT_DIR, `${entry.key}.webp`);
  const outputPathJpeg = path.join(OUTPUT_DIR, `${entry.key}.jpg`);

  // Пропускаем если уже есть
  if (fs.existsSync(outputPath) || fs.existsSync(outputPathJpeg)) {
    console.log(`[${index}/${total}] ⏭  ${entry.key} — уже скачан`);
    return 'skipped';
  }

  console.log(`[${index}/${total}] 🔍 ${entry.key} — ищу: "${entry.query}"`);

  const photoUrl = await searchPexels(entry.query);
  if (!photoUrl) {
    console.warn(`[${index}/${total}] ⚠️  ${entry.key} — не найдено`);
    return 'failed';
  }

  try {
    const buffer = await download(photoUrl);

    if (sharp) {
      await sharp(buffer)
        .resize(800, 800, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toFile(outputPath);
      console.log(`[${index}/${total}] ✅ ${entry.key}.webp (800x800)`);
    } else {
      fs.writeFileSync(outputPathJpeg, buffer);
      console.log(`[${index}/${total}] ✅ ${entry.key}.jpg (оригинал)`);
    }
    return 'downloaded';
  } catch (err) {
    console.error(`[${index}/${total}] ❌ ${entry.key} — ошибка: ${err}`);
    return 'failed';
  }
}

// ═══ Placeholder ═══
async function createPlaceholder() {
  const placeholderPath = path.join(OUTPUT_DIR, 'placeholder.webp');
  if (fs.existsSync(placeholderPath)) return;

  console.log('📦 Создаю placeholder...');
  if (sharp) {
    // Тёмный нейтральный квадрат 800x800
    await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 4,
        background: { r: 34, g: 43, b: 59, alpha: 1 },
      },
    })
      .webp({ quality: 80 })
      .toFile(placeholderPath);
    console.log('✅ placeholder.webp создан');
  } else {
    // Минимальный WebP через raw bytes (1x1 тёмный пиксель)
    const minimalWebP = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c,
    ]);
    fs.writeFileSync(placeholderPath, minimalWebP);
    console.log('✅ placeholder.webp (минимальный)');
  }
}

// ═══ Main ═══
async function main() {
  console.log('');
  console.log('🍽️  ChefDom Product Image Library Downloader');
  console.log('═══════════════════════════════════════════');
  console.log(`📁 Папка: ${OUTPUT_DIR}`);
  console.log(`📋 Продуктов в словаре: ${PRODUCT_DICTIONARY.length}`);
  console.log('');

  ensureDir(OUTPUT_DIR);
  await createPlaceholder();

  // Создаём папки для всех категорий
  const categories = [...new Set(PRODUCT_DICTIONARY.map(e => e.category))];
  for (const cat of categories) {
    ensureDir(path.join(OUTPUT_DIR, cat));
  }

  // Определяем диапазон (можно запустить частями: FROM=0 TO=50)
  const FROM = parseInt(process.env.FROM || '0');
  const TO = parseInt(process.env.TO || String(PRODUCT_DICTIONARY.length));
  const batch = PRODUCT_DICTIONARY.slice(FROM, TO);

  console.log(`🚀 Скачиваю: ${FROM}..${FROM + batch.length} из ${PRODUCT_DICTIONARY.length}`);
  console.log('');

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const entry = batch[i];
    const result = await processEntry(entry, FROM + i + 1, PRODUCT_DICTIONARY.length);

    if (result === 'downloaded') downloaded++;
    else if (result === 'skipped') skipped++;
    else failed++;

    // Пауза между запросами — уважаем rate limit Pexels (200/час)
    if (result === 'downloaded' || result === 'failed') {
      await new Promise(r => setTimeout(r, 500)); // 0.5 сек = ~120 в минуту
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`✅ Готово!`);
  console.log(`   Скачано:  ${downloaded}`);
  console.log(`   Пропущено: ${skipped}`);
  console.log(`   Ошибки:   ${failed}`);
  console.log('');
}

main().catch(console.error);
