# Barcode Scanner — Status & Next Steps

## What Doesn't Work (DO NOT USE)

- **Video scanner** (`getUserMedia` + `decodeFromVideoDevice`) — **не работает на iOS Safari**. Не использовать этот подход.

## What Partially Works

- **Photo scanner** (`<input capture>` + `decodeFromImageElement`) — работает, но распознаёт штрих-код плохо (~1 из 5 попыток). Нужно улучшить.

## Known Issues

- **Service Worker cache** — источник 90% проблем с «страница не обновляется». Нужно бампать `CACHE_NAME` при каждом деплое автоматически.
- **OFF API fallback** — код для определения товара по штрих-коду через Open Food Facts написан в `server/routers/products.ts`, но не попал в main (PR #26 слился до второго коммита).

## TODO (Next Session)

1. **Запушить OFF API fallback** — код готов в `products.ts`, нужно добавить в main.
2. **Улучшить распознавание штрих-кодов:**
   - Увеличить (upscale) изображение перед декодированием.
   - Попробовать несколько попыток с разными настройками ZXing.
3. **Автоматический бамп SW кеша при билде** — чтобы `CACHE_NAME` в `public/sw.js` менялся при каждом `npm run build`.

## Deploy Rules

- **НЕ деплоить после каждого PR** — делать Manual Deploy на Render только когда все нужные PR слиты в main.
