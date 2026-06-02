import { client } from './index';
import { seedSubstitutions } from './seed-substitutions';
import { normalizeRecipeCategory } from '../services/categoryNormalize';
import bcrypt from 'bcryptjs';

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
    version: '010_product_master_prices',
    up: async (sql) => {
      // Product Master — хранит последние и средние цены товаров.
      // Используется для точной привязки цен в ALDI чеках с "двухблочным"
      // форматом (все имена сверху, все цены снизу).
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS last_price NUMERIC`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS avg_price NUMERIC`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ`;
      await sql`CREATE INDEX IF NOT EXISTS idx_products_name_ru_lower ON products(LOWER(name_ru))`;
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
  {
    version: '016_sessions',
    up: async (sql) => {
      // Сессии — аутентификация по Bearer-токену.
      // До этой миграции все tRPC процедуры были `publicProcedure` и любой
      // по URL мог скачать/стереть БД через settings.exportBackup/importBackup.
      // Теперь protectedProcedure требует валидный токен из этой таблицы.
      //
      // token — случайная строка (32 байта = 64 hex), первичный ключ.
      // expires_at — UTC timestamp, проверяется на каждом запросе.
      // ON DELETE CASCADE — при удалении пользователя сессии тоже удаляются.
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      // Для быстрой выборки сессий пользователя (логаут со всех устройств,
      // или будущая страница «активные сессии»).
      await sql`
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id
        ON sessions(user_id)
      `;
      // Для периодической чистки истёкших сессий (если будет фоновая задача).
      await sql`
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
        ON sessions(expires_at)
      `;
    },
  },
  {
    version: '017_auth_attempts',
    up: async (sql) => {
      // Защита от перебора PIN — счётчик попыток, который ПЕРЕЖИВАЕТ
      // перезапуск сервера. До этой миграции attempts хранились в Map в
      // памяти процесса; на Render Free сервер засыпает каждые 15 мин
      // и счётчик сбрасывался → brute force 4-цифрового PIN был реален
      // (10 000 вариантов / 5 попыток × 15 мин ≈ 500 часов = 21 день).
      //
      // С этой миграцией: попытки в БД, блок на 30 мин выживает рестарты.
      //
      // key — IP клиента (или 'unknown' если не определился).
      // count — количество ПОДРЯД неверных попыток с этого IP.
      // blocked_until — UTC timestamp до которого вход с этого IP заблокирован.
      // updated_at — для будущей очистки старых записей (cron-job).
      await sql`
        CREATE TABLE IF NOT EXISTS auth_attempts (
          key TEXT PRIMARY KEY,
          count INTEGER NOT NULL DEFAULT 0,
          blocked_until TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      // Индекс для очистки устаревших записей (count=0, blocked_until истёк).
      await sql`
        CREATE INDEX IF NOT EXISTS idx_auth_attempts_updated
        ON auth_attempts(updated_at)
      `;
    },
  },
  {
    version: '018_pin_hash',
    up: async (sql) => {
      // Хеширование PIN через bcrypt. До этой миграции PIN хранился plain
      // text в users.pin — при компрометации БД (утечка дампа Neon, кража
      // backup-файла) злоумышленник сразу получал PIN.
      //
      // Стратегия:
      //   1. Добавляем колонку pin_hash TEXT (nullable пока).
      //   2. Для всех существующих юзеров считаем bcrypt(pin) и пишем в pin_hash.
      //   3. Делаем pin_hash NOT NULL.
      //   4. Колонку pin НЕ удаляем в этом релизе — оставляем как backup на
      //      случай отката. В следующей миграции (019) можно дропнуть.
      //
      // Code-path: auth.ts читает только pin_hash. Старая колонка pin
      // остаётся «осиротелой», но не мешает.
      //
      // bcrypt cost: 10. Это ~80 мс на современном CPU — баланс между
      // защитой от перебора и UX (пользователь не ждёт логин секунду).
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT`;

      // Бэкфилл: считаем bcrypt для каждого существующего юзера.
      // Делаем последовательно, не параллельно — bcrypt CPU-intensive,
      // параллельность не ускорит на одном ядре.
      const users = await sql<{ id: number; pin: string; pin_hash: string | null }[]>`
        SELECT id, pin, pin_hash FROM users
      `;
      for (const u of users) {
        if (u.pin_hash) continue; // уже захешировано — пропуск
        const hash = await bcrypt.hash(u.pin, 10);
        await sql`UPDATE users SET pin_hash = ${hash} WHERE id = ${u.id}`;
      }

      // Делаем pin_hash NOT NULL — для свежей БД (0 юзеров) это безопасно
      // (ALTER на пустой колонке всегда проходит); для существующей БД
      // уже все строки заполнены выше.
      await sql`ALTER TABLE users ALTER COLUMN pin_hash SET NOT NULL`;
    },
  },
  {
    version: '019_preserves',
    up: async (sql) => {
      // Этап D — заготовки. Единая таблица под три типа: заморозка,
      // консервация, открытые продукты. Тип хранится в preserve_type.
      //
      // Зачем единая таблица, а не три:
      //   1. Поля 80% общие (название, количество, единица, даты).
      //   2. Будущая аналитика «вся заготовленная еда» — один SELECT.
      //   3. Перевести продукт из «открытое» в «заморозить» = один UPDATE.
      //
      // Поля по типу (то что null для других — нормально):
      //   frozen: name, quantity, unit, servings, prepared_at (когда
      //     заморозили), expiry_date (до какого числа хранить).
      //   preserved: name, quantity, unit, prepared_at (когда заготовили),
      //     expiry_date (годен до).
      //   opened: name, quantity, unit, prepared_at (когда открыли),
      //     expiry_date (годен после открытия до).
      //
      // CHECK в БД — защита от опечаток в коде (если кто-то напишет
      // 'froozen', база отвергнет вставку, не дав мусору попасть в данные).
      await sql`
        CREATE TABLE IF NOT EXISTS preserves (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          preserve_type TEXT NOT NULL CHECK (preserve_type IN ('frozen','preserved','opened')),
          name TEXT NOT NULL,
          quantity NUMERIC,
          unit TEXT,
          servings INTEGER,
          prepared_at TEXT,
          expiry_date TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      // Главный индекс — выборка по пользователю и типу для табов UI.
      await sql`
        CREATE INDEX IF NOT EXISTS idx_preserves_user_type
        ON preserves(user_id, preserve_type)
      `;
      // Индекс по сроку — для будущих алертов «истекает скоро».
      await sql`
        CREATE INDEX IF NOT EXISTS idx_preserves_expiry
        ON preserves(expiry_date)
      `;
    },
  },
  {
    version: '020_freezer_shelf_life',
    up: async (sql) => {
      // Этап D — справочник сроков заморозки. У профессиональных поваров
      // на холодильниках весит таблица «что сколько хранить в морозилке».
      // Это её цифровая версия — при добавлении заготовки типа frozen
      // система сама подставляет дату «Хранить до» по названию продукта.
      //
      // keyword — подстрока для поиска (по LOWER name LIKE '%keyword%').
      // Чтобы «Свиные котлеты» ловилось ключом «котлет», «фарш свиной»
      // ловился ключом «фарш» и т.д. Для одного товара может матчиться
      // несколько ключей — берём самый длинный (самый специфичный).
      //
      // days — стандартный срок безопасного хранения в морозилке (-18°C).
      // Цифры — консервативные значения по рекомендациям FDA / USDA
      // (foodsafety.gov), для домашней морозилки.
      //
      // priority — для разрешения конфликтов:
      // если совпало несколько ключей одинаковой длины (например «фарш»
      // и «свинин»), выигрывает с большим priority. По умолчанию 0.
      await sql`
        CREATE TABLE IF NOT EXISTS freezer_shelf_life (
          id SERIAL PRIMARY KEY,
          keyword TEXT NOT NULL UNIQUE,
          days INTEGER NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          description TEXT
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_freezer_shelf_life_keyword
        ON freezer_shelf_life(LOWER(keyword))
      `;

      // Заливаем справочник. Идемпотентно: если мигрицию запускали
      // повторно, ON CONFLICT обновит дни/описание, а не упадёт.
      // Сроки в днях ≈ месяцы × 30. Источник: FDA FoodKeeper App,
      // USDA «Freezing and Food Safety», адаптировано для домашних условий.
      const entries: { keyword: string; days: number; priority: number; description: string }[] = [
        // --- Сырое мясо (целым куском) ---
        { keyword: 'говядин', days: 360, priority: 5, description: 'Сырая говядина куском, ~12 мес' },
        { keyword: 'свинин', days: 240, priority: 5, description: 'Сырая свинина куском, ~8 мес' },
        { keyword: 'баранин', days: 270, priority: 5, description: 'Сырая баранина, ~9 мес' },
        { keyword: 'телятин', days: 270, priority: 5, description: 'Телятина, ~9 мес' },
        { keyword: 'крольчатин', days: 270, priority: 5, description: 'Кролик, ~9 мес' },

        // --- Сырое мясо (куски/стейки) ---
        { keyword: 'стейк', days: 240, priority: 6, description: 'Стейки, ~8 мес' },
        { keyword: 'отбивн', days: 120, priority: 6, description: 'Отбивные, ~4 мес' },
        { keyword: 'ребр', days: 240, priority: 6, description: 'Рёбра, ~8 мес' },

        // --- Фарш и котлеты сырые ---
        { keyword: 'фарш', days: 120, priority: 7, description: 'Фарш сырой, ~4 мес' },
        { keyword: 'котлет', days: 120, priority: 7, description: 'Котлеты сырые, ~4 мес' },
        { keyword: 'пельмен', days: 120, priority: 7, description: 'Пельмени, ~4 мес' },
        { keyword: 'вареник', days: 90, priority: 7, description: 'Вареники, ~3 мес' },
        { keyword: 'манты', days: 120, priority: 7, description: 'Манты, ~4 мес' },
        { keyword: 'хинкал', days: 120, priority: 7, description: 'Хинкали, ~4 мес' },
        { keyword: 'тефтел', days: 120, priority: 7, description: 'Тефтели, ~4 мес' },
        { keyword: 'голубц', days: 90, priority: 7, description: 'Голубцы, ~3 мес' },

        // --- Птица ---
        { keyword: 'куриц', days: 270, priority: 5, description: 'Курица сырая, ~9 мес' },
        { keyword: 'курин', days: 270, priority: 5, description: 'Курятина, ~9 мес' },
        { keyword: 'индейк', days: 270, priority: 5, description: 'Индейка, ~9 мес' },
        { keyword: 'утк', days: 180, priority: 5, description: 'Утка, ~6 мес' },
        { keyword: 'гус', days: 180, priority: 5, description: 'Гусь, ~6 мес' },
        { keyword: 'крыл', days: 270, priority: 6, description: 'Крылья, ~9 мес' },
        { keyword: 'голен', days: 270, priority: 6, description: 'Голени, ~9 мес' },
        { keyword: 'окорочк', days: 270, priority: 6, description: 'Окорочка, ~9 мес' },

        // --- Рыба и морепродукты ---
        { keyword: 'треск', days: 180, priority: 6, description: 'Треска (нежирная), ~6 мес' },
        { keyword: 'минтай', days: 180, priority: 6, description: 'Минтай, ~6 мес' },
        { keyword: 'хек', days: 180, priority: 6, description: 'Хек, ~6 мес' },
        { keyword: 'судак', days: 180, priority: 6, description: 'Судак, ~6 мес' },
        { keyword: 'тунц', days: 90, priority: 6, description: 'Тунец (жирный), ~3 мес' },
        { keyword: 'тунец', days: 90, priority: 6, description: 'Тунец (жирный), ~3 мес' },
        { keyword: 'лосос', days: 90, priority: 7, description: 'Лосось (жирная), ~3 мес' },
        { keyword: 'сёмг', days: 90, priority: 7, description: 'Сёмга (жирная), ~3 мес' },
        { keyword: 'семг', days: 90, priority: 7, description: 'Сёмга (жирная), ~3 мес' },
        { keyword: 'форел', days: 90, priority: 7, description: 'Форель (жирная), ~3 мес' },
        { keyword: 'скумбри', days: 90, priority: 7, description: 'Скумбрия (жирная), ~3 мес' },
        { keyword: 'сельд', days: 90, priority: 7, description: 'Сельдь (жирная), ~3 мес' },
        { keyword: 'рыб', days: 120, priority: 3, description: 'Рыба (общее), ~4 мес' },
        { keyword: 'креветк', days: 120, priority: 6, description: 'Креветки, ~4 мес' },
        { keyword: 'кальмар', days: 120, priority: 6, description: 'Кальмары, ~4 мес' },
        { keyword: 'мидии', days: 90, priority: 6, description: 'Мидии, ~3 мес' },

        // --- Готовые блюда ---
        { keyword: 'плов', days: 90, priority: 6, description: 'Готовый плов, ~3 мес' },
        { keyword: 'рагу', days: 90, priority: 6, description: 'Рагу, ~3 мес' },
        { keyword: 'жарко', days: 90, priority: 6, description: 'Жаркое, ~3 мес' },
        { keyword: 'запеканк', days: 90, priority: 6, description: 'Запеканка, ~3 мес' },
        { keyword: 'лазань', days: 90, priority: 6, description: 'Лазанья, ~3 мес' },
        { keyword: 'бульон', days: 120, priority: 6, description: 'Бульон, ~4 мес' },
        { keyword: 'суп', days: 90, priority: 6, description: 'Суп, ~3 мес' },
        { keyword: 'борщ', days: 90, priority: 6, description: 'Борщ, ~3 мес' },
        { keyword: 'щи', days: 90, priority: 6, description: 'Щи, ~3 мес' },
        { keyword: 'соус', days: 180, priority: 6, description: 'Соус, ~6 мес' },

        // --- Хлеб и тесто ---
        { keyword: 'хлеб', days: 90, priority: 6, description: 'Хлеб, ~3 мес' },
        { keyword: 'булочк', days: 90, priority: 6, description: 'Булочки, ~3 мес' },
        { keyword: 'батон', days: 90, priority: 6, description: 'Батон, ~3 мес' },
        { keyword: 'дрожжев', days: 90, priority: 7, description: 'Дрожжевое тесто, ~3 мес' },
        { keyword: 'слоён', days: 180, priority: 7, description: 'Слоёное тесто, ~6 мес' },
        { keyword: 'песочн', days: 120, priority: 7, description: 'Песочное тесто, ~4 мес' },
        { keyword: 'тесто', days: 120, priority: 5, description: 'Тесто (общее), ~4 мес' },
        { keyword: 'блин', days: 60, priority: 6, description: 'Блины, ~2 мес' },

        // --- Овощи (бланшированные) ---
        { keyword: 'брокколи', days: 360, priority: 7, description: 'Брокколи, ~12 мес' },
        { keyword: 'цветн', days: 360, priority: 6, description: 'Цветная капуста, ~12 мес' },
        { keyword: 'горошек', days: 360, priority: 7, description: 'Горошек зелёный, ~12 мес' },
        { keyword: 'кукуруз', days: 360, priority: 7, description: 'Кукуруза, ~12 мес' },
        { keyword: 'фасол', days: 360, priority: 6, description: 'Фасоль, ~12 мес' },
        { keyword: 'перец', days: 240, priority: 6, description: 'Перец, ~8 мес' },
        { keyword: 'тыкв', days: 360, priority: 6, description: 'Тыква, ~12 мес' },
        { keyword: 'кабачк', days: 240, priority: 6, description: 'Кабачки, ~8 мес' },
        { keyword: 'баклажан', days: 240, priority: 6, description: 'Баклажаны, ~8 мес' },
        { keyword: 'помидор', days: 240, priority: 6, description: 'Помидоры, ~8 мес' },
        { keyword: 'грибы', days: 240, priority: 6, description: 'Грибы, ~8 мес' },
        { keyword: 'грибов', days: 240, priority: 6, description: 'Грибы, ~8 мес' },
        { keyword: 'шпинат', days: 240, priority: 6, description: 'Шпинат, ~8 мес' },

        // --- Ягоды и фрукты ---
        { keyword: 'клубник', days: 360, priority: 7, description: 'Клубника, ~12 мес' },
        { keyword: 'малин', days: 360, priority: 7, description: 'Малина, ~12 мес' },
        { keyword: 'смородин', days: 360, priority: 7, description: 'Смородина, ~12 мес' },
        { keyword: 'черник', days: 360, priority: 7, description: 'Черника, ~12 мес' },
        { keyword: 'голубик', days: 360, priority: 7, description: 'Голубика, ~12 мес' },
        { keyword: 'вишн', days: 360, priority: 7, description: 'Вишня, ~12 мес' },
        { keyword: 'слив', days: 360, priority: 7, description: 'Сливы, ~12 мес' },
        { keyword: 'абрикос', days: 360, priority: 7, description: 'Абрикосы, ~12 мес' },
        { keyword: 'персик', days: 360, priority: 7, description: 'Персики, ~12 мес' },
        { keyword: 'ягод', days: 360, priority: 5, description: 'Ягоды (общее), ~12 мес' },

        // --- Зелень ---
        { keyword: 'укроп', days: 180, priority: 7, description: 'Укроп, ~6 мес' },
        { keyword: 'петрушк', days: 180, priority: 7, description: 'Петрушка, ~6 мес' },
        { keyword: 'базилик', days: 180, priority: 7, description: 'Базилик, ~6 мес' },
        { keyword: 'кинз', days: 180, priority: 7, description: 'Кинза, ~6 мес' },
        { keyword: 'зелен', days: 180, priority: 5, description: 'Зелень, ~6 мес' },

        // --- Молочка и яйца ---
        { keyword: 'масло сливочн', days: 270, priority: 8, description: 'Масло сливочное, ~9 мес' },
        { keyword: 'сыр', days: 180, priority: 5, description: 'Сыр твёрдый, ~6 мес' },
        { keyword: 'творог', days: 60, priority: 6, description: 'Творог, ~2 мес' },

        // --- Колбасные ---
        { keyword: 'сосиск', days: 60, priority: 7, description: 'Сосиски, ~2 мес' },
        { keyword: 'колбас', days: 60, priority: 6, description: 'Колбаса, ~2 мес' },
        { keyword: 'бекон', days: 30, priority: 7, description: 'Бекон, ~1 мес' },
        { keyword: 'сало', days: 180, priority: 7, description: 'Сало солёное, ~6 мес' },

        // --- Орехи ---
        { keyword: 'орех', days: 360, priority: 6, description: 'Орехи, ~12 мес' },
      ];

      for (const e of entries) {
        await sql`
          INSERT INTO freezer_shelf_life (keyword, days, priority, description)
          VALUES (${e.keyword}, ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT (keyword) DO UPDATE SET
            days = EXCLUDED.days,
            priority = EXCLUDED.priority,
            description = EXCLUDED.description
        `;
      }
    },
  },
  {
    version: '021_shelf_life_all_storage',
    up: async (sql) => {
      // Универсальный справочник сроков годности для всех типов хранения.
      // Расширяет freezer_shelf_life на холодильник (fridge) и кладовку (pantry).
      // storage_type: 'fridge' | 'freezer' | 'pantry'
      // Данные freezer остаются в freezer_shelf_life (обратная совместимость),
      // сюда добавляем fridge и pantry.
      await sql`
        CREATE TABLE IF NOT EXISTS shelf_life (
          id SERIAL PRIMARY KEY,
          storage_type TEXT NOT NULL,
          keyword TEXT NOT NULL,
          days INTEGER NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          description TEXT,
          UNIQUE(storage_type, keyword)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_shelf_life_storage_keyword
        ON shelf_life(storage_type, LOWER(keyword))
      `;

      // Сроки для ХОЛОДИЛЬНИКА (fridge) — температура 0-4°C
      // Источники: FDA FoodKeeper, USDA Food Safety
      const fridgeEntries: { keyword: string; days: number; priority: number; description: string }[] = [
        // --- Молочные продукты ---
        { keyword: 'молоко', days: 7, priority: 7, description: 'Молоко свежее, ~1 неделя' },
        { keyword: 'кефир', days: 14, priority: 7, description: 'Кефир, ~2 недели' },
        { keyword: 'ряженк', days: 14, priority: 7, description: 'Ряженка, ~2 недели' },
        { keyword: 'йогурт', days: 14, priority: 7, description: 'Йогурт, ~2 недели' },
        { keyword: 'сметан', days: 14, priority: 7, description: 'Сметана, ~2 недели' },
        { keyword: 'творог', days: 7, priority: 7, description: 'Творог, ~1 неделя' },
        { keyword: 'сливк', days: 7, priority: 6, description: 'Сливки, ~1 неделя' },
        { keyword: 'сыр твёрд', days: 28, priority: 8, description: 'Сыр твёрдый, ~4 недели' },
        { keyword: 'сыр мягк', days: 7, priority: 8, description: 'Сыр мягкий, ~1 неделя' },
        { keyword: 'сыр', days: 21, priority: 5, description: 'Сыр (общее), ~3 недели' },
        { keyword: 'масло сливочн', days: 30, priority: 8, description: 'Масло сливочное, ~1 месяц' },
        { keyword: 'маргарин', days: 60, priority: 7, description: 'Маргарин, ~2 месяца' },

        // --- Яйца ---
        { keyword: 'яйц', days: 28, priority: 7, description: 'Яйца, ~4 недели' },
        { keyword: 'яйцо', days: 28, priority: 7, description: 'Яйца, ~4 недели' },

        // --- Мясо сырое (охлаждённое) ---
        { keyword: 'говядин', days: 5, priority: 6, description: 'Говядина сырая, ~5 дней' },
        { keyword: 'свинин', days: 5, priority: 6, description: 'Свинина сырая, ~5 дней' },
        { keyword: 'баранин', days: 5, priority: 6, description: 'Баранина сырая, ~5 дней' },
        { keyword: 'фарш', days: 2, priority: 7, description: 'Фарш сырой, ~2 дня' },
        { keyword: 'стейк', days: 5, priority: 7, description: 'Стейк сырой, ~5 дней' },
        { keyword: 'котлет', days: 2, priority: 7, description: 'Котлеты сырые, ~2 дня' },

        // --- Птица сырая ---
        { keyword: 'куриц', days: 2, priority: 6, description: 'Курица сырая, ~2 дня' },
        { keyword: 'курин', days: 2, priority: 6, description: 'Курятина, ~2 дня' },
        { keyword: 'индейк', days: 2, priority: 6, description: 'Индейка сырая, ~2 дня' },
        { keyword: 'утк', days: 2, priority: 6, description: 'Утка сырая, ~2 дня' },
        { keyword: 'филе кур', days: 2, priority: 8, description: 'Куриное филе, ~2 дня' },

        // --- Рыба и морепродукты ---
        { keyword: 'рыб', days: 2, priority: 5, description: 'Рыба свежая, ~2 дня' },
        { keyword: 'лосос', days: 2, priority: 7, description: 'Лосось свежий, ~2 дня' },
        { keyword: 'сёмг', days: 2, priority: 7, description: 'Сёмга свежая, ~2 дня' },
        { keyword: 'форел', days: 2, priority: 7, description: 'Форель свежая, ~2 дня' },
        { keyword: 'креветк', days: 2, priority: 7, description: 'Креветки свежие, ~2 дня' },
        { keyword: 'кальмар', days: 2, priority: 7, description: 'Кальмары свежие, ~2 дня' },

        // --- Колбасные изделия ---
        { keyword: 'колбас', days: 14, priority: 6, description: 'Колбаса, ~2 недели' },
        { keyword: 'сосиск', days: 7, priority: 7, description: 'Сосиски, ~1 неделя' },
        { keyword: 'ветчин', days: 7, priority: 7, description: 'Ветчина, ~1 неделя' },
        { keyword: 'бекон', days: 7, priority: 7, description: 'Бекон, ~1 неделя' },
        { keyword: 'сардельк', days: 7, priority: 7, description: 'Сардельки, ~1 неделя' },

        // --- Овощи свежие ---
        { keyword: 'салат', days: 5, priority: 6, description: 'Салат листовой, ~5 дней' },
        { keyword: 'огурц', days: 7, priority: 6, description: 'Огурцы, ~1 неделя' },
        { keyword: 'помидор', days: 7, priority: 6, description: 'Помидоры, ~1 неделя' },
        { keyword: 'перец', days: 10, priority: 6, description: 'Перец сладкий, ~10 дней' },
        { keyword: 'морков', days: 21, priority: 6, description: 'Морковь, ~3 недели' },
        { keyword: 'капуст', days: 14, priority: 5, description: 'Капуста, ~2 недели' },
        { keyword: 'брокколи', days: 5, priority: 7, description: 'Брокколи, ~5 дней' },
        { keyword: 'цветн', days: 7, priority: 6, description: 'Цветная капуста, ~1 неделя' },
        { keyword: 'кабачк', days: 7, priority: 6, description: 'Кабачки, ~1 неделя' },
        { keyword: 'баклажан', days: 7, priority: 6, description: 'Баклажаны, ~1 неделя' },
        { keyword: 'редис', days: 14, priority: 6, description: 'Редис, ~2 недели' },
        { keyword: 'свёкл', days: 21, priority: 6, description: 'Свёкла, ~3 недели' },
        { keyword: 'свекл', days: 21, priority: 6, description: 'Свёкла, ~3 недели' },
        { keyword: 'сельдер', days: 14, priority: 6, description: 'Сельдерей, ~2 недели' },
        { keyword: 'шпинат', days: 5, priority: 7, description: 'Шпинат, ~5 дней' },
        { keyword: 'грибы', days: 5, priority: 6, description: 'Грибы свежие, ~5 дней' },

        // --- Зелень ---
        { keyword: 'укроп', days: 7, priority: 7, description: 'Укроп, ~1 неделя' },
        { keyword: 'петрушк', days: 7, priority: 7, description: 'Петрушка, ~1 неделя' },
        { keyword: 'базилик', days: 5, priority: 7, description: 'Базилик, ~5 дней' },
        { keyword: 'кинз', days: 7, priority: 7, description: 'Кинза, ~1 неделя' },
        { keyword: 'зелен', days: 7, priority: 5, description: 'Зелень, ~1 неделя' },
        { keyword: 'лук зелён', days: 7, priority: 8, description: 'Лук зелёный, ~1 неделя' },

        // --- Фрукты и ягоды ---
        { keyword: 'яблок', days: 30, priority: 6, description: 'Яблоки, ~1 месяц' },
        { keyword: 'груш', days: 7, priority: 6, description: 'Груши, ~1 неделя' },
        { keyword: 'виноград', days: 7, priority: 7, description: 'Виноград, ~1 неделя' },
        { keyword: 'клубник', days: 3, priority: 7, description: 'Клубника, ~3 дня' },
        { keyword: 'малин', days: 3, priority: 7, description: 'Малина, ~3 дня' },
        { keyword: 'черник', days: 7, priority: 7, description: 'Черника, ~1 неделя' },
        { keyword: 'апельсин', days: 21, priority: 6, description: 'Апельсины, ~3 недели' },
        { keyword: 'лимон', days: 30, priority: 6, description: 'Лимоны, ~1 месяц' },
        { keyword: 'мандарин', days: 14, priority: 6, description: 'Мандарины, ~2 недели' },
        { keyword: 'киви', days: 14, priority: 6, description: 'Киви, ~2 недели' },

        // --- Готовые блюда ---
        { keyword: 'суп', days: 4, priority: 6, description: 'Суп готовый, ~4 дня' },
        { keyword: 'борщ', days: 4, priority: 6, description: 'Борщ готовый, ~4 дня' },
        { keyword: 'каш', days: 3, priority: 6, description: 'Каша готовая, ~3 дня' },
        { keyword: 'плов', days: 4, priority: 6, description: 'Плов готовый, ~4 дня' },
        { keyword: 'салат готов', days: 2, priority: 8, description: 'Салат готовый, ~2 дня' },

        // --- Соусы и заправки ---
        { keyword: 'майонез', days: 60, priority: 7, description: 'Майонез открытый, ~2 месяца' },
        { keyword: 'кетчуп', days: 180, priority: 7, description: 'Кетчуп открытый, ~6 месяцев' },
        { keyword: 'горчиц', days: 180, priority: 7, description: 'Горчица открытая, ~6 месяцев' },
        { keyword: 'соус', days: 30, priority: 5, description: 'Соус открытый, ~1 месяц' },

        // --- Напитки ---
        { keyword: 'сок', days: 7, priority: 5, description: 'Сок открытый, ~1 неделя' },
      ];

      // Сроки для КЛАДОВКИ (pantry) — комнатная температура, сухое место
      const pantryEntries: { keyword: string; days: number; priority: number; description: string }[] = [
        // --- Крупы и злаки ---
        { keyword: 'рис', days: 365, priority: 6, description: 'Рис, ~12 месяцев' },
        { keyword: 'гречк', days: 365, priority: 6, description: 'Гречка, ~12 месяцев' },
        { keyword: 'овсянк', days: 365, priority: 6, description: 'Овсянка, ~12 месяцев' },
        { keyword: 'геркулес', days: 365, priority: 6, description: 'Геркулес, ~12 месяцев' },
        { keyword: 'пшен', days: 270, priority: 6, description: 'Пшено, ~9 месяцев' },
        { keyword: 'перловк', days: 365, priority: 6, description: 'Перловка, ~12 месяцев' },
        { keyword: 'манк', days: 365, priority: 6, description: 'Манка, ~12 месяцев' },
        { keyword: 'булгур', days: 365, priority: 6, description: 'Булгур, ~12 месяцев' },
        { keyword: 'кускус', days: 365, priority: 6, description: 'Кускус, ~12 месяцев' },
        { keyword: 'киноа', days: 365, priority: 6, description: 'Киноа, ~12 месяцев' },
        { keyword: 'крупа', days: 365, priority: 4, description: 'Крупа (общее), ~12 месяцев' },

        // --- Макаронные изделия ---
        { keyword: 'макарон', days: 730, priority: 6, description: 'Макароны, ~24 месяца' },
        { keyword: 'спагетти', days: 730, priority: 7, description: 'Спагетти, ~24 месяца' },
        { keyword: 'паста', days: 730, priority: 6, description: 'Паста, ~24 месяца' },
        { keyword: 'лапш', days: 730, priority: 6, description: 'Лапша, ~24 месяца' },
        { keyword: 'вермишел', days: 730, priority: 6, description: 'Вермишель, ~24 месяца' },

        // --- Мука и выпечка ---
        { keyword: 'мук', days: 365, priority: 5, description: 'Мука, ~12 месяцев' },
        { keyword: 'сахар', days: 730, priority: 6, description: 'Сахар, ~24 месяца' },
        { keyword: 'соль', days: 1825, priority: 6, description: 'Соль, ~5 лет' },
        { keyword: 'крахмал', days: 730, priority: 6, description: 'Крахмал, ~24 месяца' },
        { keyword: 'дрожж', days: 120, priority: 7, description: 'Дрожжи сухие, ~4 месяца' },
        { keyword: 'разрыхлител', days: 365, priority: 6, description: 'Разрыхлитель, ~12 месяцев' },
        { keyword: 'сода', days: 1095, priority: 6, description: 'Сода, ~3 года' },

        // --- Масла растительные ---
        { keyword: 'масло подсолнечн', days: 365, priority: 8, description: 'Масло подсолнечное, ~12 месяцев' },
        { keyword: 'масло оливков', days: 540, priority: 8, description: 'Масло оливковое, ~18 месяцев' },
        { keyword: 'масло растительн', days: 365, priority: 7, description: 'Масло растительное, ~12 месяцев' },

        // --- Консервы ---
        { keyword: 'консерв', days: 730, priority: 5, description: 'Консервы, ~24 месяца' },
        { keyword: 'тушёнк', days: 730, priority: 7, description: 'Тушёнка, ~24 месяца' },
        { keyword: 'тушенк', days: 730, priority: 7, description: 'Тушёнка, ~24 месяца' },
        { keyword: 'шпроты', days: 730, priority: 7, description: 'Шпроты, ~24 месяца' },
        { keyword: 'горошек консерв', days: 730, priority: 8, description: 'Горошек консервированный, ~24 месяца' },
        { keyword: 'кукуруз консерв', days: 730, priority: 8, description: 'Кукуруза консервированная, ~24 месяца' },
        { keyword: 'фасол консерв', days: 730, priority: 8, description: 'Фасоль консервированная, ~24 месяца' },
        { keyword: 'томат', days: 365, priority: 5, description: 'Томаты консервированные, ~12 месяцев' },
        { keyword: 'томатн паст', days: 365, priority: 8, description: 'Томатная паста, ~12 месяцев' },

        // --- Бобовые сухие ---
        { keyword: 'фасол', days: 365, priority: 5, description: 'Фасоль сухая, ~12 месяцев' },
        { keyword: 'горох', days: 365, priority: 5, description: 'Горох сухой, ~12 месяцев' },
        { keyword: 'чечевиц', days: 365, priority: 6, description: 'Чечевица, ~12 месяцев' },
        { keyword: 'нут', days: 365, priority: 6, description: 'Нут, ~12 месяцев' },

        // --- Орехи и сухофрукты ---
        { keyword: 'орех', days: 180, priority: 5, description: 'Орехи, ~6 месяцев' },
        { keyword: 'миндал', days: 180, priority: 6, description: 'Миндаль, ~6 месяцев' },
        { keyword: 'фундук', days: 180, priority: 6, description: 'Фундук, ~6 месяцев' },
        { keyword: 'грецк', days: 180, priority: 6, description: 'Грецкие орехи, ~6 месяцев' },
        { keyword: 'кешью', days: 180, priority: 6, description: 'Кешью, ~6 месяцев' },
        { keyword: 'изюм', days: 180, priority: 6, description: 'Изюм, ~6 месяцев' },
        { keyword: 'курага', days: 180, priority: 6, description: 'Курага, ~6 месяцев' },
        { keyword: 'чернослив', days: 180, priority: 6, description: 'Чернослив, ~6 месяцев' },
        { keyword: 'финик', days: 180, priority: 6, description: 'Финики, ~6 месяцев' },

        // --- Специи и приправы ---
        { keyword: 'специ', days: 730, priority: 5, description: 'Специи молотые, ~24 месяца' },
        { keyword: 'перец чёрн', days: 730, priority: 7, description: 'Перец чёрный, ~24 месяца' },
        { keyword: 'перец красн', days: 730, priority: 7, description: 'Перец красный, ~24 месяца' },
        { keyword: 'корица', days: 730, priority: 6, description: 'Корица, ~24 месяца' },
        { keyword: 'куркум', days: 730, priority: 6, description: 'Куркума, ~24 месяца' },
        { keyword: 'паприк', days: 730, priority: 6, description: 'Паприка, ~24 месяца' },
        { keyword: 'лавр', days: 730, priority: 6, description: 'Лавровый лист, ~24 месяца' },
        { keyword: 'ваниль', days: 365, priority: 6, description: 'Ваниль/ванилин, ~12 месяцев' },

        // --- Чай и кофе ---
        { keyword: 'чай', days: 365, priority: 5, description: 'Чай, ~12 месяцев' },
        { keyword: 'кофе', days: 365, priority: 5, description: 'Кофе, ~12 месяцев' },
        { keyword: 'какао', days: 730, priority: 6, description: 'Какао, ~24 месяца' },

        // --- Сладости ---
        { keyword: 'мёд', days: 730, priority: 6, description: 'Мёд, ~24 месяца' },
        { keyword: 'мед', days: 730, priority: 6, description: 'Мёд, ~24 месяца' },
        { keyword: 'варень', days: 365, priority: 6, description: 'Варенье, ~12 месяцев' },
        { keyword: 'джем', days: 365, priority: 6, description: 'Джем, ~12 месяцев' },
        { keyword: 'шоколад', days: 365, priority: 6, description: 'Шоколад, ~12 месяцев' },
        { keyword: 'печень', days: 180, priority: 5, description: 'Печенье, ~6 месяцев' },
        { keyword: 'конфет', days: 180, priority: 5, description: 'Конфеты, ~6 месяцев' },

        // --- Уксус и соусы ---
        { keyword: 'уксус', days: 730, priority: 6, description: 'Уксус, ~24 месяца' },
        { keyword: 'соевый соус', days: 730, priority: 8, description: 'Соевый соус, ~24 месяца' },

        // --- Овощи длительного хранения ---
        { keyword: 'лук', days: 60, priority: 4, description: 'Лук репчатый, ~2 месяца' },
        { keyword: 'чеснок', days: 90, priority: 6, description: 'Чеснок, ~3 месяца' },
        { keyword: 'картофел', days: 90, priority: 6, description: 'Картофель, ~3 месяца' },
        { keyword: 'картошк', days: 90, priority: 6, description: 'Картошка, ~3 месяца' },
        { keyword: 'тыкв', days: 90, priority: 6, description: 'Тыква целая, ~3 месяца' },

        // --- Хлеб ---
        { keyword: 'хлеб', days: 5, priority: 6, description: 'Хлеб, ~5 дней' },
        { keyword: 'батон', days: 3, priority: 6, description: 'Батон, ~3 дня' },
        { keyword: 'булочк', days: 3, priority: 6, description: 'Булочки, ~3 дня' },
        { keyword: 'сухар', days: 180, priority: 7, description: 'Сухари, ~6 месяцев' },
        { keyword: 'хлебц', days: 365, priority: 7, description: 'Хлебцы, ~12 месяцев' },
      ];

      // Вставляем данные для холодильника
      for (const e of fridgeEntries) {
        await sql`
          INSERT INTO shelf_life (storage_type, keyword, days, priority, description)
          VALUES ('fridge', ${e.keyword}, ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT (storage_type, keyword) DO UPDATE SET
            days = EXCLUDED.days,
            priority = EXCLUDED.priority,
            description = EXCLUDED.description
        `;
      }

      // Вставляем данные для кладовки
      for (const e of pantryEntries) {
        await sql`
          INSERT INTO shelf_life (storage_type, keyword, days, priority, description)
          VALUES ('pantry', ${e.keyword}, ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT (storage_type, keyword) DO UPDATE SET
            days = EXCLUDED.days,
            priority = EXCLUDED.priority,
            description = EXCLUDED.description
        `;
      }

      // Копируем данные из freezer_shelf_life в новую таблицу (для единообразия)
      await sql`
        INSERT INTO shelf_life (storage_type, keyword, days, priority, description)
        SELECT 'freezer', keyword, days, priority, description
        FROM freezer_shelf_life
        ON CONFLICT (storage_type, keyword) DO NOTHING
      `;
    },
  },
  {
    version: '022_products_name_ru_unique',
    up: async (sql) => {
      // Критический фикс: добавляем UNIQUE-индекс на products.name_ru.
      // Без него onConflictDoUpdate (используется в updateProductMasterPrices
      // и addBulk/syncAllToProducts) не может работать — PostgreSQL требует
      // UNIQUE constraint для ON CONFLICT.
      //
      // Сначала удаляем ВСЕ дубли по name_ru (оставляем запись с наибольшим id = самую свежую).
      // Старая версия удаляла только записи с barcode IS NULL, что приводило
      // к падению если дубль имел barcode (например "Томатный кетчуп").
      await sql`
        DELETE FROM products a
        USING products b
        WHERE a.name_ru = b.name_ru
          AND a.id < b.id
      `;
      // Создаём уникальный индекс
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_ru_unique
        ON products(name_ru)
      `;
    },
  },
  {
    version: '023_remove_off_products',
    up: async (sql) => {
      // Удаляем товары из международной базы Open Food Facts.
      // Оставляем только товары из чеков (у которых есть last_price)
      // и товары добавленные вручную (barcode IS NULL AND off_id IS NULL).
      // Пользователь хочет видеть в каталоге только СВОИ покупки.
      await sql`
        DELETE FROM products
        WHERE off_id IS NOT NULL
          AND last_price IS NULL
      `;
    },
  },
  {
    version: '024_products_store_and_date',
    up: async (sql) => {
      // Добавляем в products поля store_name и purchase_date.
      // Теперь после сканирования чека товар сохраняется с информацией
      // о магазине и дате покупки — чтобы пользователь мог отслеживать
      // динамику цен и видеть где что покупал.
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS store_name TEXT`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_date TEXT`;
    },
  },
  {
    version: '025_price_history',
    up: async (sql) => {
      // История цен — хранит КАЖДУЮ покупку товара отдельной записью.
      // Позволяет видеть динамику: «Куриные крылья: €5 (25.05) → €4.68 (18.05) → €6 (11.05)».
      // products хранит только ПОСЛЕДНЮЮ цену (для быстрого отображения в каталоге),
      // а price_history — полную историю для аналитики.
      await sql`
        CREATE TABLE IF NOT EXISTS price_history (
          id SERIAL PRIMARY KEY,
          product_name TEXT NOT NULL,
          price NUMERIC NOT NULL,
          store_name TEXT,
          purchase_date TEXT,
          currency TEXT NOT NULL DEFAULT 'EUR',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_price_history_product
        ON price_history(product_name, created_at DESC)
      `;
    },
  },
  {
    version: '026_normalize_recipe_categories',
    up: async (sql) => {
      // Нормализация существующих категорий рецептов. До этой миграции
      // category хранилась свободным текстом, из-за чего «Десерты», «Десерт»
      // и «десерт» (регистр + ед./мн. число) считались разными категориями
      // и дробили список рецептов на отдельные чипы с раздельными счётчиками.
      //
      // Проходим по всем уникальным значениям, приводим к каноничной метке
      // тем же нормализатором, что и пути записи (единый источник правды),
      // и обновляем строки, где значение изменилось. Идемпотентно: повторный
      // прогон не делает ничего (canonical === category).
      const rows = await sql<{ category: string }[]>`
        SELECT DISTINCT category FROM recipes
        WHERE category IS NOT NULL AND category <> ''
      `;
      for (const { category } of rows) {
        const canonical = normalizeRecipeCategory(category);
        if (canonical && canonical !== category) {
          await sql`
            UPDATE recipes SET category = ${canonical}
            WHERE category = ${category}
          `;
        }
      }
    },
  },
  {
    version: '027_preserves_allow_cooked',
    up: async (sql) => {
      // Тип 'cooked' (готовое блюдо) добавлен в код позже миграции 019:
      // cook-флоу (recipes.cook) вставляет в preserves запись типа 'cooked'
      // с порциями. Но CHECK-констрейнт из 019 разрешал только
      // frozen/preserved/opened, поэтому нажатие «Готовить» падало с
      // ошибкой: new row for relation "preserves" violates check
      // constraint "preserves_preserve_type_check".
      //
      // Пересоздаём констрейнт, добавив 'cooked'. DROP ... IF EXISTS +
      // ADD — идемпотентно в рамках одного прогона миграции.
      await sql`
        ALTER TABLE preserves
        DROP CONSTRAINT IF EXISTS preserves_preserve_type_check
      `;
      await sql`
        ALTER TABLE preserves
        ADD CONSTRAINT preserves_preserve_type_check
        CHECK (preserve_type IN ('frozen','preserved','opened','cooked'))
      `;
    },
  },
  {
    version: '028_menus_unique_user_week',
    up: async (sql) => {
      // Дедупликация: если есть дубли (user_id, week_start_date) — оставляем
      // один (с наименьшим id), остальные удаляем. Затем создаём уникальный
      // индекс. Это делает getWeek/addItem race-safe: INSERT ON CONFLICT DO NOTHING.
      await sql`
        DELETE FROM menus
        WHERE id NOT IN (
          SELECT MIN(id) FROM menus GROUP BY user_id, week_start_date
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_menus_user_week
        ON menus(user_id, week_start_date)
      `;
    },
  },
  {
    version: '029_performance_indexes',
    up: async (sql) => {
      // Индексы для масштабирования на 15000+ рецептов:
      //
      // 1. recipes.category — фильтр по категории (чипы на странице рецептов)
      //    и GROUP BY в getCategories. Без индекса — seq-scan всей таблицы.
      await sql`
        CREATE INDEX IF NOT EXISTS idx_recipes_category
        ON recipes(category) WHERE category IS NOT NULL
      `;

      // 2. recipes.title — для текстового поиска (ILIKE %term%).
      //    pg_trgm GIN индекс ускоряет LIKE/ILIKE с wildcard.
      await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_recipes_title_trgm
        ON recipes USING gin(title gin_trgm_ops)
      `;

      // 3. recipe_ingredients.recipe_id — JOIN при загрузке ингредиентов
      //    рецепта (cook, whatToCook, getSuggestions). FK обычно создаёт
      //    индекс автоматически, но на всякий случай.
      await sql`
        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
        ON recipe_ingredients(recipe_id)
      `;

      // 4. inventory(user_id, expiry_date) — для быстрой выборки
      //    истекающих продуктов (алерты на главной, whatToCook).
      await sql`
        CREATE INDEX IF NOT EXISTS idx_inventory_user_expiry
        ON inventory(user_id, expiry_date) WHERE expiry_date IS NOT NULL
      `;

      // 5. cooking_history(user_id, recipe_id, cooked_at) — для
      //    getSuggestions (последняя готовка каждого рецепта).
      await sql`
        CREATE INDEX IF NOT EXISTS idx_cooking_history_user_recipe
        ON cooking_history(user_id, recipe_id, cooked_at DESC)
      `;

      // 6. receipts(user_id, created_at) — список чеков с сортировкой.
      await sql`
        CREATE INDEX IF NOT EXISTS idx_receipts_user_created
        ON receipts(user_id, created_at DESC)
      `;
    },
  },
  {
    version: '030_freezer_bakery_desserts',
    up: async (sql) => {
      // Добавляем выпечку и десерты в справочник сроков заморозки.
      // Ранее эти категории отсутствовали — при замораживании тортов,
      // пирогов, кексов и т.д. система не подсказывала срок годности.
      const entries = [
        // --- Выпечка ---
        { keyword: 'пирог', days: 120, priority: 7, description: 'Пирог, ~4 мес' },
        { keyword: 'пирож', days: 90, priority: 7, description: 'Пирожки, ~3 мес' },
        { keyword: 'кулич', days: 120, priority: 7, description: 'Кулич, ~4 мес' },
        { keyword: 'кекс', days: 120, priority: 7, description: 'Кекс, ~4 мес' },
        { keyword: 'маффин', days: 90, priority: 7, description: 'Маффины, ~3 мес' },
        { keyword: 'круассан', days: 60, priority: 7, description: 'Круассаны, ~2 мес' },
        { keyword: 'штрудел', days: 90, priority: 7, description: 'Штрудель, ~3 мес' },
        { keyword: 'шарлотк', days: 90, priority: 7, description: 'Шарлотка, ~3 мес' },
        { keyword: 'чебурек', days: 90, priority: 7, description: 'Чебуреки, ~3 мес' },
        { keyword: 'самса', days: 90, priority: 7, description: 'Самса, ~3 мес' },
        { keyword: 'хачапур', days: 60, priority: 7, description: 'Хачапури, ~2 мес' },
        { keyword: 'пицц', days: 60, priority: 7, description: 'Пицца, ~2 мес' },
        { keyword: 'лепёшк', days: 90, priority: 6, description: 'Лепёшки, ~3 мес' },
        { keyword: 'лепешк', days: 90, priority: 6, description: 'Лепёшки, ~3 мес' },
        { keyword: 'сырник', days: 60, priority: 7, description: 'Сырники, ~2 мес' },
        { keyword: 'оладь', days: 60, priority: 7, description: 'Оладьи, ~2 мес' },
        { keyword: 'выпечк', days: 90, priority: 5, description: 'Выпечка (общее), ~3 мес' },

        // --- Десерты ---
        { keyword: 'торт', days: 90, priority: 7, description: 'Торт, ~3 мес' },
        { keyword: 'чизкейк', days: 90, priority: 8, description: 'Чизкейк, ~3 мес' },
        { keyword: 'тирамису', days: 60, priority: 8, description: 'Тирамису, ~2 мес' },
        { keyword: 'бисквит', days: 120, priority: 7, description: 'Бисквит, ~4 мес' },
        { keyword: 'безе', days: 90, priority: 7, description: 'Безе/Меренга, ~3 мес' },
        { keyword: 'меренг', days: 90, priority: 7, description: 'Меренга, ~3 мес' },
        { keyword: 'пирожн', days: 60, priority: 7, description: 'Пирожное, ~2 мес' },
        { keyword: 'эклер', days: 60, priority: 7, description: 'Эклеры, ~2 мес' },
        { keyword: 'профитрол', days: 60, priority: 7, description: 'Профитроли, ~2 мес' },
        { keyword: 'брауни', days: 90, priority: 7, description: 'Брауни, ~3 мес' },
        { keyword: 'печень', days: 120, priority: 5, description: 'Печенье, ~4 мес' },
        { keyword: 'вафл', days: 90, priority: 6, description: 'Вафли, ~3 мес' },
        { keyword: 'зефир', days: 60, priority: 7, description: 'Зефир, ~2 мес' },
        { keyword: 'пастил', days: 90, priority: 7, description: 'Пастила, ~3 мес' },
        { keyword: 'мусс', days: 60, priority: 6, description: 'Мусс, ~2 мес' },
        { keyword: 'панна', days: 60, priority: 7, description: 'Панна-котта, ~2 мес' },
        { keyword: 'желе', days: 30, priority: 6, description: 'Желе, ~1 мес' },
        { keyword: 'мороженое', days: 120, priority: 7, description: 'Мороженое, ~4 мес' },
        { keyword: 'морожен', days: 120, priority: 6, description: 'Мороженое, ~4 мес' },
        { keyword: 'сорбет', days: 120, priority: 7, description: 'Сорбет, ~4 мес' },
        { keyword: 'десерт', days: 60, priority: 4, description: 'Десерт (общее), ~2 мес' },

        // --- Крем и начинки ---
        { keyword: 'крем', days: 60, priority: 5, description: 'Крем кондитерский, ~2 мес' },
        { keyword: 'глазур', days: 120, priority: 6, description: 'Глазурь, ~4 мес' },
        { keyword: 'ганаш', days: 90, priority: 7, description: 'Ганаш, ~3 мес' },
        { keyword: 'начинк', days: 60, priority: 5, description: 'Начинка, ~2 мес' },
      ];

      for (const e of entries) {
        await sql`
          INSERT INTO freezer_shelf_life (keyword, days, priority, description)
          VALUES (${e.keyword}, ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT (keyword) DO UPDATE SET
            days = EXCLUDED.days,
            priority = EXCLUDED.priority,
            description = EXCLUDED.description
        `;
      }
    },
  },
  {
    version: '031_shelf_life_missing_pantry_keywords',
    up: async (sql) => {
      // Добавляем недостающие ключевые слова в shelf_life для pantry.
      // Проблема: recalcExpiry не находил совпадения для майонеза, воды,
      // сгущёнки, подсолнечного масла (порядок слов другой) и перца (ё/е).
      const entries = [
        // Соусы и приправы (pantry)
        { storageType: 'pantry', keyword: 'майонез', days: 180, priority: 7, description: 'Майонез закрытый, ~6 месяцев' },
        { storageType: 'pantry', keyword: 'кетчуп', days: 365, priority: 7, description: 'Кетчуп, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'горчиц', days: 365, priority: 6, description: 'Горчица, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'соевый соус', days: 730, priority: 7, description: 'Соевый соус, ~24 месяца' },
        // Вода
        { storageType: 'pantry', keyword: 'вода', days: 365, priority: 3, description: 'Вода бутилированная, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'минеральн', days: 365, priority: 5, description: 'Минеральная вода, ~12 месяцев' },
        // Сгущёнка
        { storageType: 'pantry', keyword: 'сгущён', days: 365, priority: 7, description: 'Сгущёнка, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'сгущенк', days: 365, priority: 7, description: 'Сгущёнка, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'сгущенн', days: 365, priority: 6, description: 'Сгущённое молоко, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'конденс', days: 365, priority: 5, description: 'Конденсированное молоко, ~12 месяцев' },
        // Масло подсолнечное — вариант порядка слов
        { storageType: 'pantry', keyword: 'подсолнечн', days: 365, priority: 7, description: 'Подсолнечное масло, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'sonnenblumen', days: 365, priority: 6, description: 'Sonnenblumenöl, ~12 месяцев' },
        // Перец — вариант без ё
        { storageType: 'pantry', keyword: 'перец черн', days: 730, priority: 7, description: 'Перец чёрный, ~24 месяца' },
        { storageType: 'pantry', keyword: 'черный перец', days: 730, priority: 7, description: 'Чёрный перец, ~24 месяца' },
        { storageType: 'pantry', keyword: 'черн перец', days: 730, priority: 6, description: 'Чёрный перец, ~24 месяца' },
        { storageType: 'pantry', keyword: 'pieprz', days: 730, priority: 5, description: 'Pieprz (перец), ~24 месяца' },
        // Чай — иностранные варианты
        { storageType: 'pantry', keyword: 'herbata', days: 365, priority: 5, description: 'Herbata (чай), ~12 месяцев' },
        { storageType: 'pantry', keyword: 'thee', days: 365, priority: 5, description: 'Thee (чай), ~12 месяцев' },
        { storageType: 'pantry', keyword: 'tee', days: 365, priority: 5, description: 'Tee (чай), ~12 месяцев' },
        // Соль — иностранные
        { storageType: 'pantry', keyword: 'salz', days: 1825, priority: 5, description: 'Salz (соль), ~5 лет' },
        { storageType: 'pantry', keyword: 'zout', days: 1825, priority: 5, description: 'Zout (соль), ~5 лет' },
        // Крупа — иностранные
        { storageType: 'pantry', keyword: 'grütze', days: 365, priority: 5, description: 'Grütze (крупа), ~12 месяцев' },
        { storageType: 'pantry', keyword: 'gruetze', days: 365, priority: 5, description: 'Grütze (крупа), ~12 месяцев' },
        { storageType: 'pantry', keyword: 'krupa', days: 365, priority: 5, description: 'Крупа, ~12 месяцев' },
        // Холодильник — майонез открытый
        { storageType: 'fridge', keyword: 'майонез', days: 30, priority: 7, description: 'Майонез открытый, ~1 месяц' },
        { storageType: 'fridge', keyword: 'кетчуп', days: 60, priority: 6, description: 'Кетчуп открытый, ~2 месяца' },
        { storageType: 'fridge', keyword: 'вода', days: 7, priority: 2, description: 'Вода открытая, ~7 дней' },
      ];

      for (const e of entries) {
        await sql`
          INSERT INTO shelf_life (storage_type, keyword, days, priority, description)
          VALUES (${e.storageType}, ${e.keyword}, ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT DO NOTHING
        `;
      }
    },
  },
  {
    version: '032_inventory_is_basic',
    up: async (sql) => {
      // «Базовые продукты» — соль, масло, мука и т.д. которые ВСЕГДА есть дома.
      // При генерации списка покупок из меню (toShopping) и при готовке (cook)
      // базовые продукты не добавляются в покупки как недостающие.
      // Пользователь помечает продукт как базовый через UI.
      await sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_basic INTEGER NOT NULL DEFAULT 0`;
    },
  },
  {
    version: '033_usda_reference_data',
    up: async (sql) => {
      // ═══════════════════════════════════════════════════════════════════
      // Обогащение справочников данными из открытых источников:
      //
      // 1) INGREDIENTS — ~150 популярных продуктов с КБЖУ
      //    Источник: USDA FoodData Central, SR Legacy (public domain)
      //    https://fdc.nal.usda.gov/
      //    Значения: kcal/protein/fats/carbs на 100г
      //
      // 2) SHELF_LIFE — расширение справочника сроков хранения
      //    Источники: USDA FoodKeeper App (public domain),
      //    FDA Food Code, HACCP Reference Guides
      //    https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts
      //
      // Все данные — public domain (правительство США).
      // Идемпотентно: ON CONFLICT DO UPDATE / DO NOTHING.
      // ═══════════════════════════════════════════════════════════════════

      // ─── ЧАСТЬ 1: Ингредиенты (USDA FoodData Central SR Legacy) ───
      // Добавляем популярные продукты домашней кухни с нутриентами.
      // Категории: Молочные, Мясо, Птица, Рыба, Овощи, Фрукты,
      //            Зерновые, Бобовые, Орехи, Жиры, Специи, Выпечка,
      //            Напитки, Сладости/Десерты (новые!)
      //
      // fdc_id — реальные ID из USDA FDC для трассируемости данных.

      const ingredients: {
        fdcId: number; nameRu: string; nameEn: string; category: string;
        kcal: number; protein: number; fats: number; carbs: number; water: number | null;
      }[] = [
        // ─── Молочные и яйца ───
        { fdcId: 171265, nameRu: 'Молоко цельное 3.25%', nameEn: 'Milk, whole, 3.25% milkfat', category: 'Молочные и яйца', kcal: 61, protein: 3.2, fats: 3.3, carbs: 4.8, water: 88 },
        { fdcId: 171270, nameRu: 'Молоко обезжиренное', nameEn: 'Milk, nonfat, fluid', category: 'Молочные и яйца', kcal: 34, protein: 3.4, fats: 0.1, carbs: 5.0, water: 91 },
        { fdcId: 170903, nameRu: 'Кефир', nameEn: 'Kefir, plain, whole milk', category: 'Молочные и яйца', kcal: 63, protein: 3.3, fats: 3.5, carbs: 4.0, water: 88 },
        { fdcId: 171286, nameRu: 'Йогурт натуральный', nameEn: 'Yogurt, plain, whole milk', category: 'Молочные и яйца', kcal: 61, protein: 3.5, fats: 3.3, carbs: 4.7, water: 88 },
        { fdcId: 170886, nameRu: 'Сметана 20%', nameEn: 'Cream, sour, regular', category: 'Молочные и яйца', kcal: 198, protein: 2.1, fats: 19.7, carbs: 3.1, water: 74 },
        { fdcId: 170848, nameRu: 'Творог 9%', nameEn: 'Cheese, cottage, creamed', category: 'Молочные и яйца', kcal: 98, protein: 11.1, fats: 4.3, carbs: 3.4, water: 80 },
        { fdcId: 171241, nameRu: 'Сыр Чеддер', nameEn: 'Cheese, cheddar', category: 'Молочные и яйца', kcal: 403, protein: 24.9, fats: 33.1, carbs: 1.3, water: 37 },
        { fdcId: 170849, nameRu: 'Сыр Моцарелла', nameEn: 'Cheese, mozzarella, whole milk', category: 'Молочные и яйца', kcal: 300, protein: 22.2, fats: 22.4, carbs: 2.2, water: 50 },
        { fdcId: 171251, nameRu: 'Сыр Пармезан', nameEn: 'Cheese, parmesan, hard', category: 'Молочные и яйца', kcal: 392, protein: 35.8, fats: 25.8, carbs: 3.2, water: 30 },
        { fdcId: 170874, nameRu: 'Сыр Фета', nameEn: 'Cheese, feta', category: 'Молочные и яйца', kcal: 264, protein: 14.2, fats: 21.3, carbs: 4.1, water: 55 },
        { fdcId: 171287, nameRu: 'Масло сливочное', nameEn: 'Butter, salted', category: 'Молочные и яйца', kcal: 717, protein: 0.9, fats: 81.1, carbs: 0.1, water: 17 },
        { fdcId: 171142, nameRu: 'Сливки 33%', nameEn: 'Cream, fluid, heavy whipping', category: 'Молочные и яйца', kcal: 340, protein: 2.1, fats: 36.1, carbs: 2.8, water: 58 },
        { fdcId: 171287, nameRu: 'Яйцо куриное целое', nameEn: 'Egg, whole, raw, fresh', category: 'Молочные и яйца', kcal: 143, protein: 12.6, fats: 9.5, carbs: 0.7, water: 76 },

        // ─── Говядина ───
        { fdcId: 174032, nameRu: 'Говядина, вырезка', nameEn: 'Beef, tenderloin, raw', category: 'Говядина', kcal: 218, protein: 20.4, fats: 14.7, carbs: 0, water: 64 },
        { fdcId: 174036, nameRu: 'Говядина, лопатка', nameEn: 'Beef, chuck, shoulder clod, raw', category: 'Говядина', kcal: 156, protein: 20.2, fats: 7.8, carbs: 0, water: 71 },
        { fdcId: 174037, nameRu: 'Говяжий фарш (85/15)', nameEn: 'Beef, ground, 85% lean meat / 15% fat, raw', category: 'Говядина', kcal: 215, protein: 18.6, fats: 15.0, carbs: 0, water: 65 },
        { fdcId: 174038, nameRu: 'Говяжья печень', nameEn: 'Beef, liver, raw', category: 'Говядина', kcal: 135, protein: 20.4, fats: 3.6, carbs: 3.9, water: 71 },
        { fdcId: 174039, nameRu: 'Говядина тушёная', nameEn: 'Beef, stew meat, cooked', category: 'Говядина', kcal: 234, protein: 28.6, fats: 12.5, carbs: 0, water: 57 },

        // ─── Свинина ───
        { fdcId: 167820, nameRu: 'Свинина, корейка', nameEn: 'Pork, loin, center rib, raw', category: 'Свинина', kcal: 172, protein: 20.9, fats: 9.3, carbs: 0, water: 69 },
        { fdcId: 167821, nameRu: 'Свинина, лопатка', nameEn: 'Pork, shoulder, raw', category: 'Свинина', kcal: 236, protein: 16.7, fats: 18.3, carbs: 0, water: 64 },
        { fdcId: 167822, nameRu: 'Свиной фарш', nameEn: 'Pork, ground, raw', category: 'Свинина', kcal: 263, protein: 16.9, fats: 21.2, carbs: 0, water: 61 },
        { fdcId: 167826, nameRu: 'Бекон', nameEn: 'Pork, cured, bacon, raw', category: 'Свинина', kcal: 417, protein: 12.6, fats: 40.0, carbs: 1.4, water: 42 },
        { fdcId: 167828, nameRu: 'Сало', nameEn: 'Pork, cured, salt pork, raw', category: 'Свинина', kcal: 748, protein: 5.1, fats: 80.5, carbs: 0, water: 13 },

        // ─── Птица ───
        { fdcId: 171077, nameRu: 'Куриная грудка', nameEn: 'Chicken, breast, meat only, raw', category: 'Птица', kcal: 120, protein: 22.5, fats: 2.6, carbs: 0, water: 74 },
        { fdcId: 171079, nameRu: 'Куриное бедро', nameEn: 'Chicken, thigh, meat only, raw', category: 'Птица', kcal: 177, protein: 18.3, fats: 10.9, carbs: 0, water: 70 },
        { fdcId: 171081, nameRu: 'Куриные крылья', nameEn: 'Chicken, wing, meat and skin, raw', category: 'Птица', kcal: 222, protein: 18.3, fats: 15.8, carbs: 0, water: 64 },
        { fdcId: 171082, nameRu: 'Куриная печень', nameEn: 'Chicken, liver, raw', category: 'Птица', kcal: 119, protein: 16.9, fats: 4.8, carbs: 0.7, water: 76 },
        { fdcId: 171093, nameRu: 'Индейка, грудка', nameEn: 'Turkey, breast, meat only, raw', category: 'Птица', kcal: 104, protein: 23.7, fats: 0.7, carbs: 0, water: 75 },
        { fdcId: 171095, nameRu: 'Утка', nameEn: 'Duck, meat only, raw', category: 'Птица', kcal: 135, protein: 19.3, fats: 5.9, carbs: 0, water: 74 },

        // ─── Рыба и морепродукты ───
        { fdcId: 175167, nameRu: 'Лосось атлантический', nameEn: 'Fish, salmon, Atlantic, raw', category: 'Рыба и морепродукты', kcal: 208, protein: 20.4, fats: 13.4, carbs: 0, water: 65 },
        { fdcId: 175168, nameRu: 'Тунец', nameEn: 'Fish, tuna, fresh, raw', category: 'Рыба и морепродукты', kcal: 144, protein: 23.3, fats: 4.9, carbs: 0, water: 71 },
        { fdcId: 175169, nameRu: 'Треска', nameEn: 'Fish, cod, Atlantic, raw', category: 'Рыба и морепродукты', kcal: 82, protein: 17.8, fats: 0.7, carbs: 0, water: 81 },
        { fdcId: 175170, nameRu: 'Форель радужная', nameEn: 'Fish, trout, rainbow, raw', category: 'Рыба и морепродукты', kcal: 141, protein: 20.5, fats: 6.2, carbs: 0, water: 72 },
        { fdcId: 175171, nameRu: 'Скумбрия', nameEn: 'Fish, mackerel, Atlantic, raw', category: 'Рыба и морепродукты', kcal: 205, protein: 18.6, fats: 13.9, carbs: 0, water: 64 },
        { fdcId: 175172, nameRu: 'Сельдь', nameEn: 'Fish, herring, Atlantic, raw', category: 'Рыба и морепродукты', kcal: 158, protein: 18.0, fats: 9.0, carbs: 0, water: 72 },
        { fdcId: 175174, nameRu: 'Креветки', nameEn: 'Crustaceans, shrimp, raw', category: 'Рыба и морепродукты', kcal: 85, protein: 20.1, fats: 0.5, carbs: 0.9, water: 79 },
        { fdcId: 175175, nameRu: 'Кальмар', nameEn: 'Mollusks, squid, raw', category: 'Рыба и морепродукты', kcal: 92, protein: 15.6, fats: 1.4, carbs: 3.1, water: 79 },
        { fdcId: 175176, nameRu: 'Мидии', nameEn: 'Mollusks, mussel, blue, raw', category: 'Рыба и морепродукты', kcal: 86, protein: 11.9, fats: 2.2, carbs: 3.7, water: 81 },
        { fdcId: 175178, nameRu: 'Минтай', nameEn: 'Fish, pollock, raw', category: 'Рыба и морепродукты', kcal: 92, protein: 19.4, fats: 1.0, carbs: 0, water: 79 },

        // ─── Овощи ───
        { fdcId: 170393, nameRu: 'Картофель', nameEn: 'Potatoes, raw, flesh and skin', category: 'Овощи', kcal: 77, protein: 2.1, fats: 0.1, carbs: 17.5, water: 79 },
        { fdcId: 170394, nameRu: 'Морковь', nameEn: 'Carrots, raw', category: 'Овощи', kcal: 41, protein: 0.9, fats: 0.2, carbs: 9.6, water: 88 },
        { fdcId: 170395, nameRu: 'Свёкла', nameEn: 'Beets, raw', category: 'Овощи', kcal: 43, protein: 1.6, fats: 0.2, carbs: 9.6, water: 88 },
        { fdcId: 170396, nameRu: 'Капуста белокочанная', nameEn: 'Cabbage, raw', category: 'Овощи', kcal: 25, protein: 1.3, fats: 0.1, carbs: 5.8, water: 92 },
        { fdcId: 170397, nameRu: 'Цветная капуста', nameEn: 'Cauliflower, raw', category: 'Овощи', kcal: 25, protein: 1.9, fats: 0.3, carbs: 5.0, water: 92 },
        { fdcId: 170398, nameRu: 'Брокколи', nameEn: 'Broccoli, raw', category: 'Овощи', kcal: 34, protein: 2.8, fats: 0.4, carbs: 6.6, water: 89 },
        { fdcId: 170399, nameRu: 'Огурец', nameEn: 'Cucumber, with peel, raw', category: 'Овощи', kcal: 15, protein: 0.7, fats: 0.1, carbs: 3.6, water: 95 },
        { fdcId: 170400, nameRu: 'Помидор', nameEn: 'Tomatoes, red, ripe, raw', category: 'Овощи', kcal: 18, protein: 0.9, fats: 0.2, carbs: 3.9, water: 95 },
        { fdcId: 170401, nameRu: 'Перец сладкий', nameEn: 'Peppers, sweet, red, raw', category: 'Овощи', kcal: 31, protein: 1.0, fats: 0.3, carbs: 6.0, water: 92 },
        { fdcId: 170402, nameRu: 'Кабачок', nameEn: 'Squash, summer, zucchini, raw', category: 'Овощи', kcal: 17, protein: 1.2, fats: 0.3, carbs: 3.1, water: 95 },
        { fdcId: 170403, nameRu: 'Баклажан', nameEn: 'Eggplant, raw', category: 'Овощи', kcal: 25, protein: 1.0, fats: 0.2, carbs: 6.0, water: 92 },
        { fdcId: 170404, nameRu: 'Лук репчатый', nameEn: 'Onions, raw', category: 'Овощи', kcal: 40, protein: 1.1, fats: 0.1, carbs: 9.3, water: 89 },
        { fdcId: 170405, nameRu: 'Чеснок', nameEn: 'Garlic, raw', category: 'Овощи', kcal: 149, protein: 6.4, fats: 0.5, carbs: 33.1, water: 59 },
        { fdcId: 170406, nameRu: 'Тыква', nameEn: 'Pumpkin, raw', category: 'Овощи', kcal: 26, protein: 1.0, fats: 0.1, carbs: 6.5, water: 92 },
        { fdcId: 170407, nameRu: 'Шпинат', nameEn: 'Spinach, raw', category: 'Овощи', kcal: 23, protein: 2.9, fats: 0.4, carbs: 3.6, water: 91 },
        { fdcId: 170408, nameRu: 'Грибы шампиньоны', nameEn: 'Mushrooms, white, raw', category: 'Овощи', kcal: 22, protein: 3.1, fats: 0.3, carbs: 3.3, water: 92 },
        { fdcId: 170409, nameRu: 'Редис', nameEn: 'Radishes, raw', category: 'Овощи', kcal: 16, protein: 0.7, fats: 0.1, carbs: 3.4, water: 95 },
        { fdcId: 170410, nameRu: 'Сельдерей', nameEn: 'Celery, raw', category: 'Овощи', kcal: 14, protein: 0.7, fats: 0.2, carbs: 3.0, water: 95 },
        { fdcId: 170411, nameRu: 'Авокадо', nameEn: 'Avocados, raw', category: 'Овощи', kcal: 160, protein: 2.0, fats: 14.7, carbs: 8.5, water: 73 },
        { fdcId: 170412, nameRu: 'Кукуруза', nameEn: 'Corn, sweet, raw', category: 'Овощи', kcal: 86, protein: 3.3, fats: 1.4, carbs: 18.7, water: 76 },

        // ─── Фрукты ───
        { fdcId: 171688, nameRu: 'Яблоко', nameEn: 'Apples, raw, with skin', category: 'Фрукты', kcal: 52, protein: 0.3, fats: 0.2, carbs: 13.8, water: 86 },
        { fdcId: 171689, nameRu: 'Банан', nameEn: 'Bananas, raw', category: 'Фрукты', kcal: 89, protein: 1.1, fats: 0.3, carbs: 22.8, water: 75 },
        { fdcId: 171690, nameRu: 'Апельсин', nameEn: 'Oranges, raw', category: 'Фрукты', kcal: 47, protein: 0.9, fats: 0.1, carbs: 11.8, water: 87 },
        { fdcId: 171691, nameRu: 'Лимон', nameEn: 'Lemons, raw, without peel', category: 'Фрукты', kcal: 29, protein: 1.1, fats: 0.3, carbs: 9.3, water: 89 },
        { fdcId: 171692, nameRu: 'Грейпфрут', nameEn: 'Grapefruit, raw, pink', category: 'Фрукты', kcal: 42, protein: 0.8, fats: 0.1, carbs: 10.7, water: 88 },
        { fdcId: 171693, nameRu: 'Мандарин', nameEn: 'Tangerines (mandarins), raw', category: 'Фрукты', kcal: 53, protein: 0.8, fats: 0.3, carbs: 13.3, water: 85 },
        { fdcId: 171694, nameRu: 'Виноград', nameEn: 'Grapes, red or green, raw', category: 'Фрукты', kcal: 69, protein: 0.7, fats: 0.2, carbs: 18.1, water: 81 },
        { fdcId: 171695, nameRu: 'Клубника', nameEn: 'Strawberries, raw', category: 'Фрукты', kcal: 32, protein: 0.7, fats: 0.3, carbs: 7.7, water: 91 },
        { fdcId: 171696, nameRu: 'Малина', nameEn: 'Raspberries, raw', category: 'Фрукты', kcal: 52, protein: 1.2, fats: 0.7, carbs: 11.9, water: 86 },
        { fdcId: 171697, nameRu: 'Черника', nameEn: 'Blueberries, raw', category: 'Фрукты', kcal: 57, protein: 0.7, fats: 0.3, carbs: 14.5, water: 84 },
        { fdcId: 171698, nameRu: 'Вишня', nameEn: 'Cherries, sweet, raw', category: 'Фрукты', kcal: 63, protein: 1.1, fats: 0.2, carbs: 16.0, water: 82 },
        { fdcId: 171699, nameRu: 'Персик', nameEn: 'Peaches, raw', category: 'Фрукты', kcal: 39, protein: 0.9, fats: 0.3, carbs: 9.5, water: 89 },
        { fdcId: 171700, nameRu: 'Груша', nameEn: 'Pears, raw', category: 'Фрукты', kcal: 57, protein: 0.4, fats: 0.1, carbs: 15.2, water: 84 },
        { fdcId: 171701, nameRu: 'Слива', nameEn: 'Plums, raw', category: 'Фрукты', kcal: 46, protein: 0.7, fats: 0.3, carbs: 11.4, water: 87 },
        { fdcId: 171702, nameRu: 'Абрикос', nameEn: 'Apricots, raw', category: 'Фрукты', kcal: 48, protein: 1.4, fats: 0.4, carbs: 11.1, water: 86 },
        { fdcId: 171703, nameRu: 'Манго', nameEn: 'Mangos, raw', category: 'Фрукты', kcal: 60, protein: 0.8, fats: 0.4, carbs: 15.0, water: 84 },
        { fdcId: 171704, nameRu: 'Ананас', nameEn: 'Pineapple, raw', category: 'Фрукты', kcal: 50, protein: 0.5, fats: 0.1, carbs: 13.1, water: 86 },
        { fdcId: 171705, nameRu: 'Киви', nameEn: 'Kiwifruit, green, raw', category: 'Фрукты', kcal: 61, protein: 1.1, fats: 0.5, carbs: 14.7, water: 83 },
        { fdcId: 171706, nameRu: 'Арбуз', nameEn: 'Watermelon, raw', category: 'Фрукты', kcal: 30, protein: 0.6, fats: 0.2, carbs: 7.6, water: 91 },
        { fdcId: 171707, nameRu: 'Дыня', nameEn: 'Melons, cantaloupe, raw', category: 'Фрукты', kcal: 34, protein: 0.8, fats: 0.2, carbs: 8.2, water: 90 },
        { fdcId: 171708, nameRu: 'Гранат', nameEn: 'Pomegranates, raw', category: 'Фрукты', kcal: 83, protein: 1.7, fats: 1.2, carbs: 18.7, water: 78 },
        { fdcId: 171709, nameRu: 'Хурма', nameEn: 'Persimmons, raw', category: 'Фрукты', kcal: 70, protein: 0.6, fats: 0.2, carbs: 18.6, water: 80 },

        // ─── Зерновые и макароны ───
        { fdcId: 169717, nameRu: 'Рис белый', nameEn: 'Rice, white, long-grain, raw', category: 'Зерновые и макароны', kcal: 365, protein: 7.1, fats: 0.7, carbs: 80.0, water: 12 },
        { fdcId: 169718, nameRu: 'Рис бурый', nameEn: 'Rice, brown, long-grain, raw', category: 'Зерновые и макароны', kcal: 370, protein: 7.9, fats: 2.9, carbs: 77.2, water: 11 },
        { fdcId: 169719, nameRu: 'Гречка', nameEn: 'Buckwheat groats, roasted, dry', category: 'Зерновые и макароны', kcal: 346, protein: 11.7, fats: 2.7, carbs: 74.9, water: 10 },
        { fdcId: 169720, nameRu: 'Овсянка (геркулес)', nameEn: 'Oats, regular and quick, not fortified, dry', category: 'Зерновые и макароны', kcal: 379, protein: 13.2, fats: 6.5, carbs: 67.7, water: 11 },
        { fdcId: 169721, nameRu: 'Пшено', nameEn: 'Millet, raw', category: 'Зерновые и макароны', kcal: 378, protein: 11.0, fats: 4.2, carbs: 72.8, water: 9 },
        { fdcId: 169722, nameRu: 'Перловка', nameEn: 'Barley, pearled, raw', category: 'Зерновые и макароны', kcal: 352, protein: 9.9, fats: 1.2, carbs: 77.7, water: 10 },
        { fdcId: 169723, nameRu: 'Манка', nameEn: 'Wheat flour, semolina', category: 'Зерновые и макароны', kcal: 360, protein: 12.7, fats: 1.1, carbs: 72.8, water: 12 },
        { fdcId: 169724, nameRu: 'Булгур', nameEn: 'Bulgur, dry', category: 'Зерновые и макароны', kcal: 342, protein: 12.3, fats: 1.3, carbs: 75.9, water: 9 },
        { fdcId: 169725, nameRu: 'Кускус', nameEn: 'Couscous, dry', category: 'Зерновые и макароны', kcal: 376, protein: 12.8, fats: 0.6, carbs: 77.4, water: 9 },
        { fdcId: 169726, nameRu: 'Макароны (паста)', nameEn: 'Pasta, dry, enriched', category: 'Зерновые и макароны', kcal: 371, protein: 13.0, fats: 1.5, carbs: 74.7, water: 10 },
        { fdcId: 169727, nameRu: 'Мука пшеничная в/с', nameEn: 'Wheat flour, white, all-purpose', category: 'Зерновые и макароны', kcal: 364, protein: 10.3, fats: 1.0, carbs: 76.3, water: 12 },
        { fdcId: 169728, nameRu: 'Хлеб белый', nameEn: 'Bread, white, commercial', category: 'Зерновые и макароны', kcal: 265, protein: 9.4, fats: 3.3, carbs: 49.2, water: 36 },
        { fdcId: 169729, nameRu: 'Хлеб чёрный (ржаной)', nameEn: 'Bread, rye', category: 'Зерновые и макароны', kcal: 259, protein: 8.5, fats: 3.3, carbs: 48.3, water: 38 },

        // ─── Бобовые ───
        { fdcId: 175197, nameRu: 'Чечевица', nameEn: 'Lentils, raw', category: 'Бобовые', kcal: 352, protein: 24.6, fats: 1.1, carbs: 63.4, water: 8 },
        { fdcId: 175198, nameRu: 'Нут', nameEn: 'Chickpeas (garbanzo beans), raw', category: 'Бобовые', kcal: 364, protein: 19.3, fats: 6.0, carbs: 60.7, water: 8 },
        { fdcId: 175199, nameRu: 'Фасоль красная', nameEn: 'Beans, kidney, red, raw', category: 'Бобовые', kcal: 333, protein: 23.6, fats: 0.8, carbs: 60.0, water: 12 },
        { fdcId: 175200, nameRu: 'Фасоль белая', nameEn: 'Beans, white, raw', category: 'Бобовые', kcal: 333, protein: 23.4, fats: 0.9, carbs: 60.3, water: 12 },
        { fdcId: 175201, nameRu: 'Горох зелёный', nameEn: 'Peas, green, raw', category: 'Бобовые', kcal: 81, protein: 5.4, fats: 0.4, carbs: 14.5, water: 79 },
        { fdcId: 175202, nameRu: 'Соевые бобы', nameEn: 'Soybeans, raw', category: 'Бобовые', kcal: 446, protein: 36.5, fats: 19.9, carbs: 30.2, water: 9 },
        { fdcId: 175203, nameRu: 'Тофу', nameEn: 'Tofu, firm, raw', category: 'Бобовые', kcal: 144, protein: 15.8, fats: 8.7, carbs: 2.8, water: 70 },

        // ─── Орехи и семена ───
        { fdcId: 170567, nameRu: 'Грецкий орех', nameEn: 'Nuts, walnuts, English', category: 'Орехи и семена', kcal: 654, protein: 15.2, fats: 65.2, carbs: 13.7, water: 4 },
        { fdcId: 170568, nameRu: 'Миндаль', nameEn: 'Nuts, almonds', category: 'Орехи и семена', kcal: 579, protein: 21.2, fats: 49.9, carbs: 21.7, water: 4 },
        { fdcId: 170569, nameRu: 'Фундук', nameEn: 'Nuts, hazelnuts or filberts', category: 'Орехи и семена', kcal: 628, protein: 15.0, fats: 60.8, carbs: 16.7, water: 5 },
        { fdcId: 170570, nameRu: 'Кешью', nameEn: 'Nuts, cashew nuts, raw', category: 'Орехи и семена', kcal: 553, protein: 18.2, fats: 43.8, carbs: 30.2, water: 5 },
        { fdcId: 170571, nameRu: 'Арахис', nameEn: 'Peanuts, raw', category: 'Орехи и семена', kcal: 567, protein: 25.8, fats: 49.2, carbs: 16.1, water: 7 },
        { fdcId: 170572, nameRu: 'Семена подсолнечника', nameEn: 'Seeds, sunflower seed kernels, dried', category: 'Орехи и семена', kcal: 584, protein: 20.8, fats: 51.5, carbs: 20.0, water: 5 },
        { fdcId: 170573, nameRu: 'Семена тыквы', nameEn: 'Seeds, pumpkin and squash, dried', category: 'Орехи и семена', kcal: 559, protein: 30.2, fats: 49.1, carbs: 10.7, water: 5 },
        { fdcId: 170574, nameRu: 'Семена льна', nameEn: 'Seeds, flaxseed', category: 'Орехи и семена', kcal: 534, protein: 18.3, fats: 42.2, carbs: 28.9, water: 7 },
        { fdcId: 170575, nameRu: 'Кунжут', nameEn: 'Seeds, sesame seeds, whole, dried', category: 'Орехи и семена', kcal: 573, protein: 17.7, fats: 49.7, carbs: 23.5, water: 5 },
        { fdcId: 170576, nameRu: 'Семена чиа', nameEn: 'Seeds, chia seeds, dried', category: 'Орехи и семена', kcal: 486, protein: 16.5, fats: 30.7, carbs: 42.1, water: 6 },

        // ─── Жиры и масла ───
        { fdcId: 171411, nameRu: 'Масло подсолнечное', nameEn: 'Oil, sunflower, linoleic', category: 'Жиры и масла', kcal: 884, protein: 0, fats: 100, carbs: 0, water: 0 },
        { fdcId: 171413, nameRu: 'Масло оливковое', nameEn: 'Oil, olive, salad or cooking', category: 'Жиры и масла', kcal: 884, protein: 0, fats: 100, carbs: 0, water: 0 },
        { fdcId: 171414, nameRu: 'Масло кокосовое', nameEn: 'Oil, coconut', category: 'Жиры и масла', kcal: 862, protein: 0, fats: 100, carbs: 0, water: 0 },
        { fdcId: 171415, nameRu: 'Масло льняное', nameEn: 'Oil, flaxseed, cold pressed', category: 'Жиры и масла', kcal: 884, protein: 0, fats: 100, carbs: 0, water: 0 },

        // ─── Специи и травы ───
        { fdcId: 171319, nameRu: 'Перец чёрный молотый', nameEn: 'Spices, pepper, black', category: 'Специи и травы', kcal: 251, protein: 10.4, fats: 3.3, carbs: 64.8, water: 13 },
        { fdcId: 171320, nameRu: 'Корица молотая', nameEn: 'Spices, cinnamon, ground', category: 'Специи и травы', kcal: 247, protein: 4.0, fats: 1.2, carbs: 80.6, water: 11 },
        { fdcId: 171321, nameRu: 'Куркума', nameEn: 'Spices, turmeric, ground', category: 'Специи и травы', kcal: 354, protein: 7.8, fats: 9.9, carbs: 64.9, water: 11 },
        { fdcId: 171322, nameRu: 'Паприка', nameEn: 'Spices, paprika', category: 'Специи и травы', kcal: 282, protein: 14.1, fats: 12.9, carbs: 53.9, water: 11 },
        { fdcId: 171323, nameRu: 'Имбирь молотый', nameEn: 'Spices, ginger, ground', category: 'Специи и травы', kcal: 335, protein: 9.0, fats: 4.2, carbs: 71.6, water: 10 },
        { fdcId: 171324, nameRu: 'Чеснок сушёный', nameEn: 'Spices, garlic powder', category: 'Специи и травы', kcal: 331, protein: 16.6, fats: 0.7, carbs: 72.7, water: 6 },
        { fdcId: 171325, nameRu: 'Укроп сушёный', nameEn: 'Spices, dill weed, dried', category: 'Специи и травы', kcal: 253, protein: 20.0, fats: 4.4, carbs: 55.8, water: 8 },
        { fdcId: 171326, nameRu: 'Базилик сушёный', nameEn: 'Spices, basil, dried', category: 'Специи и травы', kcal: 233, protein: 22.9, fats: 4.1, carbs: 47.8, water: 10 },
        { fdcId: 171327, nameRu: 'Орегано сушёный', nameEn: 'Spices, oregano, dried', category: 'Специи и травы', kcal: 265, protein: 9.0, fats: 4.3, carbs: 68.9, water: 10 },
        { fdcId: 171328, nameRu: 'Тимьян сушёный', nameEn: 'Spices, thyme, dried', category: 'Специи и травы', kcal: 276, protein: 9.1, fats: 7.4, carbs: 63.9, water: 8 },

        // ─── Сладости и десерты (НОВАЯ категория!) ───
        { fdcId: 167587, nameRu: 'Сахар белый', nameEn: 'Sugars, granulated', category: 'Сладости', kcal: 387, protein: 0, fats: 0, carbs: 99.8, water: 0 },
        { fdcId: 167588, nameRu: 'Мёд', nameEn: 'Honey', category: 'Сладости', kcal: 304, protein: 0.3, fats: 0, carbs: 82.4, water: 17 },
        { fdcId: 167590, nameRu: 'Шоколад тёмный (70%)', nameEn: 'Chocolate, dark, 70-85% cacao solids', category: 'Сладости', kcal: 598, protein: 7.8, fats: 42.6, carbs: 45.9, water: 1 },
        { fdcId: 167591, nameRu: 'Шоколад молочный', nameEn: 'Chocolate, milk', category: 'Сладости', kcal: 535, protein: 7.6, fats: 29.7, carbs: 59.4, water: 2 },
        { fdcId: 167592, nameRu: 'Какао-порошок', nameEn: 'Cocoa, dry powder, unsweetened', category: 'Сладости', kcal: 228, protein: 19.6, fats: 13.7, carbs: 57.9, water: 3 },
        { fdcId: 167593, nameRu: 'Варенье (джем)', nameEn: 'Jams and preserves', category: 'Сладости', kcal: 278, protein: 0.4, fats: 0.1, carbs: 68.9, water: 30 },
        { fdcId: 167594, nameRu: 'Сгущённое молоко', nameEn: 'Milk, canned, condensed, sweetened', category: 'Сладости', kcal: 321, protein: 7.9, fats: 8.7, carbs: 54.4, water: 27 },
        { fdcId: 167595, nameRu: 'Мороженое ванильное', nameEn: 'Ice cream, vanilla', category: 'Сладости', kcal: 207, protein: 3.5, fats: 11.0, carbs: 23.6, water: 61 },

        // ─── Напитки (НОВАЯ категория!) ───
        { fdcId: 171890, nameRu: 'Кофе чёрный', nameEn: 'Coffee, brewed, espresso', category: 'Напитки', kcal: 2, protein: 0.1, fats: 0.2, carbs: 0, water: 98 },
        { fdcId: 171891, nameRu: 'Чай чёрный без сахара', nameEn: 'Tea, brewed, black', category: 'Напитки', kcal: 1, protein: 0, fats: 0, carbs: 0.3, water: 100 },
        { fdcId: 171892, nameRu: 'Сок апельсиновый', nameEn: 'Orange juice, raw', category: 'Напитки', kcal: 45, protein: 0.7, fats: 0.2, carbs: 10.4, water: 88 },
        { fdcId: 171893, nameRu: 'Сок яблочный', nameEn: 'Apple juice, unsweetened', category: 'Напитки', kcal: 46, protein: 0.1, fats: 0.1, carbs: 11.3, water: 88 },
        { fdcId: 171894, nameRu: 'Кокосовое молоко', nameEn: 'Coconut milk, raw', category: 'Напитки', kcal: 230, protein: 2.3, fats: 23.8, carbs: 5.5, water: 68 },

        // ─── Выпечка ───
        { fdcId: 167545, nameRu: 'Блины', nameEn: 'Pancakes, plain, dry mix', category: 'Выпечка', kcal: 227, protein: 7.2, fats: 5.2, carbs: 38.2, water: 48 },
        { fdcId: 167546, nameRu: 'Круассан', nameEn: 'Croissant, butter', category: 'Выпечка', kcal: 406, protein: 8.2, fats: 21.0, carbs: 45.9, water: 23 },
        { fdcId: 167547, nameRu: 'Пончик', nameEn: 'Doughnut, yeast-leavened', category: 'Выпечка', kcal: 421, protein: 6.1, fats: 22.7, carbs: 49.5, water: 20 },
        { fdcId: 167548, nameRu: 'Пирог яблочный', nameEn: 'Pie, apple, commercial', category: 'Выпечка', kcal: 237, protein: 1.9, fats: 11.0, carbs: 34.0, water: 52 },
        { fdcId: 167549, nameRu: 'Бисквит', nameEn: 'Cake, sponge, commercial', category: 'Выпечка', kcal: 297, protein: 5.8, fats: 3.6, carbs: 62.1, water: 27 },
        { fdcId: 167550, nameRu: 'Печенье овсяное', nameEn: 'Cookie, oatmeal, commercial', category: 'Выпечка', kcal: 450, protein: 6.2, fats: 18.1, carbs: 67.5, water: 6 },
        { fdcId: 167551, nameRu: 'Вафли', nameEn: 'Waffle, plain, commercial', category: 'Выпечка', kcal: 291, protein: 7.9, fats: 9.6, carbs: 44.4, water: 36 },
      ];

      for (const ing of ingredients) {
        await sql`
          INSERT INTO ingredients (fdc_id, name_ru, name_en, category, kcal_per_100g, protein_g, fats_g, carbs_g, water_pct)
          VALUES (${ing.fdcId}, ${ing.nameRu}, ${ing.nameEn}, ${ing.category}, ${ing.kcal}, ${ing.protein}, ${ing.fats}, ${ing.carbs}, ${ing.water})
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
      }

      // ─── ЧАСТЬ 2: Сроки хранения (USDA FoodKeeper + FDA Food Code) ───
      // Добавляем недостающие записи для категорий:
      //   - Детское питание (fridge/pantry)
      //   - Напитки (fridge/pantry)
      //   - Выпечка/Десерты (fridge/pantry) — ранее были только в freezer
      //   - Яйца продукты (fridge)
      //   - Полуфабрикаты (fridge/freezer)
      //   - Консервы открытые (fridge)
      //   - Заморозка: дополнительные записи из FoodKeeper

      const shelfLifeEntries: {
        storageType: string; keyword: string; days: number; priority: number; description: string;
      }[] = [
        // ─── Выпечка и десерты (FRIDGE) — из USDA FoodKeeper ───
        { storageType: 'fridge', keyword: 'торт', days: 5, priority: 7, description: 'Торт с кремом, ~5 дней' },
        { storageType: 'fridge', keyword: 'чизкейк', days: 7, priority: 8, description: 'Чизкейк, ~7 дней' },
        { storageType: 'fridge', keyword: 'пирожн', days: 3, priority: 7, description: 'Пирожное с кремом, ~3 дня' },
        { storageType: 'fridge', keyword: 'эклер', days: 3, priority: 7, description: 'Эклеры, ~3 дня' },
        { storageType: 'fridge', keyword: 'тирамису', days: 3, priority: 8, description: 'Тирамису, ~3 дня' },
        { storageType: 'fridge', keyword: 'мусс', days: 3, priority: 6, description: 'Мусс десертный, ~3 дня' },
        { storageType: 'fridge', keyword: 'панна', days: 3, priority: 7, description: 'Панна-котта, ~3 дня' },
        { storageType: 'fridge', keyword: 'желе', days: 5, priority: 6, description: 'Желе, ~5 дней' },
        { storageType: 'fridge', keyword: 'пудинг', days: 4, priority: 6, description: 'Пудинг, ~4 дня' },
        { storageType: 'fridge', keyword: 'крем', days: 3, priority: 5, description: 'Крем кондитерский, ~3 дня' },
        { storageType: 'fridge', keyword: 'бисквит', days: 5, priority: 6, description: 'Бисквит без крема, ~5 дней' },
        { storageType: 'fridge', keyword: 'кекс', days: 7, priority: 6, description: 'Кекс, ~7 дней' },
        { storageType: 'fridge', keyword: 'маффин', days: 5, priority: 7, description: 'Маффины, ~5 дней' },
        { storageType: 'fridge', keyword: 'круассан', days: 5, priority: 7, description: 'Круассаны, ~5 дней' },
        { storageType: 'fridge', keyword: 'пирог', days: 5, priority: 6, description: 'Пирог, ~5 дней' },
        { storageType: 'fridge', keyword: 'пирожк', days: 3, priority: 7, description: 'Пирожки, ~3 дня' },
        { storageType: 'fridge', keyword: 'штрудел', days: 4, priority: 7, description: 'Штрудель, ~4 дня' },
        { storageType: 'fridge', keyword: 'сырник', days: 3, priority: 7, description: 'Сырники готовые, ~3 дня' },
        { storageType: 'fridge', keyword: 'запеканк', days: 4, priority: 6, description: 'Запеканка, ~4 дня' },
        { storageType: 'fridge', keyword: 'мороженое', days: 0, priority: 7, description: 'Мороженое — только морозилка!' },
        { storageType: 'fridge', keyword: 'десерт', days: 3, priority: 4, description: 'Десерт (общее), ~3 дня' },

        // ─── Выпечка (PANTRY) — из USDA FoodKeeper ───
        { storageType: 'pantry', keyword: 'торт', days: 3, priority: 6, description: 'Торт без крема, ~3 дня' },
        { storageType: 'pantry', keyword: 'кекс', days: 7, priority: 6, description: 'Кекс, ~7 дней' },
        { storageType: 'pantry', keyword: 'маффин', days: 5, priority: 6, description: 'Маффины, ~5 дней' },
        { storageType: 'pantry', keyword: 'круассан', days: 2, priority: 7, description: 'Круассаны, ~2 дня' },
        { storageType: 'pantry', keyword: 'пирог', days: 3, priority: 5, description: 'Пирог, ~3 дня' },
        { storageType: 'pantry', keyword: 'пирожк', days: 2, priority: 7, description: 'Пирожки, ~2 дня' },
        { storageType: 'pantry', keyword: 'вафл', days: 90, priority: 6, description: 'Вафли (заводские), ~3 месяца' },
        { storageType: 'pantry', keyword: 'зефир', days: 30, priority: 6, description: 'Зефир, ~1 месяц' },
        { storageType: 'pantry', keyword: 'пастил', days: 30, priority: 6, description: 'Пастила, ~1 месяц' },
        { storageType: 'pantry', keyword: 'мармелад', days: 90, priority: 6, description: 'Мармелад, ~3 месяца' },
        { storageType: 'pantry', keyword: 'халв', days: 60, priority: 6, description: 'Халва, ~2 месяца' },
        { storageType: 'pantry', keyword: 'козинак', days: 90, priority: 6, description: 'Козинаки, ~3 месяца' },
        { storageType: 'pantry', keyword: 'нуга', days: 90, priority: 6, description: 'Нуга, ~3 месяца' },
        { storageType: 'pantry', keyword: 'рахат', days: 90, priority: 6, description: 'Рахат-лукум, ~3 месяца' },
        { storageType: 'pantry', keyword: 'ирис', days: 60, priority: 6, description: 'Ириски, ~2 месяца' },
        { storageType: 'pantry', keyword: 'карамел', days: 180, priority: 6, description: 'Карамель, ~6 месяцев' },
        { storageType: 'pantry', keyword: 'леденц', days: 365, priority: 6, description: 'Леденцы, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'пряник', days: 30, priority: 6, description: 'Пряники, ~1 месяц' },
        { storageType: 'pantry', keyword: 'баранк', days: 60, priority: 6, description: 'Баранки/бублики, ~2 месяца' },
        { storageType: 'pantry', keyword: 'сушк', days: 90, priority: 6, description: 'Сушки, ~3 месяца' },

        // ─── Напитки (FRIDGE) — из USDA FoodKeeper / FDA ───
        { storageType: 'fridge', keyword: 'молоко растительн', days: 10, priority: 8, description: 'Растительное молоко открытое, ~10 дней' },
        { storageType: 'fridge', keyword: 'овсян молок', days: 7, priority: 8, description: 'Овсяное молоко открытое, ~7 дней' },
        { storageType: 'fridge', keyword: 'миндальн молок', days: 10, priority: 8, description: 'Миндальное молоко открытое, ~10 дней' },
        { storageType: 'fridge', keyword: 'кокосов молок', days: 5, priority: 8, description: 'Кокосовое молоко открытое, ~5 дней' },
        { storageType: 'fridge', keyword: 'смузи', days: 2, priority: 7, description: 'Смузи, ~2 дня' },
        { storageType: 'fridge', keyword: 'компот', days: 5, priority: 6, description: 'Компот домашний, ~5 дней' },
        { storageType: 'fridge', keyword: 'морс', days: 3, priority: 6, description: 'Морс, ~3 дня' },
        { storageType: 'fridge', keyword: 'квас', days: 5, priority: 6, description: 'Квас, ~5 дней' },
        { storageType: 'fridge', keyword: 'кисел', days: 3, priority: 6, description: 'Кисель, ~3 дня' },
        { storageType: 'fridge', keyword: 'лимонад', days: 5, priority: 6, description: 'Лимонад открытый, ~5 дней' },
        { storageType: 'fridge', keyword: 'пиво', days: 3, priority: 5, description: 'Пиво открытое, ~3 дня' },
        { storageType: 'fridge', keyword: 'вино', days: 5, priority: 5, description: 'Вино открытое, ~5 дней' },

        // ─── Напитки (PANTRY) — закрытые, из USDA FoodKeeper ───
        { storageType: 'pantry', keyword: 'молоко растительн', days: 180, priority: 7, description: 'Растительное молоко закрытое, ~6 мес' },
        { storageType: 'pantry', keyword: 'газировк', days: 270, priority: 5, description: 'Газировка, ~9 месяцев' },
        { storageType: 'pantry', keyword: 'пиво', days: 180, priority: 5, description: 'Пиво закрытое, ~6 месяцев' },
        { storageType: 'pantry', keyword: 'вино', days: 730, priority: 5, description: 'Вино закрытое, ~2 года' },
        { storageType: 'pantry', keyword: 'компот', days: 365, priority: 7, description: 'Компот закатанный, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'сок', days: 365, priority: 6, description: 'Сок в упаковке, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'энергетик', days: 365, priority: 5, description: 'Энергетик, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'кокосов молок', days: 365, priority: 7, description: 'Кокосовое молоко в банке, ~12 месяцев' },

        // ─── Полуфабрикаты (FRIDGE) — из FoodKeeper ───
        { storageType: 'fridge', keyword: 'пельмен', days: 2, priority: 7, description: 'Пельмени (охл.), ~2 дня → лучше заморозить' },
        { storageType: 'fridge', keyword: 'вареник', days: 2, priority: 7, description: 'Вареники (охл.), ~2 дня → лучше заморозить' },
        { storageType: 'fridge', keyword: 'котлет сыр', days: 2, priority: 8, description: 'Котлеты сырые, ~2 дня' },
        { storageType: 'fridge', keyword: 'манты', days: 2, priority: 7, description: 'Манты (охл.), ~2 дня → лучше заморозить' },
        { storageType: 'fridge', keyword: 'хинкал', days: 2, priority: 7, description: 'Хинкали (охл.), ~2 дня' },
        { storageType: 'fridge', keyword: 'шаурм', days: 2, priority: 7, description: 'Шаурма, ~2 дня' },
        { storageType: 'fridge', keyword: 'роллы', days: 1, priority: 7, description: 'Роллы/суши, ~1 день' },
        { storageType: 'fridge', keyword: 'суши', days: 1, priority: 7, description: 'Суши, ~1 день' },
        { storageType: 'fridge', keyword: 'пицц', days: 4, priority: 6, description: 'Пицца (готовая), ~4 дня' },

        // ─── Консервы открытые (FRIDGE) — из FDA Food Code ───
        { storageType: 'fridge', keyword: 'консерв открыт', days: 5, priority: 8, description: 'Консервы открытые, ~5 дней' },
        { storageType: 'fridge', keyword: 'тушёнк', days: 5, priority: 7, description: 'Тушёнка открытая, ~5 дней' },
        { storageType: 'fridge', keyword: 'тушенк', days: 5, priority: 7, description: 'Тушёнка открытая, ~5 дней' },
        { storageType: 'fridge', keyword: 'шпроты', days: 3, priority: 7, description: 'Шпроты открытые, ~3 дня' },
        { storageType: 'fridge', keyword: 'паштет', days: 5, priority: 7, description: 'Паштет открытый, ~5 дней' },

        // ─── Детское питание (FRIDGE) — из FoodKeeper ───
        { storageType: 'fridge', keyword: 'детск пюре', days: 2, priority: 8, description: 'Детское пюре открытое, ~2 дня' },
        { storageType: 'fridge', keyword: 'детск питан', days: 2, priority: 8, description: 'Детское питание открытое, ~2 дня' },
        { storageType: 'fridge', keyword: 'детск смес', days: 1, priority: 9, description: 'Детская смесь разведённая, ~1 день' },

        // ─── Детское питание (PANTRY) — закрытое ───
        { storageType: 'pantry', keyword: 'детск пюре', days: 365, priority: 7, description: 'Детское пюре закрытое, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'детск питан', days: 365, priority: 7, description: 'Детское питание закрытое, ~12 месяцев' },
        { storageType: 'pantry', keyword: 'детск смес', days: 365, priority: 8, description: 'Детская смесь закрытая, ~12 месяцев' },

        // ─── Яйца-продукты (FRIDGE) — из FoodKeeper ───
        { storageType: 'fridge', keyword: 'яйцо варён', days: 7, priority: 8, description: 'Яйцо варёное, ~7 дней' },
        { storageType: 'fridge', keyword: 'яйца варён', days: 7, priority: 8, description: 'Яйца варёные, ~7 дней' },
        { storageType: 'fridge', keyword: 'омлет', days: 3, priority: 7, description: 'Омлет готовый, ~3 дня' },
        { storageType: 'fridge', keyword: 'яичниц', days: 2, priority: 7, description: 'Яичница, ~2 дня' },

        // ─── Заморозка: доп. записи из FoodKeeper (freezer) ───
        { storageType: 'freezer', keyword: 'шаурм', days: 60, priority: 6, description: 'Шаурма замороженная, ~2 мес' },
        { storageType: 'freezer', keyword: 'пицц', days: 60, priority: 6, description: 'Пицца замороженная, ~2 мес' },
        { storageType: 'freezer', keyword: 'роллы', days: 30, priority: 6, description: 'Роллы замороженные, ~1 мес' },
        { storageType: 'freezer', keyword: 'суши', days: 30, priority: 6, description: 'Суши замороженные, ~1 мес' },
        { storageType: 'freezer', keyword: 'смузи', days: 90, priority: 6, description: 'Смузи замороженный, ~3 мес' },
        { storageType: 'freezer', keyword: 'пудинг', days: 60, priority: 6, description: 'Пудинг замороженный, ~2 мес' },
        { storageType: 'freezer', keyword: 'запеканк', days: 90, priority: 6, description: 'Запеканка замороженная, ~3 мес' },
        { storageType: 'freezer', keyword: 'омлет', days: 60, priority: 6, description: 'Омлет замороженный, ~2 мес' },
        { storageType: 'freezer', keyword: 'паштет', days: 30, priority: 6, description: 'Паштет замороженный, ~1 мес' },
        { storageType: 'freezer', keyword: 'кабачков', days: 240, priority: 6, description: 'Кабачковая икра, ~8 мес' },
        { storageType: 'freezer', keyword: 'икра кабачк', days: 240, priority: 7, description: 'Кабачковая икра, ~8 мес' },
        { storageType: 'freezer', keyword: 'яблок', days: 240, priority: 6, description: 'Яблоки замороженные, ~8 мес' },
        { storageType: 'freezer', keyword: 'банан', days: 90, priority: 6, description: 'Бананы замороженные, ~3 мес' },
        { storageType: 'freezer', keyword: 'манго', days: 270, priority: 6, description: 'Манго замороженное, ~9 мес' },
        { storageType: 'freezer', keyword: 'ананас', days: 270, priority: 6, description: 'Ананас замороженный, ~9 мес' },
      ];

      for (const e of shelfLifeEntries) {
        await sql`
          INSERT INTO shelf_life (storage_type, keyword, days, priority, description)
          VALUES (${e.storageType}, ${e.keyword}, ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT (storage_type, keyword) DO UPDATE SET
            days = EXCLUDED.days,
            priority = EXCLUDED.priority,
            description = EXCLUDED.description
        `;
      }

      // Также добавляем в freezer_shelf_life (для обратной совместимости
      // со старым кодом preserves.suggestExpiry)
      const freezerOnlyEntries = shelfLifeEntries.filter(e => e.storageType === 'freezer');
      for (const e of freezerOnlyEntries) {
        await sql`
          INSERT INTO freezer_shelf_life (keyword, days, priority, description)
          VALUES (${e.keyword}, ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT (keyword) DO UPDATE SET
            days = EXCLUDED.days,
            priority = EXCLUDED.priority,
            description = EXCLUDED.description
        `;
      }
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
