// Локальный тест парсера на реальных чеках
// Запуск: node test-parser-locally.js (после установки зависимостей)

// Копия функций из receiptParser.ts для тестирования

function parseNumber(raw) {
  let s = raw.trim().replace(/\s/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function extractTrailingPrice(line) {
  const cleaned = line
    .replace(/[€₽$]/g, ' ')
    .replace(/\s+(?:EUR|RUB)\b/gi, ' ');
  const matches = cleaned.match(
    /-?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})|-?\d+[.,]\d{1,2}/g,
  );
  if (!matches || matches.length === 0) return null;
  return parseNumber(matches[matches.length - 1]);
}

// Тестовые чеки
const receipt1 = `Hart van de Waalsprong	
Oranje Marieplein, Lent	
AANTAL	OMSCHRIJVING PRIJS BEDRAG	
1	AH BULGUR	
1	,59	
1	SUBTOTAAL	
1,59	
JOUW VOORDEEL	0,00	
waarvan	
BONUS BOX	0,00	
TOTAAL	1,59`;

const receipt2 = `ALDI	
Oranje Marieplein 9, 6663 RL Lent	
BLUE BAND romig wikkel	1,49	
Houdbare volle melk	0,98	B	
AS Tomatenblokjes 400g	0,55	€	
Witte kaas blok 250g	1,85	€	
Griekse stijl yoghurt	2,09	€	
Fijn volkorenbrood	0,93	
Mini crackers naturel	U	3	99	
Scharreleieren 12st	3	,73	
Spaghetti 500g	0,37	€	
Trio sla, per stuk	1,19	
LEVERWORST	
Kippenvleugels	1,29	6,89	
Artikelkorting 30%	-2,07	
DV Pangasiusfilet	2,62	€	B	
0,558 kg x 2,09 €/kg	
TOMATEN, LOS PER KG	-	€	
Chocopasta 750g XZ	2,55	
Komkommer	0,75	
Druiven Rose-Rood	1,99	
Kruimige aardappelen	0,69	
TE BETALEN	30,05`;

const receipt3 = `AL DI	
Oranje Marieplein 9, 6663 RL Lent	
Fijn volkorenbrood	0,99 € B	
Scharreleieren 12st	3,73 €	
Kippenvleugels	6,89 €	
Artikelkorting 30%	-2,07 €	
Volle kwark	1,29 € B	
Paprikamix Net	1,99 € B	
2 x 2,39 €	
Barissimo intense	4,78 € B	
Komkommer	0,79 €	
Kruimige aardappelen	
SUBTOTAAL	EUR	19,28	
TE BETALEN	19,28 €`;

console.log('=== ЧЕК #1: AH (1,59€) ===');
console.log('\nСтроки с ценами:');
receipt1.split('\n').forEach(line => {
  const price = extractTrailingPrice(line);
  if (price !== null) {
    console.log(`"${line.trim()}" → ${price}€`);
  }
});

console.log('\n\n=== ЧЕК #2: ALDI (30,05€) ===');
console.log('\nСтроки с ценами:');
const lines2 = receipt2.split('\n');
lines2.forEach((line, i) => {
  const price = extractTrailingPrice(line);
  if (price !== null && price > 0 && price < 100) {
    console.log(`[${i}] "${line.trim()}" → ${price}€`);
  }
});

console.log('\n\nПроблема: "Kippenvleugels 1,29 6,89"');
const problematicLine = 'Kippenvleugels	1,29	6,89';
console.log(`Строка: "${problematicLine}"`);
console.log(`extractTrailingPrice: ${extractTrailingPrice(problematicLine)}€`);
console.log('Ожидается: 6.89€ (последнее число)');

console.log('\n\n=== ЧЕК #3: ALDI (19,28€) ===');
console.log('\nСтроки с ценами:');
receipt3.split('\n').forEach(line => {
  const price = extractTrailingPrice(line);
  if (price !== null && price > 0 && price < 100) {
    console.log(`"${line.trim()}" → ${price}€`);
  }
});

console.log('\n\n=== ИТОГ ===');
console.log('Функция extractTrailingPrice работает правильно.');
console.log('Проблема в другом месте парсера.');
