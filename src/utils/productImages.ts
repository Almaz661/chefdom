/**
 * productImages.ts — Kitchen Atelier Category Image System
 *
 * Архитектура: Category → Image (не Product → Image)
 * 16 категорий + 1 universal fallback = 17 изображений.
 * Покрытие: 100% продуктов. Emoji fallback удалён навсегда.
 *
 * Каждое изображение — полноценная Kitchen Atelier сцена категории,
 * а не отдельный продукт и не иконка.
 *
 * Приоритет:
 * 1. Keyword match (название продукта содержит ключевое слово категории)
 * 2. Category param (если передана категория из БД)
 * 3. Universal fallback (kitchen.webp)
 */

const BASE = '/images/ingredients';

type CategoryDef = {
  id: string;
  keywords: string[];
};

/**
 * Порядок важен: более специфичные категории идут первыми.
 * «зелень» ДО «овощи» (шпинат = зелень, не овощ в контексте визуала).
 * «замороженное» ДО «мясо/ягоды» (замороженная курица = frozen, не meat).
 * «соусы» ДО «масла» (кетчуп = соус, не масло).
 */
const CATEGORIES: CategoryDef[] = [
  // --- Специфичные (проверяются первыми) ---
  {
    id: 'frozen',
    keywords: [
      'замороженн', 'заморож', 'мороженое', 'заморозк',
      'frozen', 'ice cream', 'bevroren',
    ],
  },
  {
    id: 'preserves',
    keywords: [
      'варенье', 'джем', 'компот домашн', 'консерв', 'маринован',
      'солён', 'солен', 'квашен', 'мочён', 'тушён', 'тушенк',
      'заготовк', 'закатк',
      'jam', 'preserve', 'pickle', 'canned',
    ],
  },
  {
    id: 'sauces',
    keywords: [
      'соус', 'кетчуп', 'майонез', 'горчиц', 'уксус', 'заправк',
      'маринад', 'песто', 'аджик', 'ткемали', 'табаско', 'васаби',
      'сальса', 'тартар', 'бешамель',
      'sauce', 'ketchup', 'mayonnaise', 'mustard', 'vinegar', 'pesto',
    ],
  },
  {
    id: 'sweets',
    keywords: [
      'шоколад', 'конфет', 'торт', 'пирожн', 'вафл',
      'зефир', 'мармелад', 'халва', 'пастил', 'ирис',
      'chocolate', 'candy', 'cake', 'sweet',
    ],
  },
  {
    id: 'bakery',
    keywords: [
      'хлеб', 'булк', 'батон', 'лаваш', 'пирог', 'кулич', 'кекс',
      'круассан', 'багет', 'лепёшк', 'лепешк', 'сдоб', 'печень',
      'пончик', 'маффин', 'блин', 'оладь', 'сырник',
      'bread', 'baguette', 'croissant', 'pastry', 'muffin', 'pancake',
    ],
  },

  // --- Зелень ДО овощей ---
  {
    id: 'greens',
    keywords: [
      'укроп', 'петрушк', 'кинза', 'кориандр', 'базилик', 'мята',
      'зелёный лук', 'зеленый лук', 'салат', 'руккол', 'шпинат',
      'щавель', 'зелен',
      'dill', 'parsley', 'basil', 'mint', 'cilantro', 'lettuce',
      'spinach', 'arugula',
    ],
  },

  // --- Основные категории ---
  {
    id: 'dairy',
    keywords: [
      'молок', 'кефир', 'йогурт', 'сметан', 'творог', 'сливк',
      'сыр', 'масло сливочн', 'сливочное масло', 'яйц',
      'ряженк', 'простокваш', 'тан', 'айран',
      'butter', 'milk', 'cheese', 'egg', 'yogurt', 'cream',
      'feta', 'mozzarella', 'kefir', 'kaas', 'eieren', 'melk',
    ],
  },
  {
    id: 'meat',
    keywords: [
      'куриц', 'курин', 'говяд', 'свинин', 'фарш', 'бекон',
      'сосиск', 'колбас', 'индейк', 'баранин', 'ягнятин',
      'стейк', 'мясо', 'ветчин', 'шашлык', 'рёбр', 'ребр',
      'грудинк', 'вырезк', 'антрекот', 'котлет',
      'chicken', 'beef', 'pork', 'meat', 'bacon', 'sausage',
      'turkey', 'lamb', 'kip', 'vlees', 'gehakt',
    ],
  },
  {
    id: 'fish',
    keywords: [
      'лосос', 'сёмга', 'семга', 'форел', 'тунец', 'треска',
      'скумбри', 'сельд', 'креветк', 'кальмар', 'рыб', 'мидии',
      'устриц', 'краб', 'окун', 'судак', 'щук', 'карп', 'минтай',
      'salmon', 'fish', 'tuna', 'cod', 'shrimp', 'squid', 'trout',
      'vis', 'garnaal', 'zalm',
    ],
  },
  {
    id: 'nuts',
    keywords: [
      'орех', 'миндал', 'фундук', 'кешью', 'арахис', 'фисташк',
      'изюм', 'курага', 'чернослив', 'финик', 'семечк', 'семена',
      'кунжут', 'лён', 'лен', 'чиа',
      'walnut', 'almond', 'hazelnut', 'raisin', 'nut', 'seed',
      'cashew', 'pistachio',
    ],
  },
  {
    id: 'spices',
    keywords: [
      'соль', 'сахар', 'перец', 'куркум', 'корица', 'специ',
      'приправ', 'паприк', 'имбир', 'ваниль', 'лавров', 'гвоздик',
      'мускат', 'тмин', 'кардамон', 'анис', 'шафран', 'хмели',
      'salt', 'sugar', 'pepper', 'spice', 'cinnamon', 'turmeric',
      'ginger', 'zout', 'suiker', 'peper',
    ],
  },
  {
    id: 'oils',
    keywords: [
      'масло оливк', 'масло подсолн', 'масло растит', 'масло кокос',
      'масло кунжут', 'масло льнян', 'мёд', 'мед', 'сироп',
      'olive oil', 'oil', 'honey', 'olie', 'honing',
    ],
  },
  {
    id: 'beverages',
    keywords: [
      'вода', 'чай', 'кофе', 'сок', 'компот', 'какао', 'лимонад',
      'смузи', 'вино', 'пиво', 'морс', 'кисель', 'квас',
      'water', 'tea', 'coffee', 'juice',
      'thee', 'koffie', 'sap', 'water',
    ],
  },
  {
    id: 'grains',
    keywords: [
      'рис', 'гречк', 'овсянк', 'макарон', 'спагетти', 'паст',
      'лапш', 'мука', 'крупа', 'каша', 'булгур', 'кускус', 'киноа',
      'перлов', 'манк', 'пшен', 'ячнев',
      'rice', 'pasta', 'flour', 'oat', 'buckwheat', 'spaghetti',
      'rijst', 'meel',
    ],
  },
  {
    id: 'fruits',
    keywords: [
      'яблок', 'банан', 'апельсин', 'лимон', 'груш', 'персик',
      'слив', 'виноград', 'клубник', 'малин', 'черник', 'вишн',
      'черешн', 'манго', 'ананас', 'киви', 'авокадо', 'арбуз',
      'дын', 'гранат', 'хурма', 'инжир', 'ягод', 'смородин',
      'крыжовник', 'облепих', 'брусник', 'клюкв',
      'apple', 'banana', 'orange', 'lemon', 'grape', 'strawberry',
      'mango', 'kiwi', 'avocado', 'cherry', 'peach', 'pear',
    ],
  },
  {
    id: 'vegetables',
    keywords: [
      'помидор', 'томат', 'огурец', 'перец болгар', 'морков',
      'картофел', 'картошк', 'лук', 'чеснок', 'капуст', 'брокколи',
      'цветная', 'баклажан', 'кабачок', 'спарж', 'кукуруз',
      'свёкл', 'свекол', 'тыкв', 'бата', 'редис', 'редьк',
      'сельдерей', 'горох', 'фасол', 'чечевиц', 'нут', 'гриб',
      'шампиньон', 'вешенк', 'репа', 'топинамбур',
      'tomato', 'cucumber', 'carrot', 'potato', 'onion', 'garlic',
      'cabbage', 'broccoli', 'eggplant', 'zucchini', 'corn',
      'pumpkin', 'mushroom', 'bean', 'lentil', 'peas',
      'aardappel', 'ui', 'wortel', 'tomaat', 'komkommer',
    ],
  },
];

