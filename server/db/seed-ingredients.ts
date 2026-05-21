// Импорт ингредиентов из USDA FoodData Central.
// Запускается ВРУЧНУЮ через Render Shell:
//   npx tsx server/db/seed-ingredients.ts
// НЕ импортируется сервером — только ручной запуск.

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const API_KEY = process.env.USDA_API_KEY;

if (!DATABASE_URL) { console.error('DATABASE_URL не задан'); process.exit(1); }
if (!API_KEY) { console.error('USDA_API_KEY не задан'); process.exit(1); }

const client = postgres(DATABASE_URL, { ssl: 'require' });
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

const NUTRIENT_IDS = { KCAL: 1008, PROTEIN: 1003, FATS: 1004, CARBS: 1005, WATER: 1051 };

const CATEGORIES = [
  'Beef Products', 'Poultry Products', 'Pork Products',
  'Finfish and Shellfish Products', 'Dairy and Egg Products',
  'Vegetables and Vegetable Products', 'Fruits and Fruit Juices',
  'Legumes and Legume Products', 'Nut and Seed Products',
  'Cereal Grains and Pasta', 'Baked Products', 'Fats and Oils',
  'Spices and Herbs',
];

const CATEGORY_RU: Record<string, string> = {
  'Beef Products': 'Говядина',
  'Poultry Products': 'Птица',
  'Pork Products': 'Свинина',
  'Finfish and Shellfish Products': 'Рыба и морепродукты',
  'Dairy and Egg Products': 'Молочные и яйца',
  'Vegetables and Vegetable Products': 'Овощи',
  'Fruits and Fruit Juices': 'Фрукты',
  'Legumes and Legume Products': 'Бобовые',
  'Nut and Seed Products': 'Орехи и семена',
  'Cereal Grains and Pasta': 'Зерновые и макароны',
  'Baked Products': 'Выпечка',
  'Fats and Oils': 'Жиры и масла',
  'Spices and Herbs': 'Специи и травы',
};

interface UsdaFood {
  fdcId: number;
  description: string;
  foodNutrients?: { nutrientId: number; value: number }[];
}

async function fetchPage(category: string, page: number) {
  const url = `${BASE_URL}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(category)}&dataType=Foundation,SR%20Legacy&pageSize=50&pageNumber=${page}&nutrients=${Object.values(NUTRIENT_IDS).join(',')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  return res.json() as Promise<{ foods: UsdaFood[]; totalPages: number }>;
}

function getNutrient(food: UsdaFood, id: number) {
  return food.foodNutrients?.find(n => n.nutrientId === id)?.value ?? null;
}

async function main() {
  console.log('[seed-ingredients] Начинаю импорт из USDA...');
  let inserted = 0;

  for (const cat of CATEGORIES) {
    let page = 1, totalPages = 1;
    while (page <= totalPages && page <= 5) {
      const data = await fetchPage(cat, page);
      totalPages = data.totalPages;
      for (const food of data.foods) {
        const kcal = getNutrient(food, NUTRIENT_IDS.KCAL);
        const protein = getNutrient(food, NUTRIENT_IDS.PROTEIN);
        const fats = getNutrient(food, NUTRIENT_IDS.FATS);
        const carbs = getNutrient(food, NUTRIENT_IDS.CARBS);
        const water = getNutrient(food, NUTRIENT_IDS.WATER);
        if (!kcal && !protein && !fats && !carbs) continue;
        try {
          await client`
            INSERT INTO ingredients (fdc_id, name_ru, name_en, category, kcal_per_100g, protein_g, fats_g, carbs_g, water_pct)
            VALUES (${food.fdcId}, ${food.description}, ${food.description}, ${CATEGORY_RU[cat] ?? cat}, ${kcal}, ${protein}, ${fats}, ${carbs}, ${water})
            ON CONFLICT (fdc_id) DO UPDATE SET
              name_en = EXCLUDED.name_en, category = EXCLUDED.category,
              kcal_per_100g = EXCLUDED.kcal_per_100g, protein_g = EXCLUDED.protein_g,
              fats_g = EXCLUDED.fats_g, carbs_g = EXCLUDED.carbs_g, water_pct = EXCLUDED.water_pct
          `;
          inserted++;
        } catch (e) {
          console.error(`Ошибка ${food.fdcId}:`, e);
        }
      }
      await new Promise(r => setTimeout(r, 300));
      page++;
    }
    console.log(`[seed-ingredients] ${cat} — готово`);
  }

  console.log(`[seed-ingredients] Завершено. Добавлено: ${inserted}`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
