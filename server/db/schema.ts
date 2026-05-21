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
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  pin: text('pin').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Этап 0 — рецепты
// calories, protein_g, fats_g, carbs_g — на порцию.
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

// Ингредиенты рецепта.
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

// Шаги рецепта.
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

// Меню недели.
export const menus = pgTable('menus', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  weekStartDate: text('week_start_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Слот в меню: день × приём пищи → рецепт.
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

// Инвентарь.
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
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Список покупок.
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

// Этап G — справочник ингредиентов (USDA FoodData Central).
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

// Этап G — каталог товаров (Open Food Facts).
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  ingredientId: integer('ingredient_id')
    .references(() => ingredients.id),
  barcode: text('barcode').unique(),
  nameRu: text('name_ru').notNull(),
  nameNl: text('name_nl'),
  brand: text('brand'),
  packageQuantity: numeric('package_quantity'),
  packageUnit: text('package_unit'),
  imageUrl: text('image_url'),
  offId: text('off_id').unique(),
});

// Этап G — замены ингредиентов.
export const ingredientSubstitutions = pgTable('ingredient_substitutions', {
  id: serial('id').primaryKey(),
  ingredientName: text('ingredient_name').notNull(),
  alternativeName: text('alternative_name').notNull(),
  quality: text('quality'),
  quantityRatio: numeric('quantity_ratio'),
});