/**
 * Возвращает путь к изображению категории для продукта.
 * ВСЕГДА возвращает string — emoji fallback больше не существует.
 *
 * @param productName — название продукта (из inventory/shopping)
 * @param category — категория из БД (необязательно, для fallback)
 */
export function getProductImageSrc(
  productName: string,
  category?: string | null,
): string {
  const lower = productName.toLowerCase();

  // 1. Keyword match — ищем категорию по ключевым словам в названии
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (lower.includes(kw)) {
        return `${BASE}/${cat.id}.webp`;
      }
    }
  }

  // 2. Category param fallback — если есть поле category из БД
  if (category) {
    const catLower = category.toLowerCase();
    // Проверяем по id категорий
    for (const cat of CATEGORIES) {
      if (catLower.includes(cat.id)) return `${BASE}/${cat.id}.webp`;
    }
    // Русские названия категорий
    if (catLower.includes('молоч') || catLower.includes('dairy')) return `${BASE}/dairy.webp`;
    if (catLower.includes('мяс') || catLower.includes('meat')) return `${BASE}/meat.webp`;
    if (catLower.includes('рыб') || catLower.includes('fish')) return `${BASE}/fish.webp`;
    if (catLower.includes('овощ') || catLower.includes('veget')) return `${BASE}/vegetables.webp`;
    if (catLower.includes('фрукт') || catLower.includes('ягод')) return `${BASE}/fruits.webp`;
    if (catLower.includes('зелен') || catLower.includes('green')) return `${BASE}/greens.webp`;
    if (catLower.includes('круп') || catLower.includes('зерн')) return `${BASE}/grains.webp`;
    if (catLower.includes('спец')) return `${BASE}/spices.webp`;
    if (catLower.includes('напит') || catLower.includes('bever')) return `${BASE}/beverages.webp`;
    if (catLower.includes('орех') || catLower.includes('nut')) return `${BASE}/nuts.webp`;
    if (catLower.includes('замор') || catLower.includes('frozen')) return `${BASE}/frozen.webp`;
    if (catLower.includes('загот') || catLower.includes('conserv')) return `${BASE}/preserves.webp`;
    if (catLower.includes('выпеч') || catLower.includes('хлеб')) return `${BASE}/bakery.webp`;
    if (catLower.includes('сладк') || catLower.includes('sweet')) return `${BASE}/sweets.webp`;
    if (catLower.includes('соус') || catLower.includes('sauce')) return `${BASE}/sauces.webp`;
    if (catLower.includes('масл') || catLower.includes('oil')) return `${BASE}/oils.webp`;
  }

  // 3. Universal fallback — Kitchen Atelier atmosphere
  return `${BASE}/kitchen.webp`;
}
