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

## Receipt Parser — Status (сессия 22.05.2026)

### Что работает:
- Определение магазина (Aldi, AH, Jumbo, Lidl, российские сети)
- Определение итога чека
- Основной парсер (parseAll) для однострочных чеков (AH, Jumbo)
- Параллельные колонки (parseParallelColumns) — частично

### Что НЕ работает (нужно починить):
- **ALDI формат**: OCR выдаёт цены в ДРУГОМ порядке чем имена. Простой матчинг по индексу не работает.
- Конкретный пример OCR-текста (Aldi, Lent):
  - Имена: Fijn volkorenbrood, Scharreleieren 12st, Kippenvleugels, Volle kwark, Paprikamix Net, Barissimo intense, Komkommer, Kruimige aardappelen
  - Artikelkorting 30% — скидка (не товар), цена -2,07
  - Цены в OCR: 0,99 | 3,73 | 6,89 | -2,07 | 1,29 | 1,99 | 4,78 | 0,79 | 0,89
  - Правильное сопоставление: volkorenbrood=0,99, Scharreleieren=6,89, Kippenvleugels+Artikelkorting=-2,07+1,29 (нетто), kwark=1,99, Paprikamix=4,78, Barissimo=0,79, Komkommer=0,89, Kruimige=3,73
  - Итого: €19,28

### TODO для парсера:
1. Написать умный матчинг: перебор привязок имя→цена с проверкой суммы = итогу
2. Учитывать что OCR разбивает цены (3 + € + ,73 + €) — preprocessOcrText уже склеивает, но порядок всё равно неправильный
3. Протестировать на бумаге ПЕРЕД пушем
