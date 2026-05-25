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
  {
    version: '021_inventory_shelf_life',
    up: async (sql) => {
      // Справочник сроков хранения для обычного инвентаря (холодильник/кладовая).
      // При добавлении продукта в инвентарь система автоматически подставляет
      // рекомендованную дату «годен до» по ключевому слову в названии.
      // storage_type: 'fridge' | 'pantry' — морозилка покрывается freezer_shelf_life.
      await sql`
        CREATE TABLE IF NOT EXISTS inventory_shelf_life (
          id SERIAL PRIMARY KEY,
          keyword TEXT NOT NULL,
          storage_type TEXT NOT NULL DEFAULT 'fridge',
          days INTEGER NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          description TEXT,
          UNIQUE(keyword, storage_type)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_inventory_shelf_life_keyword
        ON inventory_shelf_life(LOWER(keyword), storage_type)
      `;

      // Сроки хранения в холодильнике (fridge). Источник: FDA FoodKeeper App,
      // USDA FoodSafety.gov, адаптировано для домашних условий.
      // Значения консервативные — лучше выбросить раньше, чем отравиться.
      const fridgeEntries: { keyword: string; days: number; priority: number; description: string }[] = [
        // --- Молоко и молочные ---
        { keyword: 'молоко', days: 7, priority: 8, description: 'Молоко открытое, ~7 дней' },
        { keyword: 'кефир', days: 7, priority: 8, description: 'Кефир, ~7 дней' },
        { keyword: 'йогурт', days: 7, priority: 8, description: 'Йогурт, ~7 дней' },
        { keyword: 'ряженка', days: 7, priority: 8, description: 'Ряженка, ~7 дней' },
        { keyword: 'простокваш', days: 5, priority: 8, description: 'Простокваша, ~5 дней' },
        { keyword: 'сметан', days: 14, priority: 8, description: 'Сметана, ~2 нед' },
        { keyword: 'творог', days: 5, priority: 8, description: 'Творог, ~5 дней' },
        { keyword: 'сыр', days: 21, priority: 6, description: 'Сыр твёрдый, ~3 нед' },
        { keyword: 'брынза', days: 14, priority: 8, description: 'Брынза, ~2 нед' },
        { keyword: 'фета', days: 14, priority: 8, description: 'Фета, ~2 нед' },
        { keyword: 'моцарелл', days: 5, priority: 8, description: 'Моцарелла, ~5 дней' },
        { keyword: 'масло сливочн', days: 30, priority: 9, description: 'Масло сливочное, ~1 мес' },
        { keyword: 'масло', days: 30, priority: 5, description: 'Масло, ~1 мес' },
        { keyword: 'сливки', days: 7, priority: 8, description: 'Сливки, ~7 дней' },
        { keyword: 'пудинг', days: 5, priority: 7, description: 'Пудинг, ~5 дней' },
        // --- Яйца ---
        { keyword: 'яйц', days: 35, priority: 8, description: 'Яйца, ~5 нед' },
        { keyword: 'яйко', days: 35, priority: 8, description: 'Яйко, ~5 нед' },
        // --- Мясо сырое ---
        { keyword: 'говядин', days: 3, priority: 7, description: 'Говядина сырая, ~3 дня' },
        { keyword: 'свинин', days: 3, priority: 7, description: 'Свинина сырая, ~3 дня' },
        { keyword: 'баранин', days: 3, priority: 7, description: 'Баранина сырая, ~3 дня' },
        { keyword: 'фарш', days: 2, priority: 8, description: 'Фарш сырой, ~2 дня' },
        { keyword: 'котлет', days: 2, priority: 8, description: 'Котлеты сырые, ~2 дня' },
        { keyword: 'стейк', days: 3, priority: 8, description: 'Стейк сырой, ~3 дня' },
        { keyword: 'отбивн', days: 2, priority: 8, description: 'Отбивные сырые, ~2 дня' },
        // --- Птица сырая ---
        { keyword: 'куриц', days: 2, priority: 7, description: 'Курица сырая, ~2 дня' },
        { keyword: 'курин', days: 2, priority: 7, description: 'Курятина сырая, ~2 дня' },
        { keyword: 'индейк', days: 2, priority: 7, description: 'Индейка сырая, ~2 дня' },
        { keyword: 'утк', days: 2, priority: 7, description: 'Утка сырая, ~2 дня' },
        { keyword: 'крыл', days: 2, priority: 7, description: 'Крылья сырые, ~2 дня' },
        { keyword: 'голен', days: 2, priority: 7, description: 'Голени сырые, ~2 дня' },
        { keyword: 'окорочк', days: 2, priority: 7, description: 'Окорочка сырые, ~2 дня' },
        // --- Рыба сырая ---
        { keyword: 'рыб', days: 2, priority: 5, description: 'Рыба сырая, ~2 дня' },
        { keyword: 'лосос', days: 2, priority: 7, description: 'Лосось сырой, ~2 дня' },
        { keyword: 'сёмг', days: 2, priority: 7, description: 'Сёмга сырая, ~2 дня' },
        { keyword: 'семг', days: 2, priority: 7, description: 'Сёмга сырая, ~2 дня' },
        { keyword: 'треск', days: 2, priority: 7, description: 'Треска сырая, ~2 дня' },
        { keyword: 'минтай', days: 2, priority: 7, description: 'Минтай сырой, ~2 дня' },
        { keyword: 'форел', days: 2, priority: 7, description: 'Форель сырая, ~2 дня' },
        { keyword: 'скумбри', days: 2, priority: 7, description: 'Скумбрия сырая, ~2 дня' },
        { keyword: 'сельд', days: 5, priority: 7, description: 'Сельдь, ~5 дней' },
        { keyword: 'креветк', days: 2, priority: 7, description: 'Креветки сырые, ~2 дня' },
        // --- Колбасные ---
        { keyword: 'сосиск', days: 7, priority: 8, description: 'Сосиски, ~7 дней' },
        { keyword: 'сардельк', days: 7, priority: 8, description: 'Сардельки, ~7 дней' },
        { keyword: 'колбас', days: 7, priority: 7, description: 'Колбаса, ~7 дней' },
        { keyword: 'бекон', days: 7, priority: 8, description: 'Бекон, ~7 дней' },
        { keyword: 'ветчин', days: 7, priority: 8, description: 'Ветчина, ~7 дней' },
        { keyword: 'паштет', days: 5, priority: 8, description: 'Паштет, ~5 дней' },
        // --- Готовые блюда ---
        { keyword: 'суп', days: 4, priority: 6, description: 'Суп готовый, ~4 дня' },
        { keyword: 'борщ', days: 4, priority: 7, description: 'Борщ, ~4 дня' },
        { keyword: 'щи', days: 4, priority: 7, description: 'Щи, ~4 дня' },
        { keyword: 'бульон', days: 4, priority: 6, description: 'Бульон, ~4 дня' },
        { keyword: 'плов', days: 3, priority: 6, description: 'Плов, ~3 дня' },
        { keyword: 'котлет', days: 3, priority: 5, description: 'Котлеты готовые, ~3 дня' },
        { keyword: 'рагу', days: 3, priority: 6, description: 'Рагу, ~3 дня' },
        { keyword: 'запеканк', days: 3, priority: 6, description: 'Запеканка, ~3 дня' },
        // --- Овощи и зелень ---
        { keyword: 'зелен', days: 5, priority: 4, description: 'Зелень, ~5 дней' },
        { keyword: 'укроп', days: 7, priority: 7, description: 'Укроп, ~7 дней' },
        { keyword: 'петрушк', days: 7, priority: 7, description: 'Петрушка, ~7 дней' },
        { keyword: 'салат', days: 5, priority: 6, description: 'Салат-латук, ~5 дней' },
        { keyword: 'шпинат', days: 5, priority: 7, description: 'Шпинат, ~5 дней' },
        { keyword: 'помидор', days: 7, priority: 7, description: 'Помидоры, ~7 дней' },
        { keyword: 'томат', days: 7, priority: 6, description: 'Томаты, ~7 дней' },
        { keyword: 'огурц', days: 7, priority: 7, description: 'Огурцы, ~7 дней' },
        { keyword: 'перец', days: 10, priority: 6, description: 'Перец, ~10 дней' },
        { keyword: 'кабачк', days: 10, priority: 7, description: 'Кабачки, ~10 дней' },
        { keyword: 'баклажан', days: 10, priority: 7, description: 'Баклажаны, ~10 дней' },
        { keyword: 'брокколи', days: 5, priority: 7, description: 'Брокколи, ~5 дней' },
        { keyword: 'капуст', days: 14, priority: 6, description: 'Капуста, ~2 нед' },
        { keyword: 'морков', days: 21, priority: 7, description: 'Морковь, ~3 нед' },
        { keyword: 'свёкл', days: 21, priority: 7, description: 'Свёкла, ~3 нед' },
        { keyword: 'свекл', days: 21, priority: 7, description: 'Свёкла, ~3 нед' },
        { keyword: 'грибы', days: 5, priority: 7, description: 'Грибы свежие, ~5 дней' },
        // --- Фрукты ---
        { keyword: 'клубник', days: 5, priority: 7, description: 'Клубника, ~5 дней' },
        { keyword: 'малин', days: 3, priority: 7, description: 'Малина, ~3 дня' },
        { keyword: 'виноград', days: 10, priority: 7, description: 'Виноград, ~10 дней' },
        { keyword: 'яблок', days: 30, priority: 7, description: 'Яблоки, ~1 мес' },
        { keyword: 'груш', days: 10, priority: 7, description: 'Груши, ~10 дней' },
        // --- Соусы и заправки ---
        { keyword: 'майонез', days: 60, priority: 8, description: 'Майонез открытый, ~2 мес' },
        { keyword: 'кетчуп', days: 30, priority: 8, description: 'Кетчуп открытый, ~1 мес' },
        { keyword: 'горчиц', days: 60, priority: 8, description: 'Горчица, ~2 мес' },
        { keyword: 'соус', days: 14, priority: 5, description: 'Соус открытый, ~2 нед' },
        // --- Напитки ---
        { keyword: 'сок', days: 7, priority: 6, description: 'Сок открытый, ~7 дней' },
        { keyword: 'кофе', days: 14, priority: 5, description: 'Кофе открытый, ~2 нед' },
      ];

      for (const e of fridgeEntries) {
        await sql`
          INSERT INTO inventory_shelf_life (keyword, storage_type, days, priority, description)
          VALUES (${e.keyword}, 'fridge', ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT (keyword, storage_type) DO UPDATE SET
            days = EXCLUDED.days,
            priority = EXCLUDED.priority,
            description = EXCLUDED.description
        `;
      }

      // Сроки хранения в кладовой (pantry). Источник: FDA FoodKeeper App.
      const pantryEntries: { keyword: string; days: number; priority: number; description: string }[] = [
        // --- Крупы и зерновые ---
        { keyword: 'рис', days: 730, priority: 7, description: 'Рис, ~2 года' },
        { keyword: 'гречк', days: 365, priority: 7, description: 'Гречка, ~1 год' },
        { keyword: 'овсянк', days: 365, priority: 7, description: 'Овсянка, ~1 год' },
        { keyword: 'пшен', days: 365, priority: 6, description: 'Пшено, ~1 год' },
        { keyword: 'манк', days: 365, priority: 7, description: 'Манка, ~1 год' },
        { keyword: 'перловк', days: 365, priority: 7, description: 'Перловка, ~1 год' },
        { keyword: 'булгур', days: 365, priority: 7, description: 'Булгур, ~1 год' },
        { keyword: 'кускус', days: 365, priority: 7, description: 'Кускус, ~1 год' },
        { keyword: 'кинва', days: 365, priority: 7, description: 'Киноа, ~1 год' },
        { keyword: 'чечевиц', days: 730, priority: 7, description: 'Чечевица, ~2 года' },
        { keyword: 'фасол', days: 730, priority: 6, description: 'Фасоль, ~2 года' },
        { keyword: 'горох', days: 730, priority: 7, description: 'Горох, ~2 года' },
        { keyword: 'нут', days: 730, priority: 7, description: 'Нут, ~2 года' },
        // --- Мука и выпечка ---
        { keyword: 'мук', days: 365, priority: 7, description: 'Мука, ~1 год' },
        { keyword: 'сахар', days: 730, priority: 7, description: 'Сахар, ~2 года' },
        { keyword: 'соль', days: 1825, priority: 7, description: 'Соль, ~5 лет' },
        { keyword: 'дрожж', days: 90, priority: 7, description: 'Дрожжи сухие, ~3 мес' },
        { keyword: 'разрыхлител', days: 365, priority: 7, description: 'Разрыхлитель, ~1 год' },
        { keyword: 'сода', days: 730, priority: 7, description: 'Сода, ~2 года' },
        { keyword: 'крахмал', days: 730, priority: 7, description: 'Крахмал, ~2 года' },
        // --- Масла ---
        { keyword: 'масло подсолнечн', days: 365, priority: 9, description: 'Масло подсолнечное закрытое, ~1 год' },
        { keyword: 'масло оливков', days: 730, priority: 9, description: 'Масло оливковое, ~2 года' },
        { keyword: 'масло растительн', days: 365, priority: 8, description: 'Масло растительное, ~1 год' },
        // --- Макаронные ---
        { keyword: 'макарон', days: 730, priority: 7, description: 'Макароны, ~2 года' },
        { keyword: 'спагетт', days: 730, priority: 7, description: 'Спагетти, ~2 года' },
        { keyword: 'лапш', days: 730, priority: 7, description: 'Лапша, ~2 года' },
        { keyword: 'паст', days: 730, priority: 6, description: 'Паста, ~2 года' },
        // --- Консервы ---
        { keyword: 'консерв', days: 1095, priority: 6, description: 'Консервы, ~3 года' },
        { keyword: 'тушёнк', days: 1095, priority: 7, description: 'Тушёнка, ~3 года' },
        { keyword: 'сгущёнк', days: 365, priority: 7, description: 'Сгущёнка, ~1 год' },
        { keyword: 'варень', days: 365, priority: 7, description: 'Варенье, ~1 год' },
        { keyword: 'джем', days: 365, priority: 7, description: 'Джем, ~1 год' },
        // --- Приправы и специи ---
        { keyword: 'перец черн', days: 1095, priority: 8, description: 'Перец чёрный, ~3 года' },
        { keyword: 'специи', days: 730, priority: 5, description: 'Специи молотые, ~2 года' },
        { keyword: 'приправ', days: 730, priority: 5, description: 'Приправа, ~2 года' },
        { keyword: 'лавровый', days: 1095, priority: 7, description: 'Лавровый лист, ~3 года' },
        // --- Хлеб и выпечка ---
        { keyword: 'хлеб', days: 5, priority: 7, description: 'Хлеб, ~5 дней' },
        { keyword: 'батон', days: 3, priority: 7, description: 'Батон, ~3 дня' },
        { keyword: 'булочк', days: 3, priority: 7, description: 'Булочки, ~3 дня' },
        // --- Овощи (в кладовой) ---
        { keyword: 'картофел', days: 60, priority: 7, description: 'Картофель, ~2 мес' },
        { keyword: 'картошк', days: 60, priority: 7, description: 'Картошка, ~2 мес' },
        { keyword: 'лук', days: 30, priority: 7, description: 'Лук, ~1 мес' },
        { keyword: 'чеснок', days: 60, priority: 7, description: 'Чеснок, ~2 мес' },
        { keyword: 'тыкв', days: 90, priority: 7, description: 'Тыква целая, ~3 мес' },
        // --- Орехи и сухофрукты ---
        { keyword: 'орех', days: 180, priority: 5, description: 'Орехи, ~6 мес' },
        { keyword: 'изюм', days: 180, priority: 7, description: 'Изюм, ~6 мес' },
        { keyword: 'курага', days: 180, priority: 7, description: 'Курага, ~6 мес' },
        { keyword: 'чернослив', days: 180, priority: 7, description: 'Чернослив, ~6 мес' },
        // --- Напитки ---
        { keyword: 'чай', days: 730, priority: 7, description: 'Чай, ~2 года' },
        { keyword: 'кофе', days: 365, priority: 6, description: 'Кофе (закрытый), ~1 год' },
      ];

      for (const e of pantryEntries) {
        await sql`
          INSERT INTO inventory_shelf_life (keyword, storage_type, days, priority, description)
          VALUES (${e.keyword}, 'pantry', ${e.days}, ${e.priority}, ${e.description})
          ON CONFLICT (keyword, storage_type) DO UPDATE SET
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
