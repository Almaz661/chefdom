import { client } from './index';
import { seedSubstitutions } from './seed-substitutions';

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
      // B.3 — заливаем справочник замен ингредиентов.
      // Данные и логика — в server/db/seed-substitutions.ts (~480 пар).
      // Идемпотентно: дубли отсеиваются.
      await seedSubstitutions(sql);
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
  {
    version: '013_substitutions_seed_extra',
    up: async (sql) => {
      // B.3 — re-применяем seed замен.
      // Зачем: на установках где миграция 011 уже была применена со старым
      // (укороченным) списком замен (~56 пар), новые ~420 пар не залились.
      // Эта миграция вызывает ту же функцию — благодаря защите от дублей
      // в БД останется итоговый полный набор (~480 пар).
      await seedSubstitutions(sql);
    },
  },
  {
    version: '014_inventory_added_at',
    up: async (sql) => {
      // B.2 — отдельное поле added_at для алерта «давно лежит».
      // updated_at сбрасывается при любом UPDATE (изменили количество — сдвинулся
      // отсчёт), а нам нужна дата фактического добавления продукта.
      // Для существующих записей берём updated_at как лучший доступный proxy.
      await sql`
        ALTER TABLE inventory
        ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      `;
      // Backfill для существующих: added_at = updated_at
      await sql`
        UPDATE inventory
        SET added_at = updated_at
        WHERE added_at >= NOW() - INTERVAL '1 minute'
      `;
    },
  },
  {
    version: '015_users_default_currency',
    up: async (sql) => {
      // Настройки → переключатель валюты (EUR/RUB).
      // Хранится на пользователе, чтобы у каждого «семейного» аккаунта
      // могли быть свои предпочтения (актуально для будущего multi-user).
      // Используется как валюта по умолчанию при создании чека вручную
      // и как fallback в парсере OCR, если магазин не распознан.
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'EUR'
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
