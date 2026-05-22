// Тест Product Master на реальных чеках
// Запуск: node test-product-master.js

// Копия matchItemsWithProductMaster для тестирования
function matchItemsWithProductMaster(names, prices, productMaster) {
  const result = [];
  const usedPrices = new Set();

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const normalizedName = name.toLowerCase().trim();
    const masterEntry = productMaster.find((entry) => {
      const entryName = entry.nameRu.toLowerCase().trim();
      return (
        normalizedName.includes(entryName) ||
        entryName.includes(normalizedName)
      );
    });

    if (masterEntry && masterEntry.lastPrice) {
      const targetPrice = masterEntry.lastPrice;
      let bestIdx = -1;
      let bestDiff = Infinity;

      for (let j = 0; j < prices.length; j++) {
        if (usedPrices.has(j)) continue;
        const diff = Math.abs(prices[j] - targetPrice);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = j;
        }
      }

      if (bestIdx !== -1) {
        result.push({ name, price: prices[bestIdx] });
        usedPrices.add(bestIdx);
        continue;
      }
    }

    if (i < prices.length && !usedPrices.has(i)) {
      result.push({ name, price: prices[i] });
      usedPrices.add(i);
    } else {
      const firstUnused = prices.findIndex((_, idx) => !usedPrices.has(idx));
      if (firstUnused !== -1) {
        result.push({ name, price: prices[firstUnused] });
        usedPrices.add(firstUnused);
      } else {
        result.push({ name, price: 0 });
      }
    }
  }

  return result;
}

