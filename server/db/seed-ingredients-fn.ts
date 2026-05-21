// Функция импорта ингредиентов из USDA — вызывается через /api/seed-ingredients
// Не содержит top-level кода — безопасно импортировать.
// Переводит английские названия на русский через DeepL.

import { client } from './index';

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const DEEPL_API = 'https://api-free.deepl.com/v2/translate';
const NUTRIENT_IDS = { KCAL: 1008, PROTEIN: 1003, FATS: 1004, CARBS: 1005, WATER: 1051 };

// Пакетный перевод через DeepL — до 50 строк за раз
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
    if (!res.ok) { console.error(`[deepl] HTTP ${res.status}`); return texts; }
    const data = await res.json() as { translations: { text: string }[] };
    return data.translations.map(t => t.text);
  } catch (e) {
    console.error('[deepl] Ошибка:', e);
    return texts;
  }
}

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

  const deeplKey = process.env.DEEPL_API_KEY;
  if (!deeplKey) console.warn('[seed-ingredients] DEEPL_API_KEY не задан — названия останутся на английском');

  console.log('[seed-ingredients] Начинаю импорт из USDA...');
  let inserted = 0;

  for (const cat of CATEGORIES) {
    let page = 1, totalPages = 1;
    while (page <= totalPages && page <= 5) {
      const data = await fetchPage(apiKey, cat, page);
      totalPages = data.totalPages;

      // Фильтруем только продукты с КБЖУ
      const foods = data.foods.filter(food => {
        const kcal = getNutrient(food, NUTRIENT_IDS.KCAL);
        const protein = getNutrient(food, NUTRIENT_IDS.PROTEIN);
        const fats = getNutrient(food, NUTRIENT_IDS.FATS);
        const carbs = getNutrient(food, NUTRIENT_IDS.CARBS);
        return kcal || protein || fats || carbs;
      });

      // Переводим все названия пакетами по 50
      let namesRu: string[] = foods.map(f => f.description);
      if (deeplKey && foods.length > 0) {
        const allNames: string[] = [];
        for (let i = 0; i < foods.length; i += 50) {
          const batch = foods.slice(i, i + 50).map(f => f.description);
          const translated = await translateBatch(batch, deeplKey);
          allNames.push(...translated);
        }
        namesRu = allNames;
      }

      for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
        const nameRu = namesRu[i] || food.description;
        const kcal = getNutrient(food, NUTRIENT_IDS.KCAL);
        const protein = getNutrient(food, NUTRIENT_IDS.PROTEIN);
        const fats = getNutrient(food, NUTRIENT_IDS.FATS);
        const carbs = getNutrient(food, NUTRIENT_IDS.CARBS);
        const water = getNutrient(food, NUTRIENT_IDS.WATER);

        try {
          await client`
            INSERT INTO ingredients (fdc_id, name_ru, name_en, category, kcal_per_100g, protein_g, fats_g, carbs_g, water_pct)
            VALUES (${food.fdcId}, ${nameRu}, ${food.description}, ${CATEGORY_RU[cat] ?? cat}, ${kcal}, ${protein}, ${fats}, ${carbs}, ${water})
            ON CONFLICT (fdc_id) DO UPDATE SET
              name_ru = EXCLUDED.name_ru,
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
