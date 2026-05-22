// Тест парсера на реальных чеках пользователя

const receipt1 = `ALDI	
Oranje Marieplein 9, 6663 RL Lent	
Fijn volkorenbrood	0,99 € B	
Scharreleieren 12st	3,73	€	
Kippenvleugels	6,89	€	B	
Artikelkorting 30%	-2,07	€	
Volle kwark	1,29	€ B	
Paprikamix Net	1,99	€	
2 x 2,39 €	
Barissimo intense	4,78	
Komkommer	0,79	(*)	
Kruimige aardappelen	0,89 €	
SUBTOTAAL	EUR	19,28	
TE BETALEN	19,28	€	
POT: 50278886	
CLIENT TICKET	
Terminal:	BS177876	
Merchant:	3616235501`;

const receipt2 = `ALDI	
Oranje Marieplein 9, 6663 RL Lent	
BLUE BAND romig wikkel	1,49	€	B	
Houdbare volle melk	0,98	
AS Tomatenblokjes 400g	0,55	
Witte kaas blok 250g	1,85	
Griekse stijl yoghurt	2,09	
Fijn volkorenbrood	0,93	
Mini crackers naturel	0	,99	
Scharreleieren 12st	3	,73	
Spaghetti 500g	0,37	
Trio sla, per stuk	1,19	€	
LEVERWORST	
Kippenvleugels	6,89	1,29 €	
Artikelkorting	30%	-2,07	
DV Pangasiusfilet	2,62 € B	
0,558 kg x 2,09 €/kg	
TOMATEN, LOS PER KG	1,17 €	
Chocopasta 750g XZ	2,55	
Komkommer	0	,75	€	
Druiven Rose-Rood	,99	
Kruimige aardappelen	0,69	
TE BETALEN	30,05	€	
POI: 50278985`;

const receipt3 = `Albert Heijn XL	
Hart van de Waalsprong	
Oranje Marieplein, Lent	
AANTAL	OMSCHRIJVING PRIJS BEDRAG	
...-	
1	AH BULGUR	
1,59	
1	SUBTOTAAL	
1,59	
JOUW VOORDEEL	0,00	
waarvan	
BONUS BOX	0,00	
TOTAAL	1,59	
BETAALD MET:	
PINNEN	1,59	
POI: 50308344	CLIENT TICKET	
Terminal	376BW2	Merchant	2110478	
Period	6139	Transaction	02020411	
Token 2003020411816525875	
BTW	OVER	EUR	
9%	1,46	0,13	
TOTAAL	1,46	0,13	
4058	47	96	
18:06	19-05-2026	
Hartelijk dank voor je bezoek`;

console.log('=== Чек #1 (19,28€) ===');
console.log('Ожидается: 9 позиций');
console.log('Сумма: 19,28€');
console.log('\nOCR текст:');
console.log(receipt1);
console.log('\n---\n');

console.log('=== Чек #2 (30,05€) ===');
console.log('Ожидается: ~19 позиций');
console.log('Сумма: 30,05€');
console.log('\nOCR текст:');
console.log(receipt2);
console.log('\n---\n');

console.log('=== Чек #3 AH (1,59€) ===');
console.log('Ожидается: 1 позиция (AH BULGUR)');
console.log('Сумма: 1,59€');
console.log('\nOCR текст:');
console.log(receipt3);
