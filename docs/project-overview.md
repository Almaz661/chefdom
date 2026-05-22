# ШефДом! — Обзор проекта

## Философия

1. **Mise en place** — система знает наперёд, что и когда нужно готовить
2. **Никакого выброса еды** — каждый продукт имеет траекторию от покупки до тарелки
3. **Повторяемость** — точные граммы, стабильный результат
4. **Сезонность и цена** — что сейчас в сезоне, что дёшево

## Архитектура

```
┌─────────────┐     tRPC (HTTP)     ┌─────────────────┐     postgres-js     ┌──────────┐
│  React SPA  │ ──────────────────► │  Express + tRPC │ ──────────────────► │ Neon PG  │
│  (Vite)     │ ◄────────────────── │  (Node 22, tsx) │ ◄────────────────── │ (Free)   │
└─────────────┘     superjson       └─────────────────┘                     └──────────┘
```

- **Frontend**: React 18 SPA, собирается Vite 5, стили через Tailwind CSS 4
- **Backend**: Express 4 + tRPC 11 (типобезопасный RPC без REST)
- **ORM**: Drizzle ORM 0.36 (pg-core), миграции — кастомные (server/db/migrate.ts)
- **Database**: PostgreSQL через Neon Free (pooled connection, sslmode=require)
- **Deploy**: Render Free, ручной деплой (autoDeploy: false)

## Страницы приложения

| # | Страница | URL | Описание |
|---|----------|-----|----------|
| 1 | LoginPage | /login | Экран ввода PIN-кода |
| 2 | Dashboard | / | Главная: меню дня, алерты, недавно готовила |
| 3 | RecipesPage | /recipes | Список рецептов (бесконечный скролл) |
| 4 | RecipeDetailPage | /recipes/:id | Карточка рецепта: фото, ингредиенты, шаги, таймеры |
| 5 | AddRecipePage | /recipes/add | Создание/редактирование рецепта (импорт по URL или вручную) |
| 6 | MenuPage | /menu | Меню недели (7 дней x 3 приёма пищи) |
| 7 | ShoppingPage | /shopping | Список покупок (генерируется из меню) |
| 8 | InventoryPage | /inventory | Инвентарь: холодильник, морозилка, кладовая |
| 9 | ProductsPage | /products | Каталог товаров (USDA + Open Food Facts) |
| 10 | ReceiptsPage | /receipts | Чеки из магазинов (OCR-сканирование фото) |
| 11 | ReceiptDetailPage | /receipts/:id | Детали чека: позиции, редактирование, перепарсинг |
| 12 | SettingsPage | /settings | Настройки: PIN, backup, restore |
| 13 | WhatToCookPage | /what-to-cook | Подбор рецептов из имеющихся продуктов |
| 14 | HistoryPage | /history | История готовки с фильтрами по периоду |
| 15 | NotFoundPage | * | Кастомная страница 404 на русском |

## tRPC-роутеры (API)

| Роутер | Файл | Назначение |
|--------|------|-----------|
| auth | server/routers/auth.ts | PIN-авторизация, блокировка при переборе |
| recipes | server/routers/recipes.ts | CRUD рецептов, импорт по URL, «Готовить» (FEFO) |
| menu | server/routers/menu.ts | Меню недели, «В покупки» |
| shopping | server/routers/shopping.ts | Список покупок, отметка купленного |
| inventory | server/routers/inventory.ts | Инвентарь, добавление из покупок |
| products | server/routers/products.ts | Каталог товаров, поиск по штрих-коду, замены |
| cooking | server/routers/cooking.ts | История готовки (record, list, recent, delete) |
| receipts | server/routers/receipts.ts | Чеки: OCR фото, парсинг, CRUD, перепарсинг |
| settings | server/routers/settings.ts | Смена PIN, backup/restore |

## Сервисы (бизнес-логика)

| Сервис | Файл | Назначение |
|--------|------|-----------|
| recipeScraper | server/services/recipeScraper.ts | Скрапинг рецептов по URL (JSON-LD, microdata, cheerio) |
| sectionImport | server/services/sectionImport.ts | Массовый импорт раздела сайта |
| ocr | server/services/ocr.ts | OCR.space API (распознавание фото чеков) |
| receiptParser | server/services/receiptParser.ts | Парсер OCR-текста чека (NL/RU магазины) |

## Этапы разработки

| Этап | Статус | Описание |
|------|--------|----------|
| 0 — Базовая система | ✓ | Рецепты, меню, покупки, инвентарь, PIN, backup |
| A — Массовый импорт | 🟡 | Импорт раздела сайта (discovery-логика) |
| G — Открытые базы | В работе | USDA ингредиенты, OFF товары, штрих-коды, КБЖУ, OCR чеков |
| B — Не выбрасывать еду | Частично | Алерты сроков, «Что приготовить», замены ингредиентов |
| F — Устройства | ⏳ | Wake Lock, Notifications, Offline, Camera, Mobile |
| C — Учёт | ⏳ | КБЖУ с нормами, предпочтения, аналитика расхода |
| D — Заготовки | ⏳ | Банки с двумя сроками, Sunday prep |
| E — Сезонность | ⏳ | Календарь сезонности, средние цены по чекам |

## Дизайн-система

- **Палитра**: терракотовый primary (#C44E12), кремовый фон (#FAF6F0)
- **Типографика**: Lora (serif заголовки), Inter (sans тело)
- **Тач-области**: минимум 48x48px для кнопок, 44x44 для иконок
- **Локализация**: только русский, числа ru-RU (1 000, 3,5 кг)
- **Анимация**: fade-in 200ms, scale-in 150ms, без декоративных анимаций

## Безопасность

- PIN-защита с блокировкой после 5 неверных попыток (30 минут)
- Сессия в localStorage, срок 30 дней
- Все API через tRPC, нет открытых REST-эндпоинтов
- HTTPS через Render (автоматически)
- PIN хранится plain text (домашнее приложение для одной семьи)
