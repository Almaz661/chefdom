# ШефДом! — Схема базы данных

PostgreSQL (Neon Free, 0.5 GB). ORM: Drizzle 0.36 (pg-core).

Миграции управляются файлом `server/db/migrate.ts` — применяются автоматически при старте сервера.

## Диаграмма связей

```
users ─────────┬──► menus ──► menu_items ──► recipes
               │                                 │
               ├──► inventory                    ├──► recipe_ingredients
               │                                 │
               ├──► purchase_items               ├──► recipe_steps
               │                                 │
               ├──► cooking_history ─────────────┘
               │
               └──► receipts ──► receipt_items ──► products ──► ingredients
                                                        │
                                        ingredient_substitutions
```

## Таблицы

### schema_migrations

Учёт применённых миграций. Управляется автоматически.

| Поле | Тип | Описание |
|------|-----|----------|
| version | TEXT PK | Версия миграции (001_users, 002_recipes, ...) |
| applied_at | TIMESTAMPTZ | Когда применена |

---

### users

Пользователи. На старте один: «Семья» с PIN 1234.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| pin | TEXT NOT NULL | PIN-код (plain text) |
| name | TEXT NOT NULL | Имя семьи |
| created_at | TIMESTAMPTZ | |

---

### recipes

Рецепты. Время в минутах, calories на порцию.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| title | TEXT NOT NULL | Название |
| description | TEXT | Описание |
| image_url | TEXT | URL фото (внешний) |
| servings | INTEGER DEFAULT 4 | Количество порций |
| prep_time | INTEGER | Время подготовки (мин) |
| cook_time | INTEGER | Время готовки (мин) |
| total_time | INTEGER | Общее время (мин) |
| source_url | TEXT | URL источника |
| source | TEXT | Название сайта-источника |
| category | TEXT | Категория (суп, салат, ...) |
| cuisine | TEXT | Кухня (русская, итальянская, ...) |
| difficulty | TEXT | Сложность (легко/средне/сложно) |
| calories | INTEGER | Калории на порцию |
| protein_g | NUMERIC | Белки на 100г (миграция 006) |
| fats_g | NUMERIC | Жиры на 100г (миграция 006) |
| carbs_g | NUMERIC | Углеводы на 100г (миграция 006) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### recipe_ingredients

Ингредиенты рецепта. Связь: recipes.id → recipe_ingredients.recipe_id (CASCADE).

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| recipe_id | INTEGER FK → recipes | |
| name | TEXT NOT NULL | Название ингредиента |
| amount | NUMERIC | Количество (1.5 = «1,5 ч. л.») |
| unit | TEXT | Единица (г, кг, мл, шт, ст. л.) |
| group_name | TEXT | Группа («Для теста», «Для соуса») |
| sort_order | INTEGER DEFAULT 0 | Порядок отображения |

---

### recipe_steps

Шаги приготовления. Связь: recipes.id → recipe_steps.recipe_id (CASCADE).

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| recipe_id | INTEGER FK → recipes | |
| step_number | INTEGER NOT NULL | Номер шага |
| instruction | TEXT NOT NULL | Текст инструкции |
| image_url | TEXT | Фото шага (опционально) |
| timer_minutes | INTEGER | Таймер для этого шага |

---

### menus

Меню недели. Связь: users.id → menus.user_id.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK → users | |
| week_start_date | TEXT NOT NULL | Понедельник недели (YYYY-MM-DD) |
| created_at | TIMESTAMPTZ | |

Уникальный индекс: (user_id, week_start_date).

---

### menu_items

Слоты меню: день x приём пищи → рецепт. Связь: menus.id → menu_items.menu_id (CASCADE).

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| menu_id | INTEGER FK → menus | |
| day_of_week | INTEGER NOT NULL | 0=Пн, 1=Вт, ..., 6=Вс |
| meal_type | TEXT NOT NULL | breakfast / lunch / dinner |
| recipe_id | INTEGER FK → recipes | |

---

### inventory

Инвентарь продуктов дома. Связь: users.id → inventory.user_id.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK → users | |
| product_name | TEXT NOT NULL | Название продукта |
| quantity | NUMERIC | Количество |
| unit | TEXT | Единица измерения |
| storage_type | TEXT DEFAULT 'fridge' | fridge / freezer / pantry |
| expiry_date | TEXT | Срок годности (YYYY-MM-DD) |
| min_quantity | NUMERIC | Минимальный запас |
| category | TEXT | Категория (молочные, овощи, ...) |
| updated_at | TIMESTAMPTZ | |

---

### purchase_items

Список покупок. Связь: users.id → purchase_items.user_id.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK → users | |
| product_name | TEXT NOT NULL | Название |
| quantity | NUMERIC | Сколько нужно |
| unit | TEXT | Единица |
| category | TEXT | Категория |
| is_checked | INTEGER DEFAULT 0 | 0=не куплено, 1=куплено |
| recipe_source | TEXT | Из какого рецепта добавлено |
| needed_quantity | NUMERIC | Нужно по рецепту |
| in_stock_quantity | NUMERIC | Уже есть дома |
| added_at | TIMESTAMPTZ | |