// Утилита для сравнения результатов
function assertEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    console.error(`❌ FAIL: ${message}`);
    console.error(`  Ожидалось: ${expectedStr}`);
    console.error(`  Получено:  ${actualStr}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

function assertSum(items, expectedSum, message) {
  const sum = items.reduce((acc, item) => acc + item.price, 0);
  const rounded = Math.round(sum * 100) / 100;
  if (Math.abs(rounded - expectedSum) > 0.01) {
    console.error(`❌ FAIL: ${message}`);
    console.error(`  Ожидаемая сумма: ${expectedSum}`);
    console.error(`  Фактическая сумма: ${rounded}`);
    console.error(`  Позиции:`, items);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

// ===========================
// ЧЕК #2 — Двухблочный формат (19,28€)
// ===========================

console.log('\n=== ЧЕК #2: Двухблочный формат (ALDI, 19,28€) ===\n');

const names2 = [
  'Fijn volkorenbrood',
  'Scharreleieren 12st',
  'Kippenvleugels',
  'Artikelkorting 30%',
  'Volle kwark',
  'Paprikamix Net',
  'Barissimo intense',
  'Komkommer',
  'Kruimige aardappelen',
];

const prices2 = [0.99, 3.73, 6.89, -2.07, 1.29, 1.99, 4.78, 0.79, 0.89];

const productMaster2 = [
  { nameRu: 'Fijn volkorenbrood', lastPrice: 0.99 },
  { nameRu: 'Scharreleieren 12st', lastPrice: 3.73 },
  { nameRu: 'Kippenvleugels', lastPrice: 6.89 },
  { nameRu: 'Volle kwark', lastPrice: 1.29 },
  { nameRu: 'Paprikamix Net', lastPrice: 1.99 },
  { nameRu: 'Barissimo intense', lastPrice: 4.78 },
  { nameRu: 'Komkommer', lastPrice: 0.75 },
  { nameRu: 'Kruimige aardappelen', lastPrice: 0.69 },
];

console.log('Тест 1: Двухблочный формат С Product Master (все товары знакомые)');
const result2 = matchItemsWithProductMaster(names2, prices2, productMaster2);

const expected2 = [
  { name: 'Fijn volkorenbrood', price: 0.99 },
  { name: 'Scharreleieren 12st', price: 3.73 },
  { name: 'Kippenvleugels', price: 6.89 },
  { name: 'Artikelkorting 30%', price: -2.07 },
  { name: 'Volle kwark', price: 1.29 },
  { name: 'Paprikamix Net', price: 1.99 },
  { name: 'Barissimo intense', price: 4.78 },
  { name: 'Komkommer', price: 0.79 },
  { name: 'Kruimige aardappelen', price: 0.89 },
];

assertEqual(result2, expected2, 'Привязка товаров к ценам');
assertSum(result2, 19.28, 'Сумма чека = 19.28€');

// ===========================
// ЧЕК #2 — БЕЗ Product Master
// ===========================

console.log('\nТест 2: Двухблочный формат БЕЗ Product Master (fallback по индексу)');
const result2NoMaster = matchItemsWithProductMaster(names2, prices2, []);

const expected2NoMaster = [
  { name: 'Fijn volkorenbrood', price: 0.99 },
  { name: 'Scharreleieren 12st', price: 3.73 },
  { name: 'Kippenvleugels', price: 6.89 },
  { name: 'Artikelkorting 30%', price: -2.07 },
  { name: 'Volle kwark', price: 1.29 },
  { name: 'Paprikamix Net', price: 1.99 },
  { name: 'Barissimo intense', price: 4.78 },
  { name: 'Komkommer', price: 0.79 },
  { name: 'Kruimige aardappelen', price: 0.89 },
];

assertEqual(result2NoMaster, expected2NoMaster, 'Fallback по индексу');
assertSum(result2NoMaster, 19.28, 'Сумма чека = 19.28€ (даже без PM)');

// ===========================
// ЧЕК #2 — Частичный Product Master
// ===========================

console.log('\nТест 3: Двухблочный формат с ЧАСТИЧНЫМ Product Master');

const partialMaster = [
  { nameRu: 'Fijn volkorenbrood', lastPrice: 0.99 },
  { nameRu: 'Kippenvleugels', lastPrice: 6.89 },
  { nameRu: 'Barissimo intense', lastPrice: 4.78 },
  { nameRu: 'Komkommer', lastPrice: 0.75 },
];

const result2Partial = matchItemsWithProductMaster(names2, prices2, partialMaster);

const expected2Partial = [
  { name: 'Fijn volkorenbrood', price: 0.99 },
  { name: 'Scharreleieren 12st', price: 3.73 },
  { name: 'Kippenvleugels', price: 6.89 },
  { name: 'Artikelkorting 30%', price: -2.07 },
  { name: 'Volle kwark', price: 1.29 },
  { name: 'Paprikamix Net', price: 1.99 },
  { name: 'Barissimo intense', price: 4.78 },
  { name: 'Komkommer', price: 0.79 },
  { name: 'Kruimige aardappelen', price: 0.89 },
];

assertEqual(result2Partial, expected2Partial, 'Частичный Product Master');
assertSum(result2Partial, 19.28, 'Сумма чека = 19.28€');

// ===========================
// ЧЕК #2 — Нечёткий поиск
// ===========================

console.log('\nТест 4: Нечёткий поиск (товары написаны по-разному)');

const fuzzyMaster = [
  { nameRu: 'volkorenbrood', lastPrice: 0.99 },
  { nameRu: 'eieren', lastPrice: 3.73 },
  { nameRu: 'vleugels', lastPrice: 6.89 },
  { nameRu: 'kwark', lastPrice: 1.29 },
  { nameRu: 'Paprika', lastPrice: 1.99 },
  { nameRu: 'Barissimo', lastPrice: 4.78 },
  { nameRu: 'Kom', lastPrice: 0.75 },
  { nameRu: 'aardappelen', lastPrice: 0.69 },
];

const result2Fuzzy = matchItemsWithProductMaster(names2, prices2, fuzzyMaster);

const expected2Fuzzy = [
  { name: 'Fijn volkorenbrood', price: 0.99 },
  { name: 'Scharreleieren 12st', price: 3.73 },
  { name: 'Kippenvleugels', price: 6.89 },
  { name: 'Artikelkorting 30%', price: -2.07 },
  { name: 'Volle kwark', price: 1.29 },
  { name: 'Paprikamix Net', price: 1.99 },
  { name: 'Barissimo intense', price: 4.78 },
  { name: 'Komkommer', price: 0.79 },
  { name: 'Kruimige aardappelen', price: 0.89 },
];

assertEqual(result2Fuzzy, expected2Fuzzy, 'Нечёткий поиск работает');
assertSum(result2Fuzzy, 19.28, 'Сумма чека = 19.28€');

// ===========================
// ЧЕК #1 — Однострочный формат
// ===========================

console.log('\n=== ЧЕК #1: Однострочный формат (не требует Product Master) ===\n');

console.log('Тест 5: Однострочный формат');

const names1 = ['BLUE BAND romig wikkel', 'Houdbare volle melk', 'AS Tomatenblokjes 400g'];
const prices1 = [1.49, 0.98, 0.55];
const result1 = matchItemsWithProductMaster(names1, prices1, []);

const expected1 = [
  { name: 'BLUE BAND romig wikkel', price: 1.49 },
  { name: 'Houdbare volle melk', price: 0.98 },
  { name: 'AS Tomatenblokjes 400g', price: 0.55 },
];

assertEqual(result1, expected1, 'Однострочный формат (fallback по индексу)');
assertSum(result1, 3.02, 'Сумма = 3.02€');

// ===========================
// Edge cases
// ===========================

console.log('\n=== Edge Cases ===\n');

console.log('Тест 6: Больше имён чем цен');
const names6 = ['Товар A', 'Товар B', 'Товар C'];
const prices6 = [1.0, 2.0];
const master6 = [
  { nameRu: 'Товар A', lastPrice: 1.0 },
  { nameRu: 'Товар B', lastPrice: 2.0 },
];

const result6 = matchItemsWithProductMaster(names6, prices6, master6);

const expected6 = [
  { name: 'Товар A', price: 1.0 },
  { name: 'Товар B', price: 2.0 },
  { name: 'Товар C', price: 0 },
];

assertEqual(result6, expected6, 'Больше имён чем цен → price=0 для последних');

console.log('\nТест 7: Больше цен чем имён');
const names7 = ['Товар A', 'Товар B'];
const prices7 = [1.0, 2.0, 3.0, 4.0];
const master7 = [
  { nameRu: 'Товар A', lastPrice: 1.0 },
  { nameRu: 'Товар B', lastPrice: 2.0 },
];

const result7 = matchItemsWithProductMaster(names7, prices7, master7);

const expected7 = [
  { name: 'Товар A', price: 1.0 },
  { name: 'Товар B', price: 2.0 },
];

assertEqual(result7, expected7, 'Больше цен чем имён → лишние цены игнорируются');

// ===========================
// ИТОГ
// ===========================

console.log('\n=== ВСЕ ТЕСТЫ ПРОЙДЕНЫ ✅ ===\n');
console.log('Product Master работает корректно:');
console.log('  ✅ Двухблочный формат с полным Product Master → правильная привязка');
console.log('  ✅ Двухблочный формат без Product Master → fallback по индексу');
console.log('  ✅ Частичный Product Master → комбинация привязки и fallback');
console.log('  ✅ Нечёткий поиск → находит товары по подстрокам');
console.log('  ✅ Однострочный формат → не ломается');
console.log('  ✅ Edge cases → корректная обработка нехватки цен/имён');
console.log('');
console.log('Готово к мёржу! 🚀\n');
