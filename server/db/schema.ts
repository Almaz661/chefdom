import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
} from 'drizzle-orm/pg-core';

// Таблица версий миграций — управляется server/db/migrate.ts
export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
});

// Этап 0 — пользователи (на старте один: «Семья» c PIN 1234)
// pinHash — bcrypt-хеш PIN (миграция 018). До этого PIN хранился plain
// text в `pin` колонке — теперь оставлена для backwards compat, но
// весь код читает/пишет ТОЛЬКО pinHash.
// defaultCurrency — выбор валюты в Настройках (миграция 015).
// Используется как валюта по умолчанию при создании чека вручную и
// как fallback в парсере OCR, если магазин не распознан.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  pin: text('pin').notNull(),
  pinHash: text('pin_hash').notNull(),
  name: text('name').notNull(),
  defaultCurrency: text('default_currency').notNull().default('EUR'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Сессии — аутентификация по Bearer-токену.
// Создаются при auth.login (после проверки PIN), хранятся 30 дней.
// Используются всеми protectedProcedure для авторизации запросов.
//
// token — криптостойкая случайная строка (64 hex char = 32 байта энтропии),
// первичный ключ. Не угадывается перебором.
//
// ON DELETE CASCADE: при удалении пользователя сессии тоже удаляются.
// (миграция 016)
export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Попытки входа — счётчик неверных PIN, переживает рестарт сервера
// (миграция 017). До этого Map в памяти, на Render Free сервер засыпает
// каждые 15 мин и счётчик сбрасывался.
//
// key — IP клиента (или 'unknown'). count — подряд неверных попыток.
// blocked_until — до этого момента вход с этого IP заблокирован.
export const authAttempts = pgTable('auth_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Этап 0 — рецепты (Блок 4)
// Поля времени в минутах. calories — на порцию.
// difficulty: «легко» / «средне» / «сложно».
export const recipes = pgTable('recipes', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  servings: integer('servings').notNull().default(4),
  prepTime: integer('prep_time'),
  cookTime: integer('cook_time'),
  totalTime: integer('total_time'),
  sourceUrl: text('source_url'),
  source: text('source'),
  category: text('category'),
  cuisine: text('cuisine'),
  difficulty: text('difficulty'),
  calories: integer('calories'),
  proteinG: numeric('protein_g'),
  fatsG: numeric('fats_g'),
  carbsG: numeric('carbs_g'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ингредиенты рецепта. amount как numeric — точная дробь («1,5 ч. л.» = 1.5).
// groupName — опциональная группировка («Для теста», «Для соуса»).
export const recipeIngredients = pgTable('recipe_ingredients', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: numeric('amount'),
  unit: text('unit'),
  groupName: text('group_name'),
  sortOrder: integer('sort_order').notNull().default(0),
});

// Шаги рецепта. timerMinutes — для кнопки таймера на странице (этап F.2).
export const recipeSteps = pgTable('recipe_steps', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  instruction: text('instruction').notNull(),
  imageUrl: text('image_url'),
  timerMinutes: integer('timer_minutes'),
});

// Меню недели. weekStartDate — понедельник этой недели (YYYY-MM-DD).
export const menus = pgTable('menus', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  weekStartDate: text('week_start_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Слот в меню: день × приём пищи → рецепт.
// dayOfWeek: 0=Пн, 1=Вт ... 6=Вс
// mealType: 'breakfast' | 'lunch' | 'dinner'
export const menuItems = pgTable('menu_items', {
  id: serial('id').primaryKey(),
  menuId: integer('menu_id')
    .notNull()
    .references(() => menus.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  mealType: text('meal_type').notNull(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
});

// Инвентарь (что есть дома).
// storageType: 'fridge' | 'freezer' | 'pantry'
// expiryDate: YYYY-MM-DD или null если не скоропортящееся.
// addedAt — когда продукт добавлен (для алерта B.2 «давно лежит»).
// Поле добавлено миграцией 014.
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  productName: text('product_name').notNull(),
  quantity: numeric('quantity'),
  unit: text('unit'),
  storageType: text('storage_type').notNull().default('fridge'),
  expiryDate: text('expiry_date'),
  minQuantity: numeric('min_quantity'),
  category: text('category'),
  isBasic: integer('is_basic').notNull().default(0),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Список покупок.
// isChecked: 0 = не куплено, 1 = куплено.
// recipeSource: название рецепта откуда добавлено (null если вручную).
// neededQuantity / inStockQuantity — для будущей интеграции с инвентарём.
export const purchaseItems = pgTable('purchase_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  productName: text('product_name').notNull(),
  quantity: numeric('quantity'),
  unit: text('unit'),
  category: text('category'),
  isChecked: integer('is_checked').notNull().default(0),
  recipeSource: text('recipe_source'),
  neededQuantity: numeric('needed_quantity'),
  inStockQuantity: numeric('in_stock_quantity'),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
});

// Этап G — рецепты теперь хранят КБЖУ на порцию
// (поля добавлены миграцией 006, здесь отражаем в схеме Drizzle)
// calories уже был, добавляем protein_g / fats_g / carbs_g через ALTER TABLE

// Этап G — справочник ингредиентов (USDA FoodData Central)
export const ingredients = pgTable('ingredients', {
  id: serial('id').primaryKey(),
  fdcId: integer('fdc_id').unique(),
  nameRu: text('name_ru').notNull(),
  nameEn: text('name_en'),
  category: text('category'),
  defaultUnit: text('default_unit'),
  kcalPer100g: numeric('kcal_per_100g'),
  proteinG: numeric('protein_g'),
  fatsG: numeric('fats_g'),
  carbsG: numeric('carbs_g'),
  waterPct: numeric('water_pct'),
});

// Этап G — каталог товаров (Open Food Facts)
// lastPrice, avgPrice, priceUpdatedAt — Product Master для точной привязки
// цен в ALDI чеках с двухблочным форматом (миграция 010).
// storeName, purchaseDate — магазин и дата последней покупки (миграция 024).
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  ingredientId: integer('ingredient_id')
    .references(() => ingredients.id),
  barcode: text('barcode').unique(),
  nameRu: text('name_ru').notNull().unique(),
  nameNl: text('name_nl'),
  brand: text('brand'),
  packageQuantity: numeric('package_quantity'),
  packageUnit: text('package_unit'),
  imageUrl: text('image_url'),
  offId: text('off_id').unique(),
  lastPrice: numeric('last_price'),
  avgPrice: numeric('avg_price'),
  priceUpdatedAt: timestamp('price_updated_at', { withTimezone: true }),
  storeName: text('store_name'),
  purchaseDate: text('purchase_date'),
});

// Этап G — замены ингредиентов
export const ingredientSubstitutions = pgTable('ingredient_substitutions', {
  id: serial('id').primaryKey(),
  ingredientName: text('ingredient_name').notNull(),
  alternativeName: text('alternative_name').notNull(),
  quality: text('quality'),
  quantityRatio: numeric('quantity_ratio'),
});

// Этап H — история готовки.
// Логируется каждое нажатие «Готовить» на странице рецепта.
// recipeId nullable + ON DELETE SET NULL — чтобы при удалении рецепта
// история не терялась (для аналитики важно сохранить факты готовки).
// recipeTitle хранится снапшотом, чтобы показывать в истории даже
// после удаления исходного рецепта.
// servings — фактическое количество порций (с учётом множителя).
// consumedCount / totalIngredients — снапшот, сколько списано из инвентаря.
export const cookingHistory = pgTable('cooking_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  recipeId: integer('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  recipeTitle: text('recipe_title').notNull(),
  servings: integer('servings').notNull().default(1),
  caloriesPerServing: integer('calories_per_serving'),
  category: text('category'),
  cuisine: text('cuisine'),
  consumedCount: integer('consumed_count').notNull().default(0),
  totalIngredients: integer('total_ingredients').notNull().default(0),
  notes: text('notes'),
  rating: integer('rating'),
  cookedAt: timestamp('cooked_at', { withTimezone: true }).defaultNow().notNull(),
});

// G.19 — чеки. Создаются вручную (OCR — отдельный этап, требует API ключ).
// purchaseDate: YYYY-MM-DD. currency: 'EUR' | 'RUB'.
// status: 'draft' (заполняется) | 'final' (закрыт).
// ocrRaw — сырой текст из OCR.space (для повторного парсинга без
// дополнительных запросов в OCR, см. миграцию 009).
export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  storeName: text('store_name'),
  purchaseDate: text('purchase_date'),
  totalAmount: numeric('total_amount'),
  currency: text('currency').notNull().default('EUR'),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  ocrRaw: text('ocr_raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Позиции чека. barcode + matchedProductId связывают строку с каталогом
// products (этап G.2). productName — снапшот, чтобы запись осталась
// читаемой если товар удалят из каталога.
export const receiptItems = pgTable('receipt_items', {
  id: serial('id').primaryKey(),
  receiptId: integer('receipt_id')
    .notNull()
    .references(() => receipts.id, { onDelete: 'cascade' }),
  productName: text('product_name').notNull(),
  quantity: numeric('quantity'),
  unit: text('unit'),
  price: numeric('price'),
  barcode: text('barcode'),
  matchedProductId: integer('matched_product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  sortOrder: integer('sort_order').notNull().default(0),
});


// Этап D — заготовки. Единая таблица под три типа: заморозка ('frozen'),
// консервация ('preserved'), открытые продукты ('opened'). См. миграцию 019.
//
// Поля по типу (null для других — нормально):
//   frozen: name, quantity, unit, servings, preparedAt (когда заморозили),
//     expiryDate (до какого числа хранить).
//   preserved: name, quantity, unit, preparedAt (когда заготовили),
//     expiryDate (годен до).
//   opened: name, quantity, unit, preparedAt (когда открыли),
//     expiryDate (годен после открытия до).
export const preserves = pgTable('preserves', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  preserveType: text('preserve_type').notNull(), // 'frozen' | 'preserved' | 'opened' | 'cooked'
  name: text('name').notNull(),
  quantity: numeric('quantity'),
  unit: text('unit'),
  servings: integer('servings'),
  preparedAt: text('prepared_at'), // YYYY-MM-DD
  expiryDate: text('expiry_date'), // YYYY-MM-DD
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});


// Этап D — справочник сроков заморозки. У шефов на холодильниках весит
// табличка «что сколько хранить» — это её цифровая копия (миграция 020).
// При добавлении заготовки типа frozen роутер preserves.suggestExpiry
// ищет ключ среди entries и возвращает рекомендованную дату «годен до».
//
// keyword — подстрока для LIKE-поиска (нижний регистр). Для одного
// названия может матчиться несколько ключей; выигрывает самый длинный
// (наиболее специфичный), при равной длине — больший priority.
export const freezerShelfLife = pgTable('freezer_shelf_life', {
  id: serial('id').primaryKey(),
  keyword: text('keyword').notNull().unique(),
  days: integer('days').notNull(),
  priority: integer('priority').notNull().default(0),
  description: text('description'),
});

// Этап D+ — универсальный справочник сроков годности для всех типов
// хранения (миграция 021). Расширяет freezer_shelf_life на холодильник
// (fridge) и кладовку (pantry).
// storage_type: 'fridge' | 'freezer' | 'pantry'
// Используется inventory.suggestExpiry для автоподстановки срока
// при добавлении товаров из чека в инвентарь.
export const shelfLife = pgTable('shelf_life', {
  id: serial('id').primaryKey(),
  storageType: text('storage_type').notNull(),
  keyword: text('keyword').notNull(),
  days: integer('days').notNull(),
  priority: integer('priority').notNull().default(0),
  description: text('description'),
});



// История цен — каждая покупка товара фиксируется отдельной записью.
// Позволяет отслеживать динамику цен: когда, где и за сколько покупала.
// product_name связан с products.name_ru (не FK, чтобы не блокировать удаление).
export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  productName: text('product_name').notNull(),
  price: numeric('price').notNull(),
  storeName: text('store_name'),
  purchaseDate: text('purchase_date'),
  currency: text('currency').notNull().default('EUR'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
