import { client } from './index';

type Sql = typeof client;

interface Migration {
  version: string;
  up: (sql: Sql) => Promise<void>;
}

// Версионированные миграции. Применяются по порядку, идемпотентно.
// Каждая миграция выполняется в отдельной транзакции —
// если упала, откат целиком, schema_migrations не обновится.
const migrations: Migration[] = [
  {
    version: '001_users',
    up: async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          pin TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    },
  },
  {
    version: '002_recipes',
    up: async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS recipes (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          image_url TEXT,
          servings INTEGER NOT NULL DEFAULT 4,
          prep_time INTEGER,
          cook_time INTEGER,
          total_time INTEGER,
          source_url TEXT,
          source TEXT,
          category TEXT,
          cuisine TEXT,
          difficulty TEXT,
          calories INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          id SERIAL PRIMARY KEY,
          recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          amount NUMERIC,
          unit TEXT,
          group_name TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
        ON recipe_ingredients(recipe_id)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS recipe_steps (
          id SERIAL PRIMARY KEY,
          recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
          step_number INTEGER NOT NULL,
          instruction TEXT NOT NULL,
          image_url TEXT,
          timer_minutes INTEGER
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id
        ON recipe_steps(recipe_id)
      `;
    },
  },
  {
    version: '003_menus',
    up: async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS menus (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          week_start_date TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_menus_user_week
        ON menus(user_id, week_start_date)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS menu_items (
          id SERIAL PRIMARY KEY,
          menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
          day_of_week INTEGER NOT NULL,
          meal_type TEXT NOT NULL,
          recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id
        ON menu_items(menu_id)
      `;
    },
  },
  {
    version: '004_purchase_items',
    up: async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS purchase_items (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          product_name TEXT NOT NULL,
          quantity NUMERIC,
          unit TEXT,
          category TEXT,
          is_checked INTEGER NOT NULL DEFAULT 0,
          recipe_source TEXT,
          needed_quantity NUMERIC,
          in_stock_quantity NUMERIC,
          added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_purchase_items_user_id
        ON purchase_items(user_id)
      `;
    },
  },
  {
    version: '005_inventory',
    up: async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS inventory (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          product_name TEXT NOT NULL,
          quantity NUMERIC,
          unit TEXT,
          storage_type TEXT NOT NULL DEFAULT 'fridge',
          expiry_date TEXT,
          min_quantity NUMERIC,
          category TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_inventory_user_id
        ON inventory(user_id)
      `;
    },
  },
  {
    version: '006_ingredients_products',
    up: async (sql) => {
      // КБЖУ в рецептах
      await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS protein_g NUMERIC`;
      await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS fats_g NUMERIC`;
      await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS carbs_g NUMERIC`;

      // Справочник ингредиентов (USDA FoodData Central)
      await sql`
        CREATE TABLE IF NOT EXISTS ingredients (
          id SERIAL PRIMARY KEY,
          fdc_id INTEGER UNIQUE,
          name_ru TEXT NOT NULL,
          name_en TEXT,
          category TEXT,
          default_unit TEXT,
          kcal_per_100g NUMERIC,
          protein_g NUMERIC,
          fats_g NUMERIC,
          carbs_g NUMERIC,
          water_pct NUMERIC
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_ingredients_name_ru ON ingredients(name_ru)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_ingredients_fdc_id ON ingredients(fdc_id)`;

      // Каталог товаров (Open Food Facts)
      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER REFERENCES ingredients(id),
          barcode TEXT UNIQUE,
          name_ru TEXT NOT NULL,
          name_nl TEXT,
          brand TEXT,
          package_quantity NUMERIC,
          package_unit TEXT,
          image_url TEXT,
          off_id TEXT UNIQUE
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_products_name_ru ON products(name_ru)`;

      // Замены ингредиентов
      await sql`
        CREATE TABLE IF NOT EXISTS ingredient_substitutions (
          id SERIAL PRIMARY KEY,
          ingredient_name TEXT NOT NULL,
          alternative_name TEXT NOT NULL,
          quality TEXT,
          quantity_ratio NUMERIC
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_substitutions_ingredient ON ingredient_substitutions(ingredient_name)`;
    },
  },
  {
    version: '007_cooking_history',
    up: async (sql) => {
      // История готовки. recipe_id NULLable + ON DELETE SET NULL —
      // история сохраняется даже при удалении рецепта (важно для аналитики).
      await sql`
        CREATE TABLE IF NOT EXISTS cooking_history (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
          recipe_title TEXT NOT NULL,
          servings INTEGER NOT NULL DEFAULT 1,
          calories_per_serving INTEGER,
          category TEXT,
          cuisine TEXT,
          consumed_count INTEGER NOT NULL DEFAULT 0,
          total_ingredients INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          rating INTEGER,
          cooked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_cooking_history_user_cooked
        ON cooking_history(user_id, cooked_at DESC)
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_cooking_history_recipe
        ON cooking_history(recipe_id)
      `;
    },
  },
  {
    version: '008_receipts',
    up: async (sql) => {
      // Чеки. Минимально для этапа G.19 — без OCR, без перевода, без курса.
      // total_amount — итог чека (опц., вводится вручную либо суммой строк).
      // currency: 'EUR' | 'RUB'. По умолчанию EUR (контекст — Нидерланды).
      // status: 'draft' (создан, заполняется) | 'final' (закрыт) — задел на будущее.
      await sql`
        CREATE TABLE IF NOT EXISTS receipts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          store_name TEXT,
          purchase_date TEXT,
          total_amount NUMERIC,
          currency TEXT NOT NULL DEFAULT 'EUR',
          status TEXT NOT NULL DEFAULT 'draft',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_receipts_user_created
        ON receipts(user_id, created_at DESC)
      `;
      // Позиции чека. matched_product_id — ссылка на products (если найден
      // в каталоге по штрих-коду). product_name — снапшот, чтобы строка
      // оставалась читаемой даже если товар удалят из каталога.
      await sql`
        CREATE TABLE IF NOT EXISTS receipt_items (
          id SERIAL PRIMARY KEY,
          receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
          product_name TEXT NOT NULL,
          quantity NUMERIC,
          unit TEXT,
          price NUMERIC,
          barcode TEXT,
          matched_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
          sort_order INTEGER NOT NULL DEFAULT 0
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt
        ON receipt_items(receipt_id)
      `;
    },
  },
  {
    version: '009_receipts_ocr_raw',
    up: async (sql) => {
      // G.19 — храним сырой текст OCR.
      // Зачем: парсер несовершенен; имея сырой текст, можно «перепарсить»
      // чек после улучшений парсера, не делая повторный запрос в OCR.space
      // (бесплатный тариф жёстко лимитирован: 1 запрос в 10 секунд).
      // Пользователь также видит сырой текст в UI — может скопировать его
      // и прислать разработчику, если парсер не справился.
      await sql`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS ocr_raw TEXT`;
    },
  },
  {
    version: '011_substitutions_seed',
    up: async (sql) => {
      // B.3 — базовый набор кулинарных замен ингредиентов.
      // Если строка с такой парой (ingredient_name, alternative_name) уже есть —
      // не добавляем повторно (защита от дублей при повторных запусках).
      const subs: Array<[string, string, string | null, number | null]> = [
        // Молочные
        ['Сметана', 'Греческий йогурт', 'по консистенции', 1],
        ['Сметана', 'Майонез', 'для салатов', 1],
        ['Сметана', 'Мягкий творог', 'для соусов', 1],
        ['Сливочное масло', 'Маргарин', 'для выпечки', 1],
        ['Сливочное масло', 'Растительное масло', 'жарка', 0.75],
        ['Сливочное масло', 'Кокосовое масло', 'для выпечки', 1],
        ['Молоко', 'Растительное молоко', 'миндальное/овсяное/соевое', 1],
        ['Молоко', 'Сливки + вода', '1/2 сливок + 1/2 воды', 1],
        ['Сливки', 'Сметана', 'вместо 20% сливок', 1],
        ['Сливки', 'Кокосовое молоко', 'для веганских блюд', 1],
        ['Творог', 'Рикотта', 'мягче', 1],
        ['Творог', 'Маскарпоне', 'жирнее', 1],
        ['Йогурт', 'Кефир', 'для маринадов', 1],
        ['Йогурт', 'Сметана', 'разбавить водой', 1],
        // Яйца
        ['Яйцо', 'Льняное семя + вода', '1 ст.л. семян + 3 ст.л. воды', 1],
        ['Яйцо', 'Банан', '1/2 банана = 1 яйцо (выпечка)', 1],
        ['Яйцо', 'Яблочное пюре', '1/4 стакана = 1 яйцо', 1],
        // Мука
        ['Мука пшеничная', 'Овсяная мука', 'плотнее', 1],
        ['Мука пшеничная', 'Кукурузная мука', 'для безглютеновых', 0.75],
        ['Мука пшеничная', 'Цельнозерновая мука', 'плотнее, полезнее', 1],
        // Сахар
        ['Сахар', 'Мёд', 'уменьшить жидкость', 0.75],
        ['Сахар', 'Кленовый сироп', 'для выпечки', 0.75],
        ['Сахар', 'Стевия', 'по вкусу', null],
        ['Мёд', 'Сахар', 'добавить жидкость', 1.33],
        ['Мёд', 'Кленовый сироп', 'натуральный', 1],
        // Жидкости
        ['Лимонный сок', 'Сок лайма', 'кислотность та же', 1],
        ['Лимонный сок', 'Яблочный уксус', 'для маринадов', 1],
        ['Белое вино', 'Виноградный сок + лимон', 'безалкогольно', 1],
        ['Красное вино', 'Тёмный виноградный сок', 'безалкогольно', 1],
        ['Соевый соус', 'Тамари', 'без глютена', 1],
        ['Соевый соус', 'Вустерширский соус', 'другой вкус', 1],
        // Травы
        ['Базилик', 'Орегано', 'итальянский вкус', 1],
        ['Базилик', 'Тимьян', 'более лесной', 1],
        ['Укроп', 'Петрушка', 'мягче', 1],
        ['Укроп', 'Тархун', 'анисовый вкус', 1],
        ['Розмарин', 'Тимьян', 'мягче', 1],
        ['Розмарин', 'Шалфей', 'для мяса', 1],
        ['Тимьян', 'Розмарин', 'острее', 1],
        ['Тимьян', 'Орегано', 'итальянский', 1],
        ['Петрушка', 'Кинза', 'азиатский вкус', 1],
        ['Петрушка', 'Укроп', 'нежнее', 1],
        ['Кинза', 'Петрушка', 'без специфики', 1],
        // Специи
        ['Куркума', 'Карри', 'острее', 1],
        ['Свежий имбирь', 'Сушёный имбирь', 'сильнее по вкусу', 0.5],
        ['Чеснок свежий', 'Чесночный порошок', '1/4 ч.л. на зубчик', null],
        // Уксусы
        ['Винный уксус', 'Яблочный уксус', 'мягче', 1],
        ['Винный уксус', 'Лимонный сок', 'без алкоголя', 1],
        ['Бальзамический уксус', 'Винный уксус + сахар', 'смешать', 1],
        ['Рисовый уксус', 'Яблочный уксус', 'для азиатских блюд', 1],
        // Орехи/пасты
        ['Тахини', 'Арахисовая паста', 'другой вкус', 1],
        ['Тахини', 'Кунжутная паста', 'аналог', 1],
        // Бульоны
        ['Куриный бульон', 'Овощной бульон', 'для веганских', 1],
        ['Куриный бульон', 'Вода + бульонный кубик', 'быстро', 1],
        ['Говяжий бульон', 'Куриный бульон', 'легче', 1],
        // Крахмалы
        ['Кукурузный крахмал', 'Картофельный крахмал', 'аналог', 1],
        ['Кукурузный крахмал', 'Мука пшеничная', 'для соусов', 2],
      ];

      for (const [ingredientName, alternativeName, quality, ratio] of subs) {
        // Проверяем не добавлено ли уже (защита от дублей при повторе миграции)
        const existing = await sql`
          SELECT id FROM ingredient_substitutions
          WHERE LOWER(ingredient_name) = LOWER(${ingredientName})
            AND LOWER(alternative_name) = LOWER(${alternativeName})
          LIMIT 1
        `;
        if (existing.length === 0) {
          await sql`
            INSERT INTO ingredient_substitutions
              (ingredient_name, alternative_name, quality, quantity_ratio)
            VALUES
              (${ingredientName}, ${alternativeName}, ${quality}, ${ratio})
          `;
        }
      }
    },
  },
  {
    version: '012_substitutions_ilike_fix',
    up: async (sql) => {
      // B.3 — индекс на LOWER(ingredient_name) для быстрого поиска
      // (роутер getSubstitutions использует ILIKE)
      await sql`
        CREATE INDEX IF NOT EXISTS idx_substitutions_name_lower
        ON ingredient_substitutions(LOWER(ingredient_name))
      `;
    },
  },
];

export async function runMigrations(): Promise<void> {
  // Таблица учёта версий — создаётся первой, отдельно от транзакции миграций
  await client`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = await client<{ version: string }[]>`
    SELECT version FROM schema_migrations
  `;
  const appliedSet = new Set(applied.map((r) => r.version));

  for (const m of migrations) {
    if (appliedSet.has(m.version)) {
      console.log(`[migrate] ${m.version} — уже применена, пропуск`);
      continue;
    }

    console.log(`[migrate] применяю ${m.version}...`);
    await client.begin(async (sql) => {
      await m.up(sql);
      await sql`INSERT INTO schema_migrations (version) VALUES (${m.version})`;
    });
    console.log(`[migrate] ${m.version} — готово`);
  }

  console.log('[migrate] все миграции применены');
}
