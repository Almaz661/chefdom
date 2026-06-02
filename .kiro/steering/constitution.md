# CHEFDOM CONSTITUTION v1.0

> Документ зафиксирован на основе CHEFDOM MASTER AUDIT v1.0.
> Все факты проверены по реальному коду проекта. Ничего не придумано. Ничего не предложено. Только зафиксированные решения.

---

## 1. Миссия ChefDom

ChefDom — операционная система домашней кухни одной семьи.

Помнит всё в холодильнике, морозилке и кладовой. Знает все рецепты. Формирует список покупок из меню. Списывает продукты при готовке по принципу FEFO. Автоматически добавляет продукты в покупки при достижении минимального остатка. Считает расходы. Подсказывает что приготовить из имеющегося.

**Философия** (зафиксирована в AGENTS.md и README.md):

> «Один раз настроил — каждый день работает само»

---

## 2. Чем является ChefDom

| Что | Обоснование |
|-----|-------------|
| Система управления домашней кухней | README.md, AGENTS.md |
| Трекер инвентаря (холодильник + морозилка + кладовая) | InventoryPage, таблица inventory |
| Планировщик меню на неделю (7×3) | MenuPage, таблицы menus, menu_items |
| Генератор списка покупок | ShoppingPage, таблица purchase_items |
| Сканер чеков с OCR (Gemini Vision) | ocr.ts, receiptParser.ts |
| Трекер расходов по магазинам | analytics.ts, таблицы receipts, price_history |
| Система рецептов с импортом (URL/YouTube/ручной) | recipeScraper.ts, youtube.ts |
| Продуктовый каталог с историей цен (Product Master) | таблица products, price_history |
| Персональное приложение для одной семьи | README.md: "один PIN, без социальных функций" |
| PWA для iPad, iPhone, Android, desktop | README.md, main.tsx |

---

## 3. Чем ChefDom НЕ является

| Чем не является | Зафиксировано в |
|-----------------|-----------------|
| Каталогом рецептов / кулинарным сайтом | README.md: "ШефДом — не каталог рецептов" |
| Социальной сетью / платформой | README.md: "без социальных функций" |
| Мультипользовательским приложением | README.md: "один PIN, одна семья" |
| CRM-системой | Не предусмотрено архитектурой |
| ERP-системой | Не предусмотрено архитектурой |
| Интернет-магазином | Не предусмотрено архитектурой |
| Системой доставки еды | Не предусмотрено архитектурой |
| Публичным сервисом | README.md: "Приватный проект для личного использования" |

---

## 4. Основные принципы проекта

| Принцип | Источник |
|---------|----------|
| Mise en place — система знает наперёд | docs/project-overview.md |
| Никакого выброса еды — каждый продукт имеет траекторию от покупки до тарелки | docs/project-overview.md |
| Повторяемость — точные граммы, стабильный результат | docs/project-overview.md |
| FEFO — First Expire, First Out — при списании в первую очередь уходят истекающие | recipes.ts -> cook процедура |
| Авто-докупка при minQuantity | inventory.ts -> checkMinQuantity, recipes.cook |
| Дедупликация покупок — одинаковые ингредиенты объединяются | menu.ts -> toShopping, shopping.ts -> deduplicate |
| Один пользователь — одна семья — один PIN | users таблица, auth.ts |
| Бесплатная инфраструктура | README.md: "$0/мес (Render Free + Neon Free)" |

---

## 5. Неизменяемые архитектурные решения

### 5.1 Технологический стек

| Слой | Технология | Статус |
|------|-----------|--------|
| Backend | Node.js 22 + TypeScript + Express 4 + tRPC 11 | Зафиксировано кодом |
| Database | PostgreSQL via Neon Free (pooled, sslmode=require) | Зафиксировано кодом |
| ORM | Drizzle ORM 0.36 (pg-core) | Зафиксировано кодом |
| Миграции | Кастомная система (server/db/migrate.ts), версионные, идемпотентные | Зафиксировано кодом |
| Frontend | React 18 + Vite 5 + React Router 6 + Tailwind CSS 4 | Зафиксировано кодом |
| API | tRPC 11 (типобезопасный RPC, без REST для данных) | Зафиксировано кодом |
| Deploy | Render Free, ручной деплой (autoDeploy: false) | Зафиксировано документацией |

### 5.2 Аутентификация

