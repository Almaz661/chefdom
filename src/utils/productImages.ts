type ImageEntry = { keywords: string[]; src: string };

const IMAGE_MAP: ImageEntry[] = [
  // Молочные
  { keywords: ["молоко", "молок", "milk", "mleko", "melk", "volle melk"], src: "/images/products/dairy/milk.webp" },
  { keywords: ["кефир", "kefir"], src: "/images/products/dairy/kefir.webp" },
  { keywords: ["йогурт", "yogurt", "jogurt"], src: "/images/products/dairy/yogurt.webp" },
  { keywords: ["сметан", "sour cream"], src: "/images/products/dairy/sour-cream.webp" },
  { keywords: ["творог", "cottage", "kwark", "twaróg"], src: "/images/products/dairy/cottage-cheese.webp" },
  { keywords: ["сливки", "cream", "slagroom"], src: "/images/products/dairy/cream.webp" },
  { keywords: ["масло сливочн", "сливочное масло", "butter", "masło", "boter"], src: "/images/products/dairy/butter.webp" },
  { keywords: ["яйц", "яйцо", "egg", "jajka", "eieren"], src: "/images/products/dairy/eggs.webp" },
  { keywords: ["моцарелл", "mozzarella"], src: "/images/products/dairy/mozzarella.webp" },
  { keywords: ["фета", "feta"], src: "/images/products/dairy/feta.webp" },
  { keywords: ["сыр", "cheese", "ser", "kaas"], src: "/images/products/dairy/cheese.webp" },

  // Мясо
  { keywords: ["куриная грудка", "грудка куриная", "chicken breast", "kipfilet"], src: "/images/products/meat/chicken-breast.webp" },
  { keywords: ["куриное бедро", "бедро куриное", "chicken thigh", "kippendij"], src: "/images/products/meat/chicken-thigh.webp" },
  { keywords: ["куриные крыл", "chicken wing", "kipvleugel"], src: "/images/products/meat/chicken-wings.webp" },
  { keywords: ["куриное филе", "филе куриное", "chicken fillet"], src: "/images/products/meat/chicken-breast.webp" },
  { keywords: ["куриное", "куриной", "куриных", "куриц", "курин", "курятина", "chicken", "kip"], src: "/images/products/meat/chicken-breast.webp" },
  { keywords: ["говяжий фарш", "фарш говяжий", "beef mince"], src: "/images/products/meat/beef-mince.webp" },
  { keywords: ["стейк", "beef steak", "biefstuk"], src: "/images/products/meat/beef-steak.webp" },
  { keywords: ["говядин", "beef", "rund"], src: "/images/products/meat/beef-steak.webp" },
  { keywords: ["фарш", "ground meat", "mince", "gehakt", "mielony"], src: "/images/products/meat/ground-meat.webp" },
  { keywords: ["свинин", "pork", "wieprzow", "varken"], src: "/images/products/meat/pork-loin.webp" },
  { keywords: ["бекон", "bacon", "spek", "boczek"], src: "/images/products/meat/bacon.webp" },
  { keywords: ["сосиск", "колбас", "sausage", "kiełbasa", "worst"], src: "/images/products/meat/sausage.webp" },
  { keywords: ["индейк", "turkey", "kalkoen", "indyk"], src: "/images/products/meat/turkey.webp" },
  { keywords: ["баранин", "ягнятин", "lamb", "lamsvlees"], src: "/images/products/meat/lamb.webp" },

  // Рыба
  { keywords: ["лосось", "сёмга", "семга", "salmon", "łosoś", "zalm"], src: "/images/products/fish/salmon.webp" },
  { keywords: ["форель", "trout", "pstrąg", "forel"], src: "/images/products/fish/trout.webp" },
  { keywords: ["тунец", "tuna", "tonijn"], src: "/images/products/fish/tuna.webp" },
  { keywords: ["треска", "cod", "dorsz", "kabeljauw"], src: "/images/products/fish/cod.webp" },
  { keywords: ["скумбри", "mackerel", "makreel"], src: "/images/products/fish/mackerel.webp" },
  { keywords: ["сельдь", "селёдк", "herring", "śledź", "haring"], src: "/images/products/fish/herring.webp" },
  { keywords: ["креветк", "shrimp", "prawn", "garnalen", "krewetki"], src: "/images/products/fish/shrimp.webp" },
  { keywords: ["кальмар", "squid", "inktvis"], src: "/images/products/fish/squid.webp" },

  // Овощи
  { keywords: ["помидор", "томат", "tomato", "pomidor", "tomaat"], src: "/images/products/vegetables/tomato.webp" },
  { keywords: ["огурец", "огурц", "cucumber", "ogorek", "komkommer"], src: "/images/products/vegetables/cucumber.webp" },
  { keywords: ["перец болгарский", "болгарский перец", "bell pepper", "papryka", "paprika"], src: "/images/products/vegetables/bell-pepper.webp" },
  { keywords: ["морков", "carrot", "marchew", "wortel"], src: "/images/products/vegetables/carrot.webp" },
  { keywords: ["картофел", "картошк", "картоф", "potato", "ziemniak", "aardappel"], src: "/images/products/vegetables/potato.webp" },
  { keywords: ["лук репчатый", "репчатый лук", "лук", "onion", "cebula", "ui", "cebul"], src: "/images/products/vegetables/onion.webp" },
  { keywords: ["чеснок", "garlic", "czosnek", "knoflook"], src: "/images/products/vegetables/garlic.webp" },
  { keywords: ["капуст", "cabbage", "kapusta", "kool"], src: "/images/products/vegetables/cabbage.webp" },
  { keywords: ["брокколи", "broccoli"], src: "/images/products/vegetables/broccoli.webp" },
  { keywords: ["цветная капуста", "cauliflower", "kalafior", "bloemkool"], src: "/images/products/vegetables/cauliflower.webp" },
  { keywords: ["баклажан", "eggplant", "aubergine", "bakłażan"], src: "/images/products/vegetables/eggplant.webp" },
  { keywords: ["кабачок", "zucchini", "courgette", "cukinia"], src: "/images/products/vegetables/zucchini.webp" },
  { keywords: ["шпинат", "spinach", "szpinak"], src: "/images/products/vegetables/spinach.webp" },
  { keywords: ["спаржа", "asparagus", "szparag"], src: "/images/products/vegetables/asparagus.webp" },
  { keywords: ["гриб", "mushroom", "grzyby", "paddenstoel"], src: "/images/products/vegetables/mushroom.webp" },
  { keywords: ["горошек", "peas", "groszek", "doperwten"], src: "/images/products/vegetables/peas.webp" },
  { keywords: ["кукуруз", "corn", "kukurydza", "maïs"], src: "/images/products/vegetables/corn.webp" },
  { keywords: ["свёкл", "свекол", "beet", "burak", "biet"], src: "/images/products/vegetables/beet.webp" },
  { keywords: ["тыкв", "pumpkin", "dynia", "pompoen"], src: "/images/products/vegetables/pumpkin.webp" },
  { keywords: ["батат", "sweet potato", "zoete aardappel"], src: "/images/products/vegetables/sweet-potato.webp" },

  // Фрукты
  { keywords: ["яблок", "apple", "jabłko", "appel"], src: "/images/products/fruits/apple.webp" },
  { keywords: ["банан", "banana"], src: "/images/products/fruits/banana.webp" },
  { keywords: ["апельсин", "orange", "pomarańcza", "sinaasappel"], src: "/images/products/fruits/orange.webp" },
  { keywords: ["лимон", "lemon", "cytryna", "citroen"], src: "/images/products/fruits/lemon.webp" },
  { keywords: ["груш", "pear", "gruszka", "peer"], src: "/images/products/fruits/pear.webp" },
  { keywords: ["персик", "peach", "brzoskwinia", "perzik"], src: "/images/products/fruits/peach.webp" },
  { keywords: ["слив", "plum", "śliwka", "pruim"], src: "/images/products/fruits/plum.webp" },
  { keywords: ["виноград", "grape", "winogrono", "druif"], src: "/images/products/fruits/grape.webp" },
  { keywords: ["клубник", "земляник", "strawberry", "truskawka", "aardbei"], src: "/images/products/fruits/strawberry.webp" },
  { keywords: ["малин", "raspberry", "malina", "framboos"], src: "/images/products/fruits/raspberry.webp" },
  { keywords: ["черник", "blueberry", "borówka", "bosbes"], src: "/images/products/fruits/blueberry.webp" },
  { keywords: ["вишн", "черешн", "cherry", "wiśnia", "kers"], src: "/images/products/fruits/cherry.webp" },
  { keywords: ["манго", "mango"], src: "/images/products/fruits/mango.webp" },
  { keywords: ["ананас", "pineapple", "ananas"], src: "/images/products/fruits/pineapple.webp" },
  { keywords: ["киви", "kiwi"], src: "/images/products/fruits/kiwi.webp" },
  { keywords: ["авокадо", "avocado"], src: "/images/products/fruits/avocado.webp" },
  { keywords: ["арбуз", "watermelon", "arbuz", "watermeloen"], src: "/images/products/fruits/watermelon.webp" },

  // Зелень
  { keywords: ["укроп", "dill", "koper", "dille"], src: "/images/products/greens/dill.webp" },
  { keywords: ["петрушк", "parsley", "pietruszka", "peterselie"], src: "/images/products/greens/parsley.webp" },
  { keywords: ["кинза", "кориандр", "cilantro", "coriander", "kolendra"], src: "/images/products/greens/cilantro.webp" },
  { keywords: ["базилик", "basil", "bazylia", "basilicum"], src: "/images/products/greens/basil.webp" },
  { keywords: ["мята", "mint", "mięta", "munt"], src: "/images/products/greens/mint.webp" },
  { keywords: ["зелёный лук", "зеленый лук", "green onion", "szczypiorek", "bosui"], src: "/images/products/greens/green-onion.webp" },
  { keywords: ["салат листовой", "салат", "lettuce", "sałata", "sla"], src: "/images/products/greens/lettuce.webp" },

  // Крупы и хлеб
  { keywords: ["рис", "rice", "ryż", "rijst"], src: "/images/products/grains/rice.webp" },
  { keywords: ["гречк", "buckwheat", "kasza gryczana", "boekweit"], src: "/images/products/grains/buckwheat.webp" },
  { keywords: ["овсянк", "геркулес", "oatmeal", "oat", "havermout"], src: "/images/products/grains/oatmeal.webp" },
  { keywords: ["спагетти", "spaghetti"], src: "/images/products/grains/spaghetti.webp" },
  { keywords: ["паст", "макарон", "pasta", "makaron"], src: "/images/products/grains/pasta.webp" },
  { keywords: ["мука", "flour", "mąka", "meel"], src: "/images/products/grains/flour.webp" },
  { keywords: ["хлеб", "батон", "bread", "chleb", "brood"], src: "/images/products/grains/bread.webp" },
  { keywords: ["фасол", "beans", "fasola", "bonen"], src: "/images/products/grains/beans.webp" },
  { keywords: ["чечевиц", "lentil", "soczewica", "linzen"], src: "/images/products/grains/lentils.webp" },
  { keywords: ["нут", "chickpea", "ciecierzyca", "kikkererwten"], src: "/images/products/grains/chickpeas.webp" },

  // Масла и соусы
  { keywords: ["оливковое масло", "olive oil", "olijfolie"], src: "/images/products/oils/olive-oil.webp" },
  { keywords: ["подсолнечное масло", "sunflower oil", "zonnebloemolie"], src: "/images/products/oils/sunflower-oil.webp" },
  { keywords: ["майонез", "mayonnaise", "majonez"], src: "/images/products/oils/mayonnaise.webp" },
  { keywords: ["кетчуп", "ketchup", "keczup"], src: "/images/products/oils/ketchup.webp" },
  { keywords: ["горчица", "mustard", "musztarda", "mosterd"], src: "/images/products/oils/mustard.webp" },
  { keywords: ["мёд", "мед", "honey", "miód", "honing"], src: "/images/products/oils/honey.webp" },

  // Специи
  { keywords: ["соль", "salt", "sól", "zout"], src: "/images/products/spices/salt.webp" },
  { keywords: ["сахар", "sugar", "cukier", "suiker"], src: "/images/products/spices/sugar.webp" },
  { keywords: ["перец чёрн", "черный перец", "black pepper", "pieprz", "zwarte peper"], src: "/images/products/spices/black-pepper.webp" },
  { keywords: ["куркум", "turmeric", "kurkuma"], src: "/images/products/spices/turmeric.webp" },
  { keywords: ["корица", "cinnamon", "cynamon", "kaneel"], src: "/images/products/spices/cinnamon.webp" },

  // Напитки
  { keywords: ["вода", "water", "woda", "mineraal"], src: "/images/products/beverages/water.webp" },
  { keywords: ["кофе", "coffee", "kawa", "koffie"], src: "/images/products/beverages/coffee.webp" },
  { keywords: ["чай", "tea", "herbata", "thee"], src: "/images/products/beverages/tea.webp" },
  { keywords: ["сок", "juice", "sok", "sap"], src: "/images/products/beverages/juice.webp" },

  // Орехи
  { keywords: ["грецкий орех", "walnut", "orzech włoski", "walnoot"], src: "/images/products/nuts/walnut.webp" },
  { keywords: ["миндал", "almond", "migdał", "amandel"], src: "/images/products/nuts/almond.webp" },
  { keywords: ["фундук", "hazelnut", "orzech laskowy", "hazelnoot"], src: "/images/products/nuts/hazelnut.webp" },
  { keywords: ["изюм", "raisin", "rodzynki", "rozijnen"], src: "/images/products/nuts/raisins.webp" },

  // Заморозка
  { keywords: ["замороженные ягоды", "frozen berries", "mrożone owoce"], src: "/images/products/frozen/frozen-berries.webp" },
  { keywords: ["пельмени", "вареники", "dumpling", "pierogi"], src: "/images/products/frozen/dumplings.webp" },
  { keywords: ["мороженое", "ice cream", "lody", "ijs"], src: "/images/products/frozen/ice-cream.webp" },

  // Сладкое
  { keywords: ["шоколад", "chocolate", "czekolada", "chocolade"], src: "/images/products/sweets/chocolate.webp" },
];

export function getProductImageSrc(productName: string): string | null {
  const lower = productName.toLowerCase();
  for (const entry of IMAGE_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) return entry.src;
    }
  }
  return null;
}
