/**
 * Product Image Utility
 *
 * Использование в компонентах:
 *   import { getProductImageUrl } from '../utils/productImages';
 *   const src = getProductImageUrl(item.productName);
 */

// Словарь: ключевые слова → путь к файлу
// Порядок важен: более специфичные совпадения первыми
const IMAGE_MAP: [string[], string][] = [
  // Vegetables
  [["картошк", "картофел", "картош", "potato", "ziemniak", "aardappel"], "vegetables/potato"],
  [["морков", "carrot", "marchew", "wortel"], "vegetables/carrot"],
  [["лук репч", "лук", "onion", "cebula", "ui"], "vegetables/onion"],
  [["чеснок", "garlic", "czosnek", "knoflook"], "vegetables/garlic"],
  [["помидор", "томат", "tomato", "pomidor", "tomaat"], "vegetables/tomato"],
  [["огурц", "cucumber", "ogorek", "komkommer"], "vegetables/cucumber"],
  [["брокколи", "broccoli"], "vegetables/broccoli"],
  [["капуст", "cabbage", "kapusta", "kool"], "vegetables/cabbage"],
  [["цветн кап", "cauliflower", "kalafior", "bloemkool"], "vegetables/cauliflower"],
  [["перец болг", "bell pepper", "papryka", "paprika"], "vegetables/bell-pepper"],
  [["кабачк", "zucchini", "cukinia", "courgette"], "vegetables/zucchini"],
  [["баклажан", "eggplant", "aubergine", "bakłażan"], "vegetables/eggplant"],
  [["свёкл", "свекл", "beetroot", "burak", "biet"], "vegetables/beet"],
  [["шпинат", "spinach", "szpinak"], "vegetables/spinach"],
  [["сельдер", "celery", "seler", "selderij"], "vegetables/celery"],
  [["порей", "leek", "por", "prei"], "vegetables/leek"],
  [["редис", "редьк", "radish", "rzodkiewka", "radijs"], "vegetables/radish"],
  [["тыкв", "pumpkin", "dynia", "pompoen"], "vegetables/pumpkin"],
  [["кукуруз", "corn", "kukurydza", "maïs"], "vegetables/corn"],
  [["гриб", "mushroom", "grzyby", "paddenstoel"], "vegetables/mushroom"],
  [["спаржа", "asparagus", "szparag"], "vegetables/asparagus"],
  [["батат", "sweet potato", "batat"], "vegetables/sweet-potato"],
  [["горошек зел", "зелён горош", "green peas", "groszek"], "vegetables/peas"],
  [["стручк фасол", "green beans", "sperziebonen"], "vegetables/green-beans"],

  // Fruits
  [["яблок", "apple", "jabłko", "appel"], "fruits/apple"],
  [["банан", "banana"], "fruits/banana"],
  [["апельсин", "orange", "pomarańcza", "sinaasappel"], "fruits/orange"],
  [["лимон", "lemon", "cytryna", "citroen"], "fruits/lemon"],
  [["лайм", "lime", "limonka"], "fruits/lime"],
  [["виноград", "grape", "winogrono", "druif"], "fruits/grape"],
  [["клубник", "strawberry", "truskawka", "aardbei"], "fruits/strawberry"],
  [["малин", "raspberry", "malina", "framboos"], "fruits/raspberry"],
  [["черник", "голубик", "blueberry", "borówka", "bosbes"], "fruits/blueberry"],
  [["вишн", "черешн", "cherry", "wiśnia", "kers"], "fruits/cherry"],
  [["персик", "peach", "brzoskwinia", "perzik"], "fruits/peach"],
  [["груш", "pear", "gruszka", "peer"], "fruits/pear"],
  [["слив", "plum", "śliwka", "pruim"], "fruits/plum"],
  [["манго", "mango"], "fruits/mango"],
  [["ананас", "pineapple", "ananas"], "fruits/pineapple"],
  [["арбуз", "watermelon", "arbuz", "watermeloen"], "fruits/watermelon"],
  [["дын", "melon"], "fruits/melon"],
  [["киви", "kiwi"], "fruits/kiwi"],
  [["авокадо", "avocado"], "fruits/avocado"],
  [["гранат", "pomegranate", "granat"], "fruits/pomegranate"],
  [["инжир", "fig", "figa", "vijg"], "fruits/fig"],
  [["абрикос", "apricot", "morela", "abrikoos"], "fruits/apricot"],
  [["мандарин", "tangerine", "mandarynka", "mandarijn"], "fruits/tangerine"],
  [["грейпфрут", "grapefruit"], "fruits/grapefruit"],

  // Meat
  [["куриное филе", "грудка куриц", "chicken breast", "kipfilet"], "meat/chicken-breast"],
  [["куриц", "курин", "куриное", "kip", "chicken"], "meat/chicken-whole"],
  [["куриные крыл", "chicken wings", "kipvleugels"], "meat/chicken-wings"],
  [["голени куриц", "drumstick", "kipdrumstick"], "meat/chicken-drumstick"],
  [["куриные бёдр", "chicken thigh", "kippendij"], "meat/chicken-thigh"],
  [["говядина стейк", "beef steak", "biefstuk"], "meat/beef-steak"],
  [["фарш говяжий", "beef mince", "gehakt rund"], "meat/beef-mince"],
  [["свинина вырезк", "pork loin", "varkenshaas"], "meat/pork-loin"],
  [["свиные рёбр", "pork ribs", "varkensribbetjes"], "meat/pork-ribs"],
  [["фарш", "minced meat", "mięso mielone", "gehakt"], "meat/ground-meat"],
  [["баранин", "ягнят", "lamb", "lamsvlees"], "meat/lamb"],
  [["индейк", "turkey", "indyk", "kalkoen"], "meat/turkey"],
  [["утк", "duck", "kaczka", "eend"], "meat/duck"],
  [["телятин", "veal", "cielęcina", "kalfsvlees"], "meat/veal"],
  [["кролик", "rabbit", "królik", "konijn"], "meat/rabbit"],
  [["колбас", "сосиск", "sausage", "kiełbasa", "worst"], "meat/sausage"],
  [["бекон", "bacon", "boczek", "spek"], "meat/bacon"],
  [["ветчин", "ham", "szynka"], "meat/ham"],
  [["печень", "liver", "wątroba", "lever"], "meat/liver"],

  // Fish
  [["лосось", "сёмга", "семга", "salmon", "łosoś", "zalm"], "fish/salmon"],
  [["тунец", "tuna", "tuńczyk", "tonijn"], "fish/tuna"],
  [["треска", "cod", "dorsz", "kabeljauw"], "fish/cod"],
  [["сельдь", "селёдк", "herring", "śledź", "haring"], "fish/herring"],
  [["скумбрия", "mackerel", "makrela", "makreel"], "fish/mackerel"],
  [["форель", "trout", "pstrąg", "forel"], "fish/trout"],
  [["креветк", "shrimp", "krewetki", "garnalen"], "fish/shrimp"],
  [["кальмар", "squid", "kałamarnica", "inktvis"], "fish/squid"],
  [["мидии", "mussels", "małże", "mosselen"], "fish/mussels"],
  [["минтай", "pollock", "mintaj"], "fish/pollock"],
  [["щука", "судак", "pike", "snoek"], "fish/pike"],
  [["карп", "carp", "karp", "karper"], "fish/carp"],
  [["краб", "crab", "krab"], "fish/crab"],
  [["осьминог", "octopus"], "fish/octopus"],

  // Dairy
  [["молоко", "молок", "milk", "mleko", "melk"], "dairy/milk"],
  [["яйц", "яйцо", "eggs", "jajka", "eieren"], "dairy/eggs"],
  [["масло сливочн", "butter", "masło", "boter"], "dairy/butter"],
  [["творог", "cottage cheese", "twaróg", "kwark"], "dairy/cottage-cheese"],
  [["сметан", "sour cream", "śmietana", "zure room"], "dairy/sour-cream"],
  [["йогурт", "yogurt", "jogurt", "yoghurt"], "dairy/yogurt"],
  [["кефир", "kefir"], "dairy/kefir"],
  [["сливк", "cream", "śmietanka", "slagroom"], "dairy/cream"],
  [["сгущён", "сгущенк", "condensed milk"], "dairy/milk-condensed"],
  [["ряженк"], "dairy/ryazhenka"],
  [["чеддер", "cheddar"], "dairy/cheddar"],
  [["моцарелл", "mozzarella"], "dairy/mozzarella"],
  [["пармезан", "parmesan"], "dairy/parmesan"],
  [["фета", "feta"], "dairy/feta"],
  [["сливочный сыр", "cream cheese"], "dairy/cream-cheese"],
  [["сыр", "cheese", "ser", "kaas"], "dairy/cheese"],
  [["маргарин", "margarine"], "dairy/margarine"],

  // Grains
  [["рис", "rice", "ryż", "rijst"], "grains/rice"],
  [["гречк", "buckwheat", "kasza gryczana", "boekweit"], "grains/buckwheat"],
  [["овсянк", "геркулес", "oatmeal", "havermout"], "grains/oatmeal"],
  [["спагетт", "spaghetti"], "grains/spaghetti"],
  [["макарон", "pasta", "makaron"], "grains/pasta"],
  [["мук", "flour", "mąka", "meel"], "grains/flour"],
  [["манк", "semolina", "griesmeel"], "grains/semolina"],
  [["пшено", "millet", "gierst"], "grains/millet"],
  [["перловк", "barley", "gerst"], "grains/barley"],
  [["булгур", "bulgur"], "grains/bulgur"],
  [["кускус", "couscous"], "grains/couscous"],
  [["киноа", "quinoa"], "grains/quinoa"],
  [["чечевиц", "lentils", "soczewica", "linzen"], "grains/lentils"],
  [["нут", "chickpeas", "ciecierzyca", "kikkererwten"], "grains/chickpeas"],
  [["фасол", "beans", "fasola", "bonen"], "grains/beans"],
  [["горох суш", "dried peas", "groch"], "grains/peas-dry"],
  [["хлеб", "батон", "bread", "chleb", "brood"], "grains/bread"],
  [["крахмал", "starch", "skrobia"], "grains/starch"],

  // Oils & Condiments
  [["масло подсолнечн", "sunflower oil", "zonnebloemolie"], "oils/sunflower-oil"],
  [["масло оливков", "olive oil", "olijfolie"], "oils/olive-oil"],
  [["уксус", "vinegar", "ocet", "azijn"], "oils/vinegar"],
  [["соевый соус", "soy sauce", "sojasaus"], "oils/soy-sauce"],
  [["кетчуп", "ketchup"], "oils/ketchup"],
  [["майонез", "mayonnaise", "majonez"], "oils/mayonnaise"],
  [["горчиц", "mustard", "musztarda", "mosterd"], "oils/mustard"],
  [["мёд", "мед", "honey", "miód", "honing"], "oils/honey"],
  [["варенье", "джем", "jam", "dżem"], "oils/jam"],

  // Spices
  [["соль", "salt", "sól", "zout"], "spices/salt"],
  [["сахар", "sugar", "cukier", "suiker"], "spices/sugar"],
  [["перец чёрн", "перец черн", "black pepper", "pieprz", "zwarte peper"], "spices/black-pepper"],
  [["паприк", "paprika powder"], "spices/paprika-powder"],
  [["корица", "cinnamon", "cynamon", "kaneel"], "spices/cinnamon"],
  [["куркум", "turmeric", "kurkuma"], "spices/turmeric"],
  [["лавр", "bay leaf", "laurierblad"], "spices/bay-leaf"],
  [["тмин", "зира", "cumin", "komijn"], "spices/cumin"],
  [["ваниль", "vanilla", "vanille"], "spices/vanilla"],
  [["сода", "baking soda", "natrium"], "spices/baking-soda"],
  [["дрожж", "yeast", "drożdże", "gist"], "spices/yeast"],
  [["разрыхлител", "baking powder"], "spices/baking-powder"],

  // Beverages
  [["вода", "water", "woda"], "beverages/water"],
  [["сок", "juice", "sok", "sap"], "beverages/juice"],
  [["чай", "tea", "herbata", "thee"], "beverages/tea"],
  [["кофе", "coffee", "kawa", "koffie"], "beverages/coffee"],
  [["какао", "cocoa", "kakao"], "beverages/cocoa"],

  // Nuts
  [["грецк орех", "walnut", "orzech włoski", "walnoot"], "nuts/walnut"],
  [["миндал", "almond", "migdał", "amandel"], "nuts/almond"],
  [["фундук", "hazelnut", "orzech laskowy", "hazelnoot"], "nuts/hazelnut"],
  [["кешью", "cashew"], "nuts/cashew"],
  [["арахис", "peanut", "pinda"], "nuts/peanut"],
  [["изюм", "raisins", "rodzynki", "rozijnen"], "nuts/raisins"],
  [["курага", "dried apricots", "gedroogde abrikozen"], "nuts/dried-apricot"],
  [["чернослив", "prunes", "pruimen"], "nuts/prunes"],
  [["финик", "dates", "dadels"], "nuts/dates"],

  // Sweets
  [["шоколад", "chocolate", "czekolada", "chocolade"], "sweets/chocolate"],
  [["печень", "cookies", "ciastka", "koekjes"], "sweets/cookies"],
  [["торт", "cake", "tort", "taart"], "sweets/cake"],
  [["вафл", "wafer"], "sweets/wafer"],
  [["конфет", "candy", "cukierki", "snoep"], "sweets/candy"],

  // Frozen
  [["пельмен", "dumplings", "pierogi"], "frozen/dumplings"],
  [["вареник", "vareniki"], "frozen/vareniki"],
  [["замороженные овощи", "frozen vegetables", "mrożone warzywa"], "frozen/frozen-vegetables"],
  [["замороженные ягоды", "frozen berries", "mrożone owoce"], "frozen/frozen-berries"],
  [["мороженое", "ice cream", "lody", "ijs"], "frozen/ice-cream"],
  [["тесто", "pizza dough", "ciasto", "deeg"], "frozen/pizza-dough"],
  [["наггетс", "nuggets"], "frozen/nuggets"],

  // Greens
  [["укроп", "dill", "koper", "dille"], "greens/dill"],
  [["петрушк", "parsley", "pietruszka", "peterselie"], "greens/parsley"],
  [["базилик", "basil", "bazylia", "basilicum"], "greens/basil"],
  [["кинз", "cilantro", "kolendra", "koriander"], "greens/cilantro"],
  [["лук зелён", "green onion", "szczypiorek", "bosui"], "greens/green-onion"],
  [["салат листов", "lettuce", "sałata", "sla"], "greens/lettuce"],
  [["мята", "mint", "mięta", "munt"], "greens/mint"],
  [["тимьян", "чабрец", "thyme", "tijm"], "greens/thyme"],
  [["розмарин", "rosemary"], "greens/rosemary"],
];

const BASE_PATH = '/images/products';

/**
 * Возвращает путь к изображению продукта.
 * Если продукт не найден — возвращает placeholder.
 */
export function getProductImageUrl(productName: string): string {
  const lower = productName.toLowerCase().trim();
  for (const [keywords, key] of IMAGE_MAP) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return `${BASE_PATH}/${key}.webp`;
      }
    }
  }
  return `${BASE_PATH}/placeholder.webp`;
}

/**
 * Проверяет есть ли изображение для продукта.
 */
export function hasProductImage(productName: string): boolean {
  return getProductImageUrl(productName) !== `${BASE_PATH}/placeholder.webp`;
}
