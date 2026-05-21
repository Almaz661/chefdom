import { client } from './index';

// Импорт ингредиентов из USDA FoodData Central (Foundation Foods).
// Запускается вручную: npx tsx server/db/seed-ingredients.ts
// Идемпотентный — повторный запуск не дублирует данные (upsert по fdc_id).
// API ключ читается из USDA_API_KEY (переменная окружения на Render).

const API_KEY = process.env.USDA_API_KEY;
if (!API_KEY) {
  console.error('[seed-ingredients] Ошибка: переменная USDA_API_KEY не задана');
  process.exit(1);
}

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// Нутриенты которые нас интересуют (USDA nutrient ID)
const NUTRIENT_IDS = {
  KCAL:    1008, // Energy (kcal)
  PROTEIN: 1003, // Protein
  FATS:    1004, // Total lipid (fat)
  CARBS:   1005, // Carbohydrate, by difference
  WATER:   1051, // Water
};

// Категории Foundation Foods которые импортируем
const FOOD_CATEGORIES = [
  'Beef Products',
  'Poultry Products',
  'Pork Products',
  'Finfish and Shellfish Products',
  'Dairy and Egg Products',
  'Vegetables and Vegetable Products',
  'Fruits and Fruit Juices',
  'Legumes and Legume Products',
  'Nut and Seed Products',
  'Cereal Grains and Pasta',
  'Baked Products',
  'Fats and Oils',
  'Spices and Herbs',
  'Soups, Sauces, and Gravies',
];

// Переводы категорий на русский
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
  'Soups, Sauces, and Gravies': 'Супы и соусы',
};

interface UsdaFood {
  fdcId: number;
  description: string;
  foodCategory?: string;
  foodNutrients?: {
    nutrientId: number;
    value: number;
  }[];
}

interface UsdaSearchResponse {
  foods: UsdaFood[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

async function fetchFoods(category: string, page: number): Promise<UsdaSearchResponse> {
  const url = `${BASE_URL}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(category)}&dataType=Foundation,SR%20Legacy&pageSize=50&pageNumber=${page}&nutrients=${Object.values(NUTRIENT_IDS).join(',')}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA API error: ${res.status}`);
  return res.json() as Promise<UsdaSearchResponse>;
}

function getNutrient(food: UsdaFood, nutrientId: number): number | null {
  const n = food.foodNutrients?.find((x) => x.nutrientId === nutrientId);
  return n ? n.value : null;
}

async function importIngredients() {
  console.log('[seed-ingredients] Начинаю импорт из USDA FoodData Central...');

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const category of FOOD_CATEGORIES) {
    console.log(`[seed-ingredients] Категория: ${category}`);

    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 5) { // max 5 страниц на категорию = 250 записей
      const data = await fetchFoods(category, page);
      totalPages = data.totalPages;

      for (const food of data.foods) {
        const kcal = getNutrient(food, NUTRIENT_IDS.KCAL);
        const protein = getNutrient(food, NUTRIENT_IDS.PROTEIN);
        const fats = getNutrient(food, NUTRIENT_IDS.FATS);
        const carbs = getNutrient(food, NUTRIENT_IDS.CARBS);
        const water = getNutrient(food, NUTRIENT_IDS.WATER);

        // Пропускаем если нет КБЖУ — нет смысла хранить
        if (!kcal && !protein && !fats && !carbs) {
          totalSkipped++;
          continue;
        }

        try {
          await client`
            INSERT INTO ingredients (
              fdc_id, name_ru, name_en, category,
              kcal_per_100g, protein_g, fats_g, carbs_g, water_pct
            ) VALUES (
              ${food.fdcId},
              ${food.description},
              ${food.description},
              ${CATEGORY_RU[category] ?? category},
              ${kcal},
              ${protein},
              ${fats},
              ${carbs},
              ${water}
            )
            ON CONFLICT (fdc_id) DO UPDATE SET
              name_en = EXCLUDED.name_en,
              category = EXCLUDED.category,
              kcal_per_100g = EXCLUDED.kcal_per_100g,
              protein_g = EXCLUDED.protein_g,
              fats_g = EXCLUDED.fats_g,
              carbs_g = EXCLUDED.carbs_g,
              water_pct = EXCLUDED.water_pct
          `;
          totalInserted++;
        } catch (err) {
          console.error(`[seed-ingredients] Ошибка при вставке ${food.fdcId}: ${err}`);
        }
      }

      // Небольшая пауза чтобы не перегружать API
      await new Promise((r) => setTimeout(r, 300));
      page++;
    }

    console.log(`[seed-ingredients] ${category}: готово`);
  }

  console.log(`[seed-ingredients] Завершено. Добавлено: ${totalInserted}, пропущено: ${totalSkipped}`);
  await client.end();
}

importIngredients().catch((err) => {
  console.error('[seed-ingredients] Критическая ошибка:', err);
  process.exit(1);
});