---

### ingredients

Справочник ингредиентов (USDA FoodData Central). Этап G.1.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| fdc_id | INTEGER UNIQUE | ID в USDA FDC |
| name_ru | TEXT NOT NULL | Название на русском |
| name_en | TEXT | Название на английском |
| category | TEXT | Категория |
| default_unit | TEXT | Единица по умолчанию |
| kcal_per_100g | NUMERIC | Калории на 100г |
| protein_g | NUMERIC | Белки на 100г |
| fats_g | NUMERIC | Жиры на 100г |
| carbs_g | NUMERIC | Углеводы на 100г |
| water_pct | NUMERIC | % воды |

---

### products

Каталог товаров (Open Food Facts). Этап G.2.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| ingredient_id | INTEGER FK → ingredients | Связь с ингредиентом |
| barcode | TEXT UNIQUE | Штрих-код EAN |
| name_ru | TEXT NOT NULL | Название на русском |
| name_nl | TEXT | Название на голландском |
| brand | TEXT | Бренд |
| package_quantity | NUMERIC | Объём/вес упаковки |
| package_unit | TEXT | Единица упаковки |
| image_url | TEXT | Фото товара |
| off_id | TEXT UNIQUE | ID в Open Food Facts |

---

### ingredient_substitutions

Таблица замен ингредиентов. Этап B.3.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| ingredient_name | TEXT NOT NULL | Исходный ингредиент |
| alternative_name | TEXT NOT NULL | Чем заменить |
| quality | TEXT | Качество замены (хорошо/нормально/в крайнем случае) |
| quantity_ratio | NUMERIC | Пропорция замены (1.0 = 1:1) |

Индекс: ingredient_name.

---

### cooking_history

История готовки. Связь: users.id → cooking_history.user_id, recipes.id → cooking_history.recipe_id (SET NULL при удалении рецепта).

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK → users | |
| recipe_id | INTEGER FK → recipes (SET NULL) | Nullable — история переживает удаление рецепта |
| recipe_title | TEXT NOT NULL | Снапшот названия рецепта |
| servings | INTEGER DEFAULT 1 | Фактическое кол-во порций |
| calories_per_serving | INTEGER | Калории на порцию |
| category | TEXT | Категория рецепта |
| cuisine | TEXT | Кухня рецепта |
| consumed_count | INTEGER DEFAULT 0 | Сколько ингредиентов списано |
| total_ingredients | INTEGER DEFAULT 0 | Сколько ингредиентов в рецепте |
| notes | TEXT | Заметки |
| rating | INTEGER | Оценка (будущий этап C.2) |
| cooked_at | TIMESTAMPTZ | Когда готовили |

Индексы: (user_id, cooked_at DESC), (recipe_id).

---

### receipts

Чеки из магазинов. Этап G.19. Связь: users.id → receipts.user_id.

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK → users | |
| store_name | TEXT | Название магазина (авто из OCR) |
| purchase_date | TEXT | Дата покупки (YYYY-MM-DD, авто из OCR) |
| total_amount | NUMERIC | Итого по чеку |
| currency | TEXT DEFAULT 'EUR' | EUR или RUB |
| status | TEXT DEFAULT 'draft' | draft / final |
| notes | TEXT | Заметки |
| ocr_raw | TEXT | Сырой текст OCR (для перепарсинга) |
| created_at | TIMESTAMPTZ | |

Индекс: (user_id, created_at DESC).

---

### receipt_items

Позиции чека. Связь: receipts.id → receipt_items.receipt_id (CASCADE).

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| receipt_id | INTEGER FK → receipts | |
| product_name | TEXT NOT NULL | Название товара (снапшот) |
| quantity | NUMERIC | Количество |
| unit | TEXT | Единица |
| price | NUMERIC | Цена |
| barcode | TEXT | Штрих-код (если сканировали) |
| matched_product_id | INTEGER FK → products (SET NULL) | Связь с каталогом |
| sort_order | INTEGER DEFAULT 0 | Порядок в чеке |

Индекс: (receipt_id).

---

## Миграции

| Версия | Что создаёт |
|--------|------------|
| 001_users | Таблица users |
| 002_recipes | Таблицы recipes, recipe_ingredients, recipe_steps |
| 003_menus | Таблицы menus, menu_items |
| 004_purchase_items | Таблица purchase_items |
| 005_inventory | Таблица inventory |
| 006_ingredients_products | Поля КБЖУ в recipes + таблицы ingredients, products, ingredient_substitutions |
| 007_cooking_history | Таблица cooking_history |
| 008_receipts | Таблицы receipts, receipt_items |
| 009_receipts_ocr_raw | Поле ocr_raw в receipts |

Миграции применяются автоматически при старте сервера. Идемпотентны (IF NOT EXISTS). Откат — через Render Rollback (код возвращается к предыдущей версии).
