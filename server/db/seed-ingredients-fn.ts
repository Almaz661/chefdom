// Функция импорта ингредиентов из USDA — вызывается через /api/seed-ingredients
// Не содержит top-level кода — безопасно импортировать.

import { client } from './index';

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

function getNutrient(food: UsdaFood, id: number) {
  return food.foodNutrients?.find(n => n.nutrientId === id)?.value ?? null;
}

async function fetchPage(apiKey: string, category: string, page: number) {
  const url = `${BASE_URL}/foods/search?api_key=${apiKey}&query=${encodeURIComponent(category)}&dataType=Foundation,SR%20Legacy&pageSize=50&pageNumber=${page}&nutrients=${Object.values(NUTRIENT_IDS).join(',')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA HTTP ${res.status}`);
  return res.json() as Promise<{ foods: UsdaFood[]; totalPages: number }>;
}

export async function runSeedIngredients(): Promise<void> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) throw new Error('USDA_API_KEY не задан');

  console.log('[seed-ingredients] Начинаю импорт из USDA...');
  let inserted = 0;

  for (const cat of CATEGORIES) {
    let page = 1, totalPages = 1;
    while (page <= totalPages && page <= 5) {
      const data = await fetchPage(apiKey, cat, page);
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
              name_en = EXCLUDED.name_en,
              category = EXCLUDED.category,
              kcal_per_100g = EXCLUDED.kcal_per_100g,
              protein_g = EXCLUDED.protein_g,
              fats_g = EXCLUDED.fats_g,
              carbs_g = EXCLUDED.carbs_g,
              water_pct = EXCLUDED.water_pct
          `;
          inserted++;
        } catch (e) {
          console.error(`[seed-ingredients] Ошибка fdc_id=${food.fdcId}:`, e);
        }
      }

      await new Promise(r => setTimeout(r, 300));
      page++;
    }
    console.log(`[seed-ingredients] ${cat}: готово`);
  }

  console.log(`[seed-ingredients] Завершено. Добавлено/обновлено: ${inserted}`);
}