| Решение | Статус |
|---------|--------|
| PIN 4 цифры + bcrypt hash (cost 10) | Зафиксировано кодом (migrate.ts 018) |
| Bearer token сессии (32 байта hex, 30 дней) | Зафиксировано кодом (auth.ts) |
| Brute-force защита в БД (5 попыток -> блок 30 мин) | Зафиксировано кодом (migrate.ts 017) |
| protectedProcedure для всех процедур кроме auth.login и auth.getUser | Зафиксировано кодом (trpc.ts) |
| Автоматический redirect на /login при 401 | Зафиксировано кодом (src/utils/trpc.ts) |

### 5.3 Навигация (неизменяемая)

| Route | Страница |
|-------|----------|
| /login | LoginPage |
| / | Dashboard |
| /recipes | RecipesPage |
| /recipes/add | AddRecipePage |
| /recipes/:id/edit | AddRecipePage (edit mode) |
| /recipes/:id | RecipeDetailPage |
| /menu | MenuPage |
| /shopping | ShoppingPage |
| /inventory | InventoryPage |
| /preserves | PreservesPage |
| /settings | SettingsPage |
| /products | ProductsPage |
| /receipts | ReceiptsPage |
| /receipts/:id | ReceiptDetailPage |
| /what-to-cook | WhatToCookPage |
| /history | HistoryPage |
| /analytics | AnalyticsPage |
| * | NotFoundPage |

### 5.4 API структура

- Все данные через tRPC `/trpc`
- Три не-tRPC endpoint: `GET /api/health`, `GET /api/seed-ingredients`, `GET /api/calc-nutrition`
- Все tRPC процедуры через `protectedProcedure` кроме `auth.login` и `auth.getUser`

---

## 6. Неизменяемые решения Product Master

### 6.1 Структура (таблица products)

| Поле | Тип | Назначение |
|------|-----|-----------|
| id | SERIAL PK | — |
| ingredient_id | FK -> ingredients | Связь с USDA |
| barcode | TEXT UNIQUE | EAN штрих-код |
| name_ru | TEXT NOT NULL UNIQUE | Единственный ключ идентификации |
| name_nl | TEXT | Исходное название на нидерландском |
| brand | TEXT | Бренд |
| package_quantity | NUMERIC | Объём упаковки |
| package_unit | TEXT | Единица упаковки |
| image_url | TEXT | Фото из OFF (редко заполнено) |
| off_id | TEXT UNIQUE | ID в Open Food Facts |
| last_price | NUMERIC | Последняя известная цена |
| avg_price | NUMERIC | Средняя цена (поле есть, логика вычисления не реализована) |
| price_updated_at | TIMESTAMPTZ | Дата обновления цены |
| store_name | TEXT | Магазин последней покупки |
| purchase_date | TEXT | Дата последней покупки |

**Уникальный индекс:** `idx_products_name_ru_unique` на `name_ru` — критичен для ON CONFLICT.

### 6.2 Источники заполнения

| Источник | Механизм |
|----------|----------|
| Фото чека | updateProductMasterPrices() в receipts.ts |
| Перепарсинг чека | updateProductMasterPrices() в receipts.ts |
| Синхронизация из всех чеков | receipts.syncAllToProducts |
| Добавление из инвентаря (bulk) | inventory.addBulk -> INSERT ON CONFLICT |
| Умный перенос из покупок | inventory.addBulkSmart -> INSERT ON CONFLICT |
| Штрих-код (Open Food Facts) | products.getByBarcode |

### 6.3 Использование

| Использование | Где |
|--------------|-----|
| ALDI двухблочный matching | receiptParser.ts -> matchItemsWithProductMaster() |
| Просмотр каталога | ProductsPage.tsx |
| История цен | ProductsPage.tsx -> ProductCard |
| Ценовое сравнение | analytics.priceComparison |

### 6.4 Связанные таблицы

- `price_history` — soft link через product_name TEXT (намеренно без FK)
- `receipt_items.matched_product_id` -> `products.id` ON DELETE SET NULL
- `ingredients.id` -> `products.ingredient_id` (USDA данные)

---

## 7. Неизменяемые решения Inventory

### 7.1 Таблица inventory

| Поле | Назначение |
|------|-----------|
| storage_type | 'fridge' / 'freezer' / 'pantry' — три хранилища |
| expiry_date | YYYY-MM-DD, nullable |
| min_quantity | Порог авто-докупки |
| is_basic | Базовые продукты — не попадают в покупки |
| added_at | Дата добавления — для алерта "давно лежит" |

### 7.2 Ключевые правила

| Правило | Реализация |
|---------|-----------|
| FEFO при готовке | recipes.cook — сортировка по expiryDate ASC |
| Авто-докупка при min_quantity | inventory.checkMinQuantity, вызывается из recipes.cook |
| Базовые продукты (is_basic=1) не попадают в покупки | menu.toShopping, recipes.cook |
| Авто-определение storage_type по ключевым словам | inventory.addBulkSmart |
| Авто-подстановка expiry_date по справочнику | inventory.suggestExpiry -> таблица shelf_life |
| Заготовки preserve_type='frozen' отображаются в freezer tab | InventoryPage.tsx |

