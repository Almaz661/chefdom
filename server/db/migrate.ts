import { client } from './index';
import { seedSubstitutions } from './seed-substitutions';
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
