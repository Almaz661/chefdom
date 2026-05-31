/**
 * productImages.ts
 * Сопоставляет название продукта (подстрока, без учёта регистра)
 * с путём к изображению в /images/products/.
 *
 * Используется в InventoryPage для отображения карточек с фото 64×64.
 */

type ImageEntry = { keywords: string[]; src: string };

const IMAGE_MAP: ImageEntry[] = [
  // ── Молочные ──────────────────────────────────────────────
  { keywords: ["молоко", "milk"], src: "/images/products/dairy/milk.webp" },
  { keywords: ["кефир", "kefir"], src: "/images/products/dairy/kefir.webp" },
  { keywords: ["йогурт", "yogurt", "йогурт"], src: "/images/products/dairy/yogurt.webp" },
  { keywords: ["сметана", "sour cream"], src: "/images/products/dairy/sour-cream.webp" },
  { keywords: ["творог", "cottage"], src: "/images/products/dairy/cottage-cheese.webp" },
  { keywords: ["сливки", "cream"], src: "/images/products/dairy/cream.webp" },
  { keywords: ["масло сливочное", "сливочное масло", "butter"], src: "/images/products/dairy/butter.webp" },
  { keywords: ["яйц", "яйко", "egg"], src: "/images/products/dairy/eggs.webp" },
  { keywords: ["сыр моцарелла", "mozzarella"], src: "/images/products/dairy/mozzarella.webp" },
  { keywords: ["фета", "feta"], src: "/images/products/dairy/feta.webp" },
  { keywords: ["сыр", "cheese"], src: "/images/products/dairy/cheese.webp" },

  // ── Мясо ──────────────────────────────────────────────────
  { keywords: ["куриная грудка", "грудка куриная", "chicken breast"], src: "/images/products/meat/chicken-breast.webp" },
  { keywords: ["куриное бедро", "бедро куриное", "chicken thigh"], src: "/images/products/meat/chicken-thigh.webp" },
  { keywords: ["куриные крылья", "крылья", "chicken wing"], src: "/images/products/meat/chicken-wings.webp" },
  { keywords: ["курица целая", "целая курица", "whole chicken"], src: "/images/products/meat/chicken-whole.webp" },
  { keywords: ["куриц", "курятина", "chicken"], src: "/images/products/meat/chicken-breast.webp" },
  { keywords: ["говяжий фарш", "фарш говяжий", "beef mince"], src: "/images/products/meat/beef-mince.webp" },
  { keywords: ["стейк", "beef steak"], src: "/images/products/meat/beef-steak.webp" },
  { keywords: ["говядин", "beef"], src: "/images/products/meat/beef-steak.webp" },
  { keywords: ["фарш", "ground meat", "mince"], src: "/images/products/meat/ground-meat.webp" },
  { keywords: ["свиная вырезка", "корейка", "pork loin"], src: "/images/products/meat/pork-loin.webp" },
  { keywords: ["свинин", "pork"], src: "/images/products/meat/pork-loin.webp" },
  { keywords: ["бекон", "bacon"], src: "/images/products/meat/bacon.webp" },
  { keywords: ["сосиск", "колбас", "сардельк", "sausage"], src: "/images/products/meat/sausage.webp" },
  { keywords: ["индейк", "turkey"], src: "/images/products/meat/turkey.webp" },
  { keywords: ["баранин", "ягнятин", "lamb"], src: "/images/products/meat/lamb.webp" },

  // ── Рыба и морепродукты ───────────────────────────────────
  { keywords: ["лосос", "семга", "salmon"], src: "/images/products/fish/salmon.webp" },
  { keywords: ["форел", "trout"], src: "/images/products/fish/trout.webp" },
  { keywords: ["тунец", "tuna"], src: "/images/products/fish/tuna.webp" },
  { keywords: ["треска", "cod"], src: "/images/products/fish/cod.webp" },
  { keywords: ["скумбри", "mackerel"], src: "/images/products/fish/mackerel.webp" },
  { keywords: ["сельдь", "herring"], src: "/images/products/fish/herring.webp" },
  { keywords: ["креветк", "shrimp", "prawn"], src: "/images/products/fish/shrimp.webp" },
  { keywords: ["кальмар", "squid"], src: "/images/products/fish/squid.webp" },

  // ── Овощи ─────────────────────────────────────────────────
  { keywords: ["помидор", "томат", "tomato"], src: "/images/products/vegetables/tomato.webp" },
  { keywords: ["огурец", "огурц", "cucumber"], src: "/images/products/vegetables/cucumber.webp" },
  { keywords: ["перец болгарский", "болгарский перец", "bell pepper"], src: "/images/products/vegetables/bell-pepper.webp" },
  { keywords: ["морков", "carrot"], src: "/images/products/vegetables/carrot.webp" },
  { keywords: ["картофел", "картошк", "potato"], src: "/images/products/vegetables/potato.webp" },
  { keywords: ["лук репчатый", "репчатый лук", "onion"], src: "/images/products/vegetables/onion.webp" },
  { keywords: ["чеснок", "garlic"], src: "/images/products/vegetables/garlic.webp" },
  { keywords: ["капуста белокочанная", "белокочанная капуста", "cabbage"], src: "/images/products/vegetables/cabbage.webp" },
  { keywords: ["брокколи", "broccoli"], src: "/images/products/vegetables/broccoli.webp" },
  { keywords: ["цветная капуста", "cauliflower"], src: "/images/products/vegetables/cauliflower.webp" },
  { keywords: ["баклажан", "eggplant", "aubergine"], src: "/images/products/vegetables/eggplant.webp" },
  { keywords: ["кабачок", "zucchini", "courgette"], src: "/images/products/vegetables/zucchini.webp" },
  { keywords: ["шпинат", "spinach"], src: "/images/products/vegetables/spinach.webp" },
  { keywords: ["спаржа", "asparagus"], src: "/images/products/vegetables/asparagus.webp" },
  { keywords: ["грибы", "гриб", "mushroom"], src: "/images/products/vegetables/mushroom.webp" },
  { keywords: ["горошек", "peas"], src: "/images/products/vegetables/peas.webp" },
  { keywords: ["кукуруза", "corn"], src: "/images/products/vegetables/corn.webp" },
  { keywords: ["свёкл", "свекол", "beet"], src: "/images/products/vegetables/beet.webp" },
  { keywords: ["тыква", "pumpkin"], src: "/images/products/vegetables/pumpkin.webp" },
  { keywords: ["батат", "sweet potato"], src: "/images/products/vegetables/sweet-potato.webp" },

  // ── Фрукты и ягоды ────────────────────────────────────────
  { keywords: ["яблок", "apple"], src: "/images/products/fruits/apple.webp" },
  { keywords: ["банан", "banana"], src: "/images/products/fruits/banana.webp" },
  { keywords: ["апельсин", "orange"], src: "/images/products/fruits/orange.webp" },
  { keywords: ["лимон", "lemon"], src: "/images/products/fruits/lemon.webp" },
  { keywords: ["груш", "pear"], src: "/images/products/fruits/pear.webp" },
  { keywords: ["персик", "peach"], src: "/images/products/fruits/peach.webp" },
  { keywords: ["слив", "plum"], src: "/images/products/fruits/plum.webp" },
  { keywords: ["виноград", "grape"], src: "/images/products/fruits/grape.webp" },
  { keywords: ["клубник", "земляник", "strawberry"], src: "/images/products/fruits/strawberry.webp" },
  { keywords: ["малин", "raspberry"], src: "/images/products/fruits/raspberry.webp" },
  { keywords: ["черник", "blueberry"], src: "/images/products/fruits/blueberry.webp" },
  { keywords: ["вишн", "черешн", "cherry"], src: "/images/products/fruits/cherry.webp" },
  { keywords: ["манго", "mango"], src: "/images/products/fruits/mango.webp" },
  { keywords: ["ананас", "pineapple"], src: "/images/products/fruits/pineapple.webp" },
  { keywords: ["киви", "kiwi"], src: "/images/products/fruits/kiwi.webp" },
  { keywords: ["авокадо", "avocado"], src: "/images/products/fruits/avocado.webp" },
  { keywords: ["арбуз", "watermelon"], src: "/images/products/fruits/watermelon.webp" },

  // ── Зелень ───────────────────────────────────────────────
  { keywords: ["укроп", "dill"], src: "/images/products/greens/dill.webp" },
  { keywords: ["петрушк", "parsley"], src: "/images/products/greens/parsley.webp" },
  { keywords: ["кинза", "кориандр", "cilantro", "coriander"], src: "/images/products/greens/cilantro.webp" },
  { keywords: ["базилик", "basil"], src: "/images/products/greens/basil.webp" },
  { keywords: ["мята", "mint"], src: "/images/products/greens/mint.webp" },
  { keywords: ["зелёный лук", "зеленый лук", "green onion"], src: "/images/products/greens/green-onion.webp" },
  { keywords: ["салат листовой", "салат", "lettuce"], src: "/images/products/greens/lettuce.webp" },

  // ── Крупы, бобовые, хлеб ────────────────────────────────
  { keywords: ["рис", "rice"], src: "/images/products/grains/rice.webp" },
  { keywords: ["гречк", "buckwheat"], src: "/images/products/grains/buckwheat.webp" },
  { keywords: ["овсянк", "овсяная крупа", "oatmeal", "oat"], src: "/images/products/grains/oatmeal.webp" },
  { keywords: ["спагетти", "spaghetti"], src: "/images/products/grains/spaghetti.webp" },
  { keywords: ["паст", "макарон", "pasta"], src: "/images/products/grains/pasta.webp" },
  { keywords: ["мука", "flour"], src: "/images/products/grains/flour.webp" },
  { keywords: ["хлеб", "bread"], src: "/images/products/grains/bread.webp" },
  { keywords: ["фасол", "beans"], src: "/images/products/grains/beans.webp" },
  { keywords: ["чечевиц", "lentil"], src: "/images/products/grains/lentils.webp" },
  { keywords: ["нут", "chickpea"], src: "/images/products/grains/chickpeas.webp" },

  // ── Масла и соусы ────────────────────────────────────────
  { keywords: ["оливковое масло", "olive oil"], src: "/images/products/oils/olive-oil.webp" },
  { keywords: ["подсолнечное масло", "sunflower oil"], src: "/images/products/oils/sunflower-oil.webp" },
  { keywords: ["майонез", "mayonnaise"], src: "/images/products/oils/mayonnaise.webp" },
  { keywords: ["кетчуп", "ketchup"], src: "/images/products/oils/ketchup.webp" },
  { keywords: ["горчица", "mustard"], src: "/images/products/oils/mustard.webp" },
  { keywords: ["мёд", "мед", "honey"], src: "/images/products/oils/honey.webp" },

  // ── Специи ───────────────────────────────────────────────
  { keywords: ["соль", "salt"], src: "/images/products/spices/salt.webp" },
  { keywords: ["сахар", "sugar"], src: "/images/products/spices/sugar.webp" },
  { keywords: ["перец чёрный", "черный перец", "black pepper"], src: "/images/products/spices/black-pepper.webp" },
  { keywords: ["куркума", "turmeric"], src: "/images/products/spices/turmeric.webp" },
  { keywords: ["корица", "cinnamon"], src: "/images/products/spices/cinnamon.webp" },

  // ── Напитки ──────────────────────────────────────────────
  { keywords: ["вода", "water"], src: "/images/products/beverages/water.webp" },
  { keywords: ["кофе", "coffee"], src: "/images/products/beverages/coffee.webp" },
  { keywords: ["чай", "tea"], src: "/images/products/beverages/tea.webp" },
  { keywords: ["сок", "juice"], src: "/images/products/beverages/juice.webp" },

  // ── Орехи и сухофрукты ───────────────────────────────────
  { keywords: ["грецкий орех", "walnut"], src: "/images/products/nuts/walnut.webp" },
  { keywords: ["миндал", "almond"], src: "/images/products/nuts/almond.webp" },
  { keywords: ["фундук", "hazelnut"], src: "/images/products/nuts/hazelnut.webp" },
  { keywords: ["изюм", "raisin"], src: "/images/products/nuts/raisins.webp" },

  // ── Заморозка ────────────────────────────────────────────
  { keywords: ["замороженные ягоды", "frozen berries"], src: "/images/products/frozen/frozen-berries.webp" },
  { keywords: ["пельмени", "вареники", "dumpling"], src: "/images/products/frozen/dumplings.webp" },
  { keywords: ["мороженое", "ice cream"], src: "/images/products/frozen/ice-cream.webp" },

  // ── Сладкое ─────────────────────────────────────────────
  { keywords: ["шоколад", "chocolate"], src: "/images/products/sweets/chocolate.webp" },
];

/**
 * Возвращает путь к изображению для продукта по его названию.
 * Поиск нечёткий: проверяются ключевые слова внутри строки (toLowerCase).
 * Если совпадений нет — возвращает null.
 */
export function getProductImageSrc(productName: string): string | null {
  const lower = productName.toLowerCase();
  for (const entry of IMAGE_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return entry.src;
      }
    }
  }
  return null;
}
