# ШефДом!

Личное web-приложение для ведения домашней кухни по системе профессионального шеф-повара.

## Что это

ШефДом! — не каталог рецептов. Это система управления домашней кухней одной семьи: рецепты, меню недели, список покупок, инвентарь продуктов, история готовки, сканирование чеков.

**Целевой пользователь:** одна семья, один PIN, без социальных функций.

**Целевые устройства:** iPad на кухне, iPhone/Android в магазине, десктоп для тяжёлой работы.

## Технологии

| Слой | Стек |
|------|------|
| Backend | Node.js 22, TypeScript, Express 4, tRPC 11, Drizzle ORM 0.36 |
| Database | PostgreSQL (Neon Free) |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 4 |
| UI | lucide-react, шрифты Lora + Inter, без UI-кита |
| Деплой | Render Free (autoDeploy: false) |

## Быстрый старт (локально)

```bash
# 1. Клонировать
git clone https://github.com/Almaz661/chefdom.git
cd chefdom

# 2. Установить зависимости
npm install

# 3. Создать .env из примера
cp .env.example .env
# Подставить DATABASE_URL из Neon Dashboard

# 4. Запустить сервер (бэкенд + миграции)
npm run dev:server

# 5. В другом терминале — фронтенд
npm run dev:client
```

Приложение откроется на http://localhost:5173. PIN по умолчанию: `1234`.

## Скрипты

| Команда | Что делает |
|---------|-----------|
| `npm run dev:server` | Запускает бэкенд с hot-reload (tsx watch) |
| `npm run dev:client` | Запускает Vite dev-сервер на :5173 |
| `npm run build` | Собирает фронтенд в dist/ |
| `npm start` | Production-запуск (используется на Render) |

## Структура проекта

```
chefdom/
├── server/           # Бэкенд (Express + tRPC)
│   ├── index.ts      # Точка входа сервера
│   ├── trpc.ts       # Инициализация tRPC
│   ├── db/           # БД: схема, миграции, сиды
│   ├── routers/      # tRPC-роутеры (auth, recipes, menu, ...)
│   └── services/     # Бизнес-логика (OCR, парсер чеков, скрапер)
├── src/              # Фронтенд (React)
│   ├── App.tsx       # Маршрутизация
│   ├── pages/        # Страницы приложения
│   ├── components/   # Переиспользуемые компоненты
│   └── utils/        # trpc-клиент, auth-утилиты
├── public/           # PWA: manifest, service worker, favicon
├── docs/             # Документация проекта
└── render.yaml       # Конфигурация Render (autoDeploy: false)
```

## Деплой

Деплой выполняется вручную через Render Dashboard. Подробности в [DEPLOY.md](./DEPLOY.md).

Перед деплоем всегда делать backup в Настройках приложения.

## Документация

- [Обзор проекта](./docs/project-overview.md) — архитектура, страницы, этапы разработки
- [Схема базы данных](./docs/database-schema.md) — все таблицы, поля, связи

## Стоимость

$0/мес (Render Free + Neon Free). Опционально $7/мес для отключения засыпания Render.

## Лицензия

Приватный проект для личного использования.