### 7.3 Справочники сроков хранения

| Таблица | Покрытие | Миграция |
|---------|----------|----------|
| freezer_shelf_life | 80+ ключевых слов для морозилки | 020, 030 |
| shelf_life | 70+ для холодильника, 60+ для кладовой, копия freezer | 021, 031, 033 |

---

## 8. Неизменяемые решения холодильника

| Решение | Источник |
|---------|----------|
| storage_type = 'fridge' | inventory таблица |
| Визуальный класс `atmosphere-fridge` | index.css |
| Image filter: brightness(1.02) contrast(1.08) saturate(1.15) | index.css |
| Карточки с классом `item-card` | InventoryPage.tsx |
| Алерты истечения сроков (период переключаемый: 3/7/14/30 дней) | InventoryPage.tsx |
| Категорийная группировка по полю inventory.category | InventoryPage.tsx |
| Отображение продуктовых изображений 64x64 через getProductImageSrc | InventoryPage.tsx |
| Emoji fallback при отсутствии изображения | InventoryPage.tsx |
| Переключатель "Все сроки годности" (collapsible) | InventoryPage.tsx |

---

## 9. Неизменяемые решения морозилки

| Решение | Источник |
|---------|----------|
| storage_type = 'freezer' | inventory таблица |
| Заготовки preserve_type='frozen' из preserves — тоже отображаются во freezer tab | InventoryPage.tsx |
| Визуальный класс `atmosphere-freezer` | index.css |
| Image filter: brightness(0.92) contrast(1.05) saturate(0.85) hue-rotate(-5deg) | index.css |
| Frost particles анимация: класс frost-particles определён в CSS | index.css |
| Справочник сроков freezer_shelf_life — шеф-подсказка при добавлении заготовки | preserves.suggestExpiry |
| Заготовки типа frozen в PreservesPage — с полем servings и кнопкой "Съесть" | PreservesPage.tsx |
| Авто-подстановка срока хранения в AddPreserveDialog через preserves.suggestExpiry | PreservesPage.tsx |

---

## 10. Неизменяемые решения кладовой

| Решение | Источник |
|---------|----------|
| storage_type = 'pantry' | inventory таблица |
| Визуальный класс `atmosphere-pantry` | index.css |
| Image filter: brightness(0.95) contrast(1.05) saturate(1.1) sepia(0.08) | index.css |
| is_basic — базовые продукты кладовой (соль, масло, мука) не попадают в покупки | inventory таблица, InventoryPage.tsx |
| Справочник сроков shelf_life с storage_type='pantry' — 70+ записей | migrate.ts 021 |
| Pin-индикатор для базовых продуктов | InventoryPage.tsx |

---

## 11. Неизменяемые решения рецептов

### 11.1 Таблицы

- `recipes` — основные данные включая КБЖУ (protein_g, fats_g, carbs_g, calories)
- `recipe_ingredients` — ингредиенты с amount, unit, group_name, sort_order
- `recipe_steps` — шаги с timer_minutes

### 11.2 Ключевые решения

| Решение | Источник |
|---------|----------|
| Импорт по URL (JSON-LD -> microdata -> generic fallback) | recipeScraper.ts |
| Импорт раздела сайта (in-memory job, один активный) | sectionImport.ts |
| Импорт из YouTube (субтитры + Gemini AI) | youtube.ts, recipes.importFromYoutube |
| Авто-перевод через DeepL при импорте | translate.ts, recipes.importFromUrl |
| Авто-расчёт КБЖУ через USDA справочник (ingredients таблица) | nutritionCalc.ts |
| Нормализация категорий через normalizeRecipeCategory | categoryNormalize.ts |
| Готовить = FEFO списание + запись в cooking_history + создание preserves типа cooked | recipes.cook |
| Множитель порций x1/x2/x4 (на frontend) | RecipeDetailPage.tsx |
| WakeLock при просмотре рецепта | RecipeDetailPage.tsx |
| StepTimer с Web Notifications | StepTimer.tsx |
| SubstitutionDialog — 480+ пар замен в ingredient_substitutions | SubstitutionDialog.tsx |
| SSRF защита при fetch внешних URL | urlValidation.ts |

### 11.3 Категории (нормализованные)

Зафиксированы в `categoryNormalize.ts`:

Десерты, Основные блюда, Салаты, Супы, Закуски, Завтраки, Соусы, Выпечка, Напитки, Заготовки, Гарниры (в sectionImport).

---

## 12. Неизменяемые решения меню

| Решение | Источник |
|---------|----------|
| Структура: 7 дней x 3 приёма пищи (breakfast/lunch/dinner) | menus, menu_items таблицы |
| day_of_week: 0=Пн, 1=Вт, ..., 6=Вс | menu_items.day_of_week |
| Несколько рецептов в одном слоте — разрешено | menu_items — нет UNIQUE на (menu_id, day, meal) |
| toShopping — агрегация ингредиентов с дедупликацией и нормализацией | menu.ts |
| toShopping исключает продукты из инвентаря и базовые продукты | menu.ts -> atHomeKeys |
| Уникальный индекс на (user_id, week_start_date) | миграция 028 |
| Умные подсказки getSuggestions — по истекающим, давно не готовленным, никогда не готовленным, доступности | menu.ts |
| weekStartDate — всегда понедельник (YYYY-MM-DD) | menu.ts, MenuPage.tsx |

---

## 13. Неизменяемые решения покупок

| Решение | Источник |
|---------|----------|
| Три источника: из меню, из готовки (недостающие), вручную | menu.toShopping, recipes.cook, shopping.add |
| is_checked: 0 = не куплено, 1 = куплено | purchase_items.is_checked |
| Авто-дедупликация по нормализованному имени | shopping.deduplicate, menu.toShopping |
| Preview раскладки по хранилищам перед "Всё в инвентарь" | ShoppingPage.tsx — ShoppingPreviewDialog |
| inventory.addBulkSmart — умный перенос с авто-определением storage + expiry | ShoppingPage.tsx |
| buyAndStore — единичный перенос через shopping.buyAndStore | shopping.ts |
| clearChecked — удаление купленных | shopping.ts |

---

## 14. Неизменяемые решения чеков

| Решение | Источник |
|---------|----------|
| OCR провайдер: Google Gemini Vision (gemini-flash-latest) | ocr.ts |
| GEMINI_API_KEY — обязательная переменная окружения | ocr.ts |
| ocrRaw — сырой текст OCR сохраняется для перепарсинга | receipts.ocr_raw, миграция 009 |
| Перепарсинг без повторного OCR-запроса | receipts.reparse |
| Перевод позиций NL/DE/PL->RU через DeepL batch | receipts.ts -> translateBatchToRu |
| Валюты: EUR и RUB | receipts.currency |
| default_currency в users | миграция 015 |
| ALDI двухблочный формат — через Product Master matching | receiptParser.ts -> matchItemsWithProductMaster |
| "В инвентарь" — с per-item storage type и auto-expiry suggestion | ReceiptDetailPage.tsx -> InventoryItemRow |
| 30+ поддерживаемых торговых сетей | receiptParser.ts -> KNOWN_STORES |

---

## 15. Неизменяемые решения аналитики

| Решение | Источник |
|---------|----------|
| Три вкладки: Готовка / Расходы / Где дешевле | AnalyticsPage.tsx |
| spendingReport — по месяцу или году | analytics.spendingReport |
| priceComparison — только товары из 2+ магазинов | analytics.priceComparison |
| topRecipes — топ-5 по периоду (week/month/3months) | analytics.topRecipes |
| productConsumption — топ-10 расхода продуктов | analytics.productConsumption |
| История цен — из price_history таблицы | price_history |
| Данные расходов — из receipts и receipt_items | analytics.ts |
| Данные готовки — из cooking_history | analytics.ts |

---

## 16. Подтверждено кодом

| Элемент | Файл |
|---------|------|
| Все 21 таблица БД | schema.ts, migrate.ts |
| Все 32+ миграции | migrate.ts |
| Все 11 tRPC роутеров | server/routers/ |
| Все 17 страниц | src/pages/ |
| Все 8 standalone компонентов | src/components/ |
| Все 9 сервисов | server/services/ |
| 4 атмосферных CSS класса | index.css |
| 94 маппинга product images | productImages.ts |
| Gemini Vision как OCR провайдер | ocr.ts |
| DeepL как переводчик | translate.ts |
| YouTube Data API | youtube.ts |
| Open Food Facts | products.ts |
| ZXing barcode scanner | BarcodeScanner.tsx |
| bcrypt PIN hash | migrate.ts 018, auth.ts |
| FEFO списание | recipes.ts -> cook |
| Product Master filling pipeline | receipts.ts |

---

## 17. Подтверждено документацией (не всегда подтверждено кодом)

