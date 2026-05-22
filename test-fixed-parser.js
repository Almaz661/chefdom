// Тест исправленного парсера на реальных чеках

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
Hartelijk dank voor je bezoek	
Vacatures:	
www.ahxlwaalsprong.nl`;

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
TE BETALEN	30,05	
POI: 50278886`;

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
TE BETALEN	19,28 €	
POI: 50278886	
CLIENT TICKET	
Terminal:	BS177876`;

console.log('=== ЧЕК #1: AH BULGUR (1,59€) ===');
console.log('Ожидается: 1 позиция');
console.log('OCR:\n' + receipt1.split('\n').slice(0, 15).join('\n') + '\n...\n');

console.log('=== ЧЕК #2: ALDI (30,05€) ===');
console.log('Ожидается: ~19 позиций');
console.log('OCR:\n' + receipt2.split('\n').slice(0, 25).join('\n') + '\n...\n');

console.log('=== ЧЕК #3: ALDI (19,28€) ===');
console.log('Ожидается: 9 позиций');
console.log('OCR:\n' + receipt3.split('\n').slice(0, 15).join('\n') + '\n...\n');
