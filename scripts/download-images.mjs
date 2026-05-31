/**
 * Download Product Images from Pexels
 * Pure ESM script — no tsx needed, runs with: node scripts/download-images.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'products');

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error('❌ PEXELS_API_KEY не задан');
  process.exit(1);
}

// Try to load sharp
let sharp = null;
try {
  const s = await import('sharp');
  sharp = s.default;
  console.log('✅ sharp loaded');
} catch {
  console.warn('⚠️  sharp not available — saving as JPEG');
}

// ═══ Product dictionary — inline ═══
const PRODUCTS = [
  // vegetables
  { key: "vegetables/potato", query: "fresh raw potato food", cat: "vegetables" },
  { key: "vegetables/carrot", query: "fresh raw carrot vegetable", cat: "vegetables" },
  { key: "vegetables/onion", query: "fresh raw onion vegetable", cat: "vegetables" },
  { key: "vegetables/garlic", query: "fresh raw garlic bulb", cat: "vegetables" },
  { key: "vegetables/tomato", query: "fresh raw tomatoes red", cat: "vegetables" },
  { key: "vegetables/cucumber", query: "fresh raw cucumber", cat: "vegetables" },
  { key: "vegetables/broccoli", query: "fresh raw broccoli", cat: "vegetables" },
  { key: "vegetables/cabbage", query: "fresh raw cabbage head", cat: "vegetables" },
  { key: "vegetables/cauliflower", query: "fresh raw cauliflower", cat: "vegetables" },
  { key: "vegetables/bell-pepper", query: "fresh raw colorful bell peppers", cat: "vegetables" },
  { key: "vegetables/zucchini", query: "fresh raw zucchini courgette", cat: "vegetables" },
  { key: "vegetables/eggplant", query: "fresh raw eggplant aubergine", cat: "vegetables" },
  { key: "vegetables/beet", query: "fresh raw beetroot red", cat: "vegetables" },
  { key: "vegetables/spinach", query: "fresh raw spinach leaves", cat: "vegetables" },
  { key: "vegetables/pumpkin", query: "fresh raw pumpkin", cat: "vegetables" },
  { key: "vegetables/corn", query: "fresh raw corn cob", cat: "vegetables" },
  { key: "vegetables/mushroom", query: "fresh raw mushrooms", cat: "vegetables" },
  { key: "vegetables/asparagus", query: "fresh raw asparagus green", cat: "vegetables" },
  { key: "vegetables/sweet-potato", query: "fresh raw sweet potato", cat: "vegetables" },
  { key: "vegetables/peas", query: "fresh green peas", cat: "vegetables" },
  // fruits
  { key: "fruits/apple", query: "fresh red apple fruit", cat: "fruits" },
  { key: "fruits/banana", query: "fresh yellow banana", cat: "fruits" },
  { key: "fruits/orange", query: "fresh orange citrus fruit", cat: "fruits" },
  { key: "fruits/lemon", query: "fresh yellow lemon", cat: "fruits" },
  { key: "fruits/grape", query: "fresh grapes cluster", cat: "fruits" },
  { key: "fruits/strawberry", query: "fresh strawberries red", cat: "fruits" },
  { key: "fruits/raspberry", query: "fresh raspberries", cat: "fruits" },
  { key: "fruits/blueberry", query: "fresh blueberries", cat: "fruits" },
  { key: "fruits/cherry", query: "fresh red cherries", cat: "fruits" },
  { key: "fruits/peach", query: "fresh peach fruit", cat: "fruits" },
  { key: "fruits/pear", query: "fresh pear fruit", cat: "fruits" },
  { key: "fruits/plum", query: "fresh plum fruit", cat: "fruits" },
  { key: "fruits/mango", query: "fresh mango fruit", cat: "fruits" },
  { key: "fruits/pineapple", query: "fresh pineapple whole", cat: "fruits" },
  { key: "fruits/watermelon", query: "fresh watermelon", cat: "fruits" },
  { key: "fruits/kiwi", query: "fresh kiwi fruit", cat: "fruits" },
  { key: "fruits/avocado", query: "fresh avocado halved", cat: "fruits" },
  // meat
  { key: "meat/chicken-breast", query: "raw chicken breast meat", cat: "meat" },
  { key: "meat/chicken-whole", query: "raw whole chicken", cat: "meat" },
  { key: "meat/chicken-thigh", query: "raw chicken thighs", cat: "meat" },
  { key: "meat/chicken-wings", query: "raw chicken wings", cat: "meat" },
  { key: "meat/beef-steak", query: "raw beef steak meat", cat: "meat" },
  { key: "meat/beef-mince", query: "raw minced beef meat", cat: "meat" },
  { key: "meat/pork-loin", query: "raw pork loin", cat: "meat" },
  { key: "meat/ground-meat", query: "raw ground meat minced", cat: "meat" },
  { key: "meat/lamb", query: "raw lamb meat", cat: "meat" },
  { key: "meat/turkey", query: "raw turkey meat", cat: "meat" },
  { key: "meat/sausage", query: "raw fresh sausages", cat: "meat" },
  { key: "meat/bacon", query: "raw bacon strips", cat: "meat" },
  // fish
  { key: "fish/salmon", query: "fresh raw salmon fillet", cat: "fish" },
  { key: "fish/tuna", query: "fresh raw tuna steak", cat: "fish" },
  { key: "fish/cod", query: "fresh raw cod fish fillet", cat: "fish" },
  { key: "fish/herring", query: "fresh raw herring fish", cat: "fish" },
  { key: "fish/mackerel", query: "fresh raw mackerel fish", cat: "fish" },
  { key: "fish/trout", query: "fresh raw trout fish", cat: "fish" },
  { key: "fish/shrimp", query: "fresh raw shrimp prawns", cat: "fish" },
  { key: "fish/squid", query: "fresh raw squid calamari", cat: "fish" },
  // dairy
  { key: "dairy/milk", query: "glass of fresh milk white", cat: "dairy" },
  { key: "dairy/eggs", query: "fresh chicken eggs", cat: "dairy" },
  { key: "dairy/butter", query: "fresh butter block yellow", cat: "dairy" },
  { key: "dairy/cheese", query: "fresh cheese block", cat: "dairy" },
  { key: "dairy/cottage-cheese", query: "fresh cottage cheese bowl", cat: "dairy" },
  { key: "dairy/sour-cream", query: "fresh sour cream bowl", cat: "dairy" },
  { key: "dairy/yogurt", query: "fresh plain yogurt bowl", cat: "dairy" },
  { key: "dairy/kefir", query: "glass of kefir milk", cat: "dairy" },
  { key: "dairy/cream", query: "fresh heavy cream", cat: "dairy" },
  { key: "dairy/mozzarella", query: "fresh mozzarella cheese ball", cat: "dairy" },
  { key: "dairy/feta", query: "fresh feta cheese block", cat: "dairy" },
  // grains
  { key: "grains/rice", query: "raw white rice grains bowl", cat: "grains" },
  { key: "grains/buckwheat", query: "raw buckwheat groats", cat: "grains" },
  { key: "grains/oatmeal", query: "raw oat flakes oatmeal", cat: "grains" },
  { key: "grains/pasta", query: "raw dry pasta uncooked", cat: "grains" },
  { key: "grains/spaghetti", query: "raw dry spaghetti pasta", cat: "grains" },
  { key: "grains/flour", query: "wheat flour in bowl white", cat: "grains" },
  { key: "grains/bread", query: "fresh baked bread loaf", cat: "grains" },
  { key: "grains/lentils", query: "raw red lentils", cat: "grains" },
  { key: "grains/chickpeas", query: "raw chickpeas", cat: "grains" },
  { key: "grains/beans", query: "raw dried beans", cat: "grains" },
  // oils & condiments
  { key: "oils/sunflower-oil", query: "sunflower oil in bowl", cat: "oils" },
  { key: "oils/olive-oil", query: "olive oil bottle green", cat: "oils" },
  { key: "oils/honey", query: "fresh honey jar golden", cat: "oils" },
  { key: "oils/ketchup", query: "tomato ketchup sauce", cat: "oils" },
  { key: "oils/mayonnaise", query: "mayonnaise white sauce", cat: "oils" },
  { key: "oils/mustard", query: "yellow mustard jar", cat: "oils" },
  // spices
  { key: "spices/salt", query: "sea salt crystals white", cat: "spices" },
  { key: "spices/sugar", query: "white sugar crystals", cat: "spices" },
  { key: "spices/black-pepper", query: "black pepper corns", cat: "spices" },
  { key: "spices/cinnamon", query: "cinnamon sticks spice", cat: "spices" },
  { key: "spices/turmeric", query: "turmeric powder yellow spice", cat: "spices" },
  // beverages
  { key: "beverages/water", query: "clear glass of water", cat: "beverages" },
  { key: "beverages/juice", query: "fresh fruit juice orange glass", cat: "beverages" },
  { key: "beverages/tea", query: "loose leaf tea dry", cat: "beverages" },
  { key: "beverages/coffee", query: "roasted coffee beans", cat: "beverages" },
  // nuts
  { key: "nuts/walnut", query: "raw walnuts shelled", cat: "nuts" },
  { key: "nuts/almond", query: "raw almonds", cat: "nuts" },
  { key: "nuts/hazelnut", query: "raw hazelnuts", cat: "nuts" },
  { key: "nuts/raisins", query: "dried raisins", cat: "nuts" },
  // sweets
  { key: "sweets/chocolate", query: "dark chocolate bar broken", cat: "sweets" },
  // frozen
  { key: "frozen/dumplings", query: "raw dumplings uncooked", cat: "frozen" },
  { key: "frozen/frozen-berries", query: "frozen mixed berries", cat: "frozen" },
  { key: "frozen/ice-cream", query: "ice cream scoop bowl", cat: "frozen" },
  // greens
  { key: "greens/dill", query: "fresh dill herbs green", cat: "greens" },
  { key: "greens/parsley", query: "fresh parsley herbs", cat: "greens" },
  { key: "greens/basil", query: "fresh basil leaves green", cat: "greens" },
  { key: "greens/cilantro", query: "fresh cilantro coriander", cat: "greens" },
  { key: "greens/green-onion", query: "fresh green spring onions", cat: "greens" },
  { key: "greens/lettuce", query: "fresh lettuce leaves green", cat: "greens" },
  { key: "greens/mint", query: "fresh mint leaves", cat: "greens" },
];

// ═══ Utils ═══
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ChefDom/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function searchPexels(query) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(query);
    const opts = {
      hostname: 'api.pexels.com',
      path: `/v1/search?query=${q}&per_page=3&orientation=square`,
      headers: { Authorization: API_KEY },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const photos = json.photos;
          if (!photos?.length) { resolve(null); return; }
          resolve(photos[0].src.large2x || photos[0].src.large || photos[0].src.medium);
        } catch { resolve(null); }
      });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

// ═══ Main ═══
const FROM = parseInt(process.env.FROM || '0');
const TO = process.env.TO ? parseInt(process.env.TO) : PRODUCTS.length;
const batch = PRODUCTS.slice(FROM, TO);

console.log(`\n🍽️  ChefDom Product Image Downloader`);
console.log(`📋 Продуктов: ${batch.length} (${FROM}..${FROM + batch.length})`);
console.log(`📁 ${OUTPUT_DIR}\n`);

ensureDir(OUTPUT_DIR);

let downloaded = 0, skipped = 0, failed = 0;

for (let i = 0; i < batch.length; i++) {
  const { key, query, cat } = batch[i];
  const catDir = path.join(OUTPUT_DIR, cat);
  ensureDir(catDir);

  const outWebP = path.join(OUTPUT_DIR, `${key}.webp`);
  const outJPG = path.join(OUTPUT_DIR, `${key}.jpg`);

  if (fs.existsSync(outWebP) || fs.existsSync(outJPG)) {
    console.log(`[${FROM+i+1}/${PRODUCTS.length}] ⏭  ${key}`);
    skipped++;
    continue;
  }

  console.log(`[${FROM+i+1}/${PRODUCTS.length}] 🔍 ${key} — "${query}"`);
  const url = await searchPexels(query);

  if (!url) {
    console.warn(`  ⚠️  не найдено`);
    failed++;
    await new Promise(r => setTimeout(r, 300));
    continue;
  }

  try {
    const buf = await download(url);
    if (sharp) {
      await sharp(buf).resize(800, 800, { fit: 'cover' }).webp({ quality: 85 }).toFile(outWebP);
      console.log(`  ✅ ${key}.webp`);
    } else {
      fs.writeFileSync(outJPG, buf);
      console.log(`  ✅ ${key}.jpg`);
    }
    downloaded++;
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    failed++;
  }

  await new Promise(r => setTimeout(r, 600));
}

console.log(`\n✅ Готово: скачано ${downloaded}, пропущено ${skipped}, ошибок ${failed}`);
