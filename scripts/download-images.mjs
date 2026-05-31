import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'products');
const API_KEY = process.env.PEXELS_API_KEY;

if (!API_KEY) { console.error('❌ PEXELS_API_KEY не задан'); process.exit(1); }

let sharp = null;
try { const s = await import('sharp'); sharp = s.default; console.log('✅ sharp OK'); }
catch { console.warn('⚠️  sharp not found — saving JPEG'); }

const PRODUCTS = [
  { key: "vegetables/potato", q: "fresh raw potato food" },
  { key: "vegetables/carrot", q: "fresh raw carrot" },
  { key: "vegetables/onion", q: "fresh raw onion" },
  { key: "vegetables/garlic", q: "fresh raw garlic bulb" },
  { key: "vegetables/tomato", q: "fresh raw tomatoes red" },
  { key: "vegetables/cucumber", q: "fresh raw cucumber" },
  { key: "vegetables/broccoli", q: "fresh raw broccoli" },
  { key: "vegetables/cabbage", q: "fresh raw cabbage head" },
  { key: "vegetables/cauliflower", q: "fresh raw cauliflower" },
  { key: "vegetables/bell-pepper", q: "fresh colorful bell peppers" },
  { key: "vegetables/zucchini", q: "fresh raw zucchini courgette" },
  { key: "vegetables/eggplant", q: "fresh raw eggplant aubergine" },
  { key: "vegetables/beet", q: "fresh raw beetroot red" },
  { key: "vegetables/spinach", q: "fresh raw spinach leaves" },
  { key: "vegetables/pumpkin", q: "fresh raw pumpkin" },
  { key: "vegetables/corn", q: "fresh raw corn cob" },
  { key: "vegetables/mushroom", q: "fresh raw mushrooms" },
  { key: "vegetables/asparagus", q: "fresh green asparagus" },
  { key: "vegetables/sweet-potato", q: "fresh raw sweet potato" },
  { key: "vegetables/peas", q: "fresh green peas" },
  { key: "fruits/apple", q: "fresh red apple fruit" },
  { key: "fruits/banana", q: "fresh yellow banana" },
  { key: "fruits/orange", q: "fresh orange citrus" },
  { key: "fruits/lemon", q: "fresh yellow lemon" },
  { key: "fruits/grape", q: "fresh grapes cluster" },
  { key: "fruits/strawberry", q: "fresh strawberries red" },
  { key: "fruits/raspberry", q: "fresh raspberries" },
  { key: "fruits/blueberry", q: "fresh blueberries" },
  { key: "fruits/cherry", q: "fresh red cherries" },
  { key: "fruits/peach", q: "fresh peach fruit" },
  { key: "fruits/pear", q: "fresh pear fruit" },
  { key: "fruits/plum", q: "fresh plum fruit" },
  { key: "fruits/mango", q: "fresh mango fruit" },
  { key: "fruits/pineapple", q: "fresh whole pineapple" },
  { key: "fruits/watermelon", q: "fresh watermelon" },
  { key: "fruits/kiwi", q: "fresh kiwi fruit" },
  { key: "fruits/avocado", q: "fresh avocado halved" },
  { key: "meat/chicken-breast", q: "raw chicken breast meat" },
  { key: "meat/chicken-whole", q: "raw whole chicken" },
  { key: "meat/chicken-thigh", q: "raw chicken thighs" },
  { key: "meat/chicken-wings", q: "raw chicken wings" },
  { key: "meat/beef-steak", q: "raw beef steak" },
  { key: "meat/beef-mince", q: "raw minced beef" },
  { key: "meat/pork-loin", q: "raw pork loin" },
  { key: "meat/ground-meat", q: "raw ground meat" },
  { key: "meat/lamb", q: "raw lamb meat" },
  { key: "meat/turkey", q: "raw turkey meat" },
  { key: "meat/sausage", q: "raw fresh sausages" },
  { key: "meat/bacon", q: "raw bacon strips" },
  { key: "fish/salmon", q: "fresh raw salmon fillet" },
  { key: "fish/tuna", q: "fresh raw tuna steak" },
  { key: "fish/cod", q: "fresh raw cod fish" },
  { key: "fish/herring", q: "fresh raw herring fish" },
  { key: "fish/mackerel", q: "fresh raw mackerel" },
  { key: "fish/trout", q: "fresh raw trout fish" },
  { key: "fish/shrimp", q: "fresh raw shrimp prawns" },
  { key: "fish/squid", q: "fresh raw squid calamari" },
  { key: "dairy/milk", q: "glass fresh milk white" },
  { key: "dairy/eggs", q: "fresh chicken eggs" },
  { key: "dairy/butter", q: "fresh butter block" },
  { key: "dairy/cheese", q: "fresh cheese block" },
  { key: "dairy/cottage-cheese", q: "fresh cottage cheese" },
  { key: "dairy/sour-cream", q: "fresh sour cream" },
  { key: "dairy/yogurt", q: "fresh plain yogurt" },
  { key: "dairy/kefir", q: "glass of kefir" },
  { key: "dairy/cream", q: "fresh heavy cream" },
  { key: "dairy/mozzarella", q: "fresh mozzarella cheese" },
  { key: "dairy/feta", q: "fresh feta cheese" },
  { key: "grains/rice", q: "raw white rice grains" },
  { key: "grains/buckwheat", q: "raw buckwheat groats" },
  { key: "grains/oatmeal", q: "raw oat flakes" },
  { key: "grains/pasta", q: "raw dry pasta" },
  { key: "grains/spaghetti", q: "raw dry spaghetti" },
  { key: "grains/flour", q: "wheat flour bowl" },
  { key: "grains/bread", q: "fresh baked bread loaf" },
  { key: "grains/lentils", q: "raw red lentils" },
  { key: "grains/chickpeas", q: "raw chickpeas" },
  { key: "grains/beans", q: "raw dried beans" },
  { key: "oils/sunflower-oil", q: "sunflower oil" },
  { key: "oils/olive-oil", q: "olive oil" },
  { key: "oils/honey", q: "fresh honey golden" },
  { key: "oils/ketchup", q: "tomato ketchup sauce" },
  { key: "oils/mayonnaise", q: "mayonnaise white" },
  { key: "oils/mustard", q: "yellow mustard jar" },
  { key: "spices/salt", q: "sea salt crystals" },
  { key: "spices/sugar", q: "white sugar crystals" },
  { key: "spices/black-pepper", q: "black pepper corns" },
  { key: "spices/cinnamon", q: "cinnamon sticks" },
  { key: "spices/turmeric", q: "turmeric powder yellow" },
  { key: "beverages/water", q: "clear glass of water" },
  { key: "beverages/juice", q: "fresh orange juice glass" },
  { key: "beverages/tea", q: "loose leaf tea dry" },
  { key: "beverages/coffee", q: "roasted coffee beans" },
  { key: "nuts/walnut", q: "raw walnuts shelled" },
  { key: "nuts/almond", q: "raw almonds" },
  { key: "nuts/hazelnut", q: "raw hazelnuts" },
  { key: "nuts/raisins", q: "dried raisins" },
  { key: "sweets/chocolate", q: "dark chocolate bar" },
  { key: "frozen/dumplings", q: "raw dumplings uncooked" },
  { key: "frozen/frozen-berries", q: "frozen mixed berries" },
  { key: "frozen/ice-cream", q: "ice cream scoop" },
  { key: "greens/dill", q: "fresh dill herbs" },
  { key: "greens/parsley", q: "fresh parsley herbs" },
  { key: "greens/basil", q: "fresh basil leaves" },
  { key: "greens/cilantro", q: "fresh cilantro coriander" },
  { key: "greens/green-onion", q: "fresh spring onions" },
  { key: "greens/lettuce", q: "fresh lettuce leaves" },
  { key: "greens/mint", q: "fresh mint leaves" },
];

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ChefDom/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) { download(res.headers.location).then(resolve).catch(reject); return; }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function pexelsSearch(q) {
  return new Promise((resolve) => {
    const opts = { hostname: 'api.pexels.com', path: `/v1/search?query=${encodeURIComponent(q)}&per_page=3&orientation=square`, headers: { Authorization: API_KEY } };
    https.get(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { const j = JSON.parse(d); resolve(j.photos?.[0]?.src?.large2x || j.photos?.[0]?.src?.large || null); } catch { resolve(null); } });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

const FROM = parseInt(process.env.FROM || '0');
const TO = process.env.TO ? parseInt(process.env.TO) : PRODUCTS.length;
const batch = PRODUCTS.slice(FROM, TO);

console.log(`\n🍽️  ChefDom Image Downloader — ${batch.length} продуктов\n`);
ensureDir(OUTPUT_DIR);

let ok = 0, skip = 0, fail = 0;

for (let i = 0; i < batch.length; i++) {
  const { key, q } = batch[i];
  const cat = key.split('/')[0];
  ensureDir(path.join(OUTPUT_DIR, cat));

  const outW = path.join(OUTPUT_DIR, `${key}.webp`);
  const outJ = path.join(OUTPUT_DIR, `${key}.jpg`);
  if (fs.existsSync(outW) || fs.existsSync(outJ)) { console.log(`[${FROM+i+1}] ⏭  ${key}`); skip++; continue; }

  console.log(`[${FROM+i+1}] 🔍 ${key}`);
  const url = await pexelsSearch(q);
  if (!url) { console.warn(`  ⚠️  не найдено`); fail++; await new Promise(r => setTimeout(r, 300)); continue; }

  try {
    const buf = await download(url);
    if (sharp) { await sharp(buf).resize(800, 800, { fit: 'cover' }).webp({ quality: 85 }).toFile(outW); console.log(`  ✅ .webp`); }
    else { fs.writeFileSync(outJ, buf); console.log(`  ✅ .jpg`); }
    ok++;
  } catch (e) { console.error(`  ❌ ${e.message}`); fail++; }

  await new Promise(r => setTimeout(r, 600));
}

console.log(`\n✅ скачано ${ok}, пропущено ${skip}, ошибок ${fail}`);