| Элемент | Документ | Расхождение с кодом |
|---------|----------|---------------------|
| Стек технологий | README.md | Совпадает с кодом |
| 15 страниц (таблица маршрутов) | docs/project-overview.md | Устарело — в коде 17 страниц |
| PIN как plain text | docs/project-overview.md | Устарело — в коде bcrypt (миграция 018) |
| OCR.space как OCR провайдер | .env.example | Устарело — в коде Gemini Vision |
| Офлайн-режим PWA | README.md, USER-GUIDE.md | sw.js не предоставлен для проверки |
| avg_price логика | docs/database-schema.md | Поле есть, логика вычисления в коде отсутствует |
| rating в cooking_history | docs/database-schema.md | Поле есть, UI и логика отсутствуют |

---

## 18. Требует подтверждения владельца

| Вопрос | Почему требует подтверждения |
|--------|------------------------------|
| Актуален ли OCR_SPACE_API_KEY в .env.example? | В коде используется только Gemini |
| Нужно ли вычислять avg_price? | Поле создано, логика отсутствует |
| Нужен ли rating для cooking_history? | Поле создано (помечено как "будущий этап C.2"), UI нет |
| Что содержит public/sw.js? | Файл не предоставлен для аудита |
| Актуален ли GEMINI_API_KEY добавить в .env.example? | Используется в коде, отсутствует в .env.example |
| Актуален ли YOUTUBE_API_KEY добавить в .env.example? | Используется в коде, отсутствует в .env.example |

---

## 19. Правила для будущих AI

### 19.1 ЗАПРЕЩЕНО без явного разрешения владельца

| Запрет | Обоснование |
|--------|-------------|
| Менять структуру таблицы products (Product Master) | Зафиксирована в миграциях 006, 010, 022, 024 |
| Менять структуру любой таблицы БД | 21 таблица зафиксирована, 32+ миграции |
| Добавлять новые таблицы без миграции | Все изменения БД только через migrate.ts |
| Менять навигацию (routes) | Зафиксировано в App.tsx |
| Менять tRPC роутеры без необходимости | Все процедуры задокументированы |
| Менять архитектуру (стек, ORM, роутинг) | Зафиксировано в README.md и коде |
| Превращать ChefDom в каталог рецептов | README.md: "ШефДом — не каталог рецептов" |
| Превращать ChefDom в CRM | Не предусмотрено архитектурой |
| Превращать ChefDom в ERP | Не предусмотрено архитектурой |
| Превращать ChefDom в интернет-магазин | Не предусмотрено архитектурой |
| Добавлять мультипользовательский режим | README.md: "один PIN, одна семья" |
| Добавлять социальные функции | README.md: "без социальных функций" |
| Менять FEFO логику списания | Критический бизнес-принцип |
| Убирать концепцию трёх хранилищ | Холодильник/Морозилка/Кладовая — фундамент инвентаря |
| Убирать атмосферные визуальные классы | Зафиксированы в index.css |
| Менять цветовые токены | Зафиксированы в index.css @theme |
| Заменять OCR провайдер без явного указания | Текущий: Gemini Vision в ocr.ts |
| Придумывать функциональность которой нет в аудите | Только задокументированное |

### 19.2 ОБЯЗАТЕЛЬНО при любых изменениях

| Правило | Обоснование |
|---------|-------------|
| Сохранять концепцию домашней кухни одной семьи | README.md |
| Сохранять концепцию холодильника, морозилки и кладовой как отдельных пространств | inventory.storage_type, атмосферные классы |
| Сохранять FEFO как принцип списания | recipes.cook |
| Сохранять Product Master как единственный каталог товаров | products таблица |
| Сохранять name_ru как уникальный ключ Product Master | idx_products_name_ru_unique |
| Сохранять is_basic как механизм исключения из покупок | inventory.is_basic |
| Сохранять атмосферные классы CSS при любом UI-изменении | atmosphere-fridge/freezer/pantry/home |
| Проверять факты по CHEFDOM CONSTITUTION перед любым решением | Этот документ |

### 19.3 МЕТОДОЛОГИЯ работы с проектом

| Правило | Описание |
|---------|----------|
| Факты прежде всего | Любое утверждение должно быть подтверждено кодом или документом из аудита |
| Не придумывать | Если функциональность не найдена в аудите — писать "не подтверждено" |
| Не предполагать | Если статус неясен — обращаться к разделу 18 "Требует подтверждения владельца" |
| Не расширять скоуп | ChefDom решает конкретные задачи домашней кухни. Всё остальное — out of scope |
| Обновлять конституцию | При любом значительном изменении проекта Constitution должна быть обновлена |

---

**CHEFDOM CONSTITUTION v1.0** — документ зафиксирован.
