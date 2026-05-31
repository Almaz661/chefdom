/**
 * Product Image Dictionary
 * 
 * Структура:
 *   key   = имя файла без расширения (относительно /public/images/products/)
 *   query = поисковый запрос для Pexels (на английском, "сырой продукт")
 *   keywords = русские/польские/нидерландские ключевые слова для матчинга
 *   category = папка внутри /public/images/products/
 */

export interface ProductImageEntry {
  key: string;
  query: string;
  keywords: string[];
  category: string;
}

export const PRODUCT_DICTIONARY: ProductImageEntry[] = [


  // ═══════════════════════════════════════════
  // VEGETABLES — Овощи
  // ═══════════════════════════════════════════
  { key: "vegetables/potato", query: "fresh raw potato", keywords: ["картошк", "картофел", "картош", "potato", "ziemniak", "aardappel"], category: "vegetables" },
  { key: "vegetables/carrot", query: "fresh raw carrot", keywords: ["морков", "carrot", "marchew", "wortel"], category: "vegetables" },
  { key: "vegetables/onion", query: "fresh raw onion", keywords: ["лук репч", "лук", "onion", "cebula", "ui"], category: "vegetables" },
  { key: "vegetables/garlic", query: "fresh raw garlic bulb", keywords: ["чеснок", "garlic", "czosnek", "knoflook"], category: "vegetables" },
  { key: "vegetables/tomato", query: "fresh raw tomatoes", keywords: ["помидор", "томат", "tomato", "pomidor", "tomaat"], category: "vegetables" },
  { key: "vegetables/cucumber", query: "fresh raw cucumber", keywords: ["огурц", "cucumber", "ogorek", "komkommer"], category: "vegetables" },
  { key: "vegetables/cabbage", query: "fresh raw cabbage head", keywords: ["капуст", "cabbage", "kapusta", "kool"], category: "vegetables" },
  { key: "vegetables/broccoli", query: "fresh raw broccoli", keywords: ["брокколи", "broccoli"], category: "vegetables" },
  { key: "vegetables/cauliflower", query: "fresh raw cauliflower", keywords: ["цветн кап", "cauliflower", "kalafior", "bloemkool"], category: "vegetables" },
  { key: "vegetables/bell-pepper", query: "fresh raw bell pepper", keywords: ["перец болг", "bell pepper", "papryka", "paprika"], category: "vegetables" },
  { key: "vegetables/zucchini", query: "fresh raw zucchini", keywords: ["кабачк", "zucchini", "cukinia", "courgette"], category: "vegetables" },
  { key: "vegetables/eggplant", query: "fresh raw eggplant", keywords: ["баклажан", "eggplant", "aubergine", "bakłażan"], category: "vegetables" },
  { key: "vegetables/beet", query: "fresh raw beetroot", keywords: ["свёкл", "свекл", "beetroot", "burak", "biet"], category: "vegetables" },
  { key: "vegetables/spinach", query: "fresh raw spinach leaves", keywords: ["шпинат", "spinach", "szpinak"], category: "vegetables" },
  { key: "vegetables/celery", query: "fresh raw celery", keywords: ["сельдер", "celery", "seler", "selderij"], category: "vegetables" },
  { key: "vegetables/leek", query: "fresh raw leek", keywords: ["порей", "leek", "por", "prei"], category: "vegetables" },
  { key: "vegetables/radish", query: "fresh raw radish", keywords: ["редис", "редьк", "radish", "rzodkiewka", "radijs"], category: "vegetables" },
  { key: "vegetables/pumpkin", query: "fresh raw pumpkin", keywords: ["тыкв", "pumpkin", "dynia", "pompoen"], category: "vegetables" },
  { key: "vegetables/corn", query: "fresh raw corn cob", keywords: ["кукуруз", "corn", "kukurydza", "maïs"], category: "vegetables" },
  { key: "vegetables/mushroom", query: "fresh raw mushrooms", keywords: ["гриб", "mushroom", "grzyby", "paddenstoel"], category: "vegetables" },
  { key: "vegetables/asparagus", query: "fresh raw asparagus", keywords: ["спаржа", "asparagus", "szparag"], category: "vegetables" },
  { key: "vegetables/artichoke", query: "fresh raw artichoke", keywords: ["артишок", "artichoke", "karczoch"], category: "vegetables" },
  { key: "vegetables/green-beans", query: "fresh raw green beans", keywords: ["стручк фасол", "green beans", "fasola szparagowa", "sperziebonen"], category: "vegetables" },
  { key: "vegetables/peas", query: "fresh green peas", keywords: ["горошек зел", "зелёный горош", "green peas", "groszek", "doperwten"], category: "vegetables" },
  { key: "vegetables/sweet-potato", query: "fresh raw sweet potato", keywords: ["батат", "sweet potato", "batat"], category: "vegetables" },


  // ═══════════════════════════════════════════
  // FRUITS — Фрукты
  // ═══════════════════════════════════════════
  { key: "fruits/apple", query: "fresh raw apple", keywords: ["яблок", "яблоко", "apple", "jabłko", "appel"], category: "fruits" },
  { key: "fruits/banana", query: "fresh raw banana", keywords: ["банан", "banana"], category: "fruits" },
  { key: "fruits/orange", query: "fresh raw orange citrus", keywords: ["апельсин", "orange", "pomarańcza", "sinaasappel"], category: "fruits" },
  { key: "fruits/lemon", query: "fresh raw lemon", keywords: ["лимон", "lemon", "cytryna", "citroen"], category: "fruits" },
  { key: "fruits/lime", query: "fresh raw lime", keywords: ["лайм", "lime", "limonka"], category: "fruits" },
  { key: "fruits/grape", query: "fresh raw grapes cluster", keywords: ["виноград", "grape", "winogrono", "druif"], category: "fruits" },
  { key: "fruits/strawberry", query: "fresh raw strawberries", keywords: ["клубник", "strawberry", "truskawka", "aardbei"], category: "fruits" },
  { key: "fruits/raspberry", query: "fresh raw raspberries", keywords: ["малин", "raspberry", "malina", "framboos"], category: "fruits" },
  { key: "fruits/blueberry", query: "fresh raw blueberries", keywords: ["черник", "голубик", "blueberry", "borówka", "bosbes"], category: "fruits" },
  { key: "fruits/cherry", query: "fresh raw cherries", keywords: ["вишн", "черешн", "cherry", "wiśnia", "kers"], category: "fruits" },
  { key: "fruits/peach", query: "fresh raw peach", keywords: ["персик", "peach", "brzoskwinia", "perzik"], category: "fruits" },
  { key: "fruits/pear", query: "fresh raw pear", keywords: ["груш", "pear", "gruszka", "peer"], category: "fruits" },
  { key: "fruits/plum", query: "fresh raw plum", keywords: ["слив", "plum", "śliwka", "pruim"], category: "fruits" },
  { key: "fruits/mango", query: "fresh raw mango", keywords: ["манго", "mango"], category: "fruits" },
  { key: "fruits/pineapple", query: "fresh raw pineapple", keywords: ["ананас", "pineapple", "ananas"], category: "fruits" },
  { key: "fruits/watermelon", query: "fresh raw watermelon", keywords: ["арбуз", "watermelon", "arbuz", "watermeloen"], category: "fruits" },
  { key: "fruits/melon", query: "fresh raw melon", keywords: ["дын", "melon", "melon"], category: "fruits" },
  { key: "fruits/kiwi", query: "fresh raw kiwi fruit", keywords: ["киви", "kiwi"], category: "fruits" },
  { key: "fruits/avocado", query: "fresh raw avocado", keywords: ["авокадо", "avocado"], category: "fruits" },
  { key: "fruits/pomegranate", query: "fresh raw pomegranate", keywords: ["гранат", "pomegranate", "granat", "granaatappel"], category: "fruits" },
  { key: "fruits/fig", query: "fresh raw figs", keywords: ["инжир", "fig", "figa", "vijg"], category: "fruits" },
  { key: "fruits/apricot", query: "fresh raw apricots", keywords: ["абрикос", "apricot", "morela", "abrikoos"], category: "fruits" },
  { key: "fruits/tangerine", query: "fresh raw mandarin tangerine", keywords: ["мандарин", "tangerine", "mandarynka", "mandarijn"], category: "fruits" },
  { key: "fruits/grapefruit", query: "fresh raw grapefruit", keywords: ["грейпфрут", "grapefruit", "grejpfrut"], category: "fruits" },


  // ═══════════════════════════════════════════
  // MEAT — Мясо
  // ═══════════════════════════════════════════
  { key: "meat/chicken-breast", query: "raw chicken breast meat", keywords: ["куриное филе", "грудка куриц", "chicken breast", "filet z kurczaka", "kipfilet"], category: "meat" },
  { key: "meat/chicken-whole", query: "raw whole chicken", keywords: ["курица цел", "whole chicken", "kurczak cały", "hele kip"], category: "meat" },
  { key: "meat/chicken-thigh", query: "raw chicken thighs", keywords: ["куриные бёдр", "chicken thigh", "udko kurczaka", "kippendij"], category: "meat" },
  { key: "meat/chicken-wings", query: "raw chicken wings", keywords: ["куриные крыл", "chicken wings", "skrzydełka", "kipvleugels"], category: "meat" },
  { key: "meat/chicken-drumstick", query: "raw chicken drumsticks", keywords: ["голени куриц", "drumstick", "pałka z kurczaka", "kipdrumstick"], category: "meat" },
  { key: "meat/beef-steak", query: "raw beef steak meat", keywords: ["говядина стейк", "beef steak", "stek wołowy", "biefstuk"], category: "meat" },
  { key: "meat/beef-mince", query: "raw minced beef", keywords: ["фарш говяжий", "beef mince", "mielona wołowina", "gehakt rund"], category: "meat" },
  { key: "meat/pork-loin", query: "raw pork loin", keywords: ["свинина вырезк", "pork loin", "polędwica wieprzowa", "varkenshaas"], category: "meat" },
  { key: "meat/pork-ribs", query: "raw pork ribs", keywords: ["свиные рёбр", "pork ribs", "żeberka wieprzowe", "varkensribbetjes"], category: "meat" },
  { key: "meat/ground-meat", query: "raw ground meat minced", keywords: ["фарш", "minced meat", "mięso mielone", "gehakt"], category: "meat" },
  { key: "meat/lamb", query: "raw lamb meat", keywords: ["баранин", "ягнят", "lamb", "jagnięcina", "lamsvlees"], category: "meat" },
  { key: "meat/turkey", query: "raw turkey meat", keywords: ["индейк", "turkey", "indyk", "kalkoen"], category: "meat" },
  { key: "meat/duck", query: "raw duck meat", keywords: ["утк", "duck", "kaczka", "eend"], category: "meat" },
  { key: "meat/veal", query: "raw veal meat", keywords: ["телятин", "veal", "cielęcina", "kalfsvlees"], category: "meat" },
  { key: "meat/rabbit", query: "raw rabbit meat", keywords: ["кролик", "rabbit", "królik", "konijn"], category: "meat" },
  { key: "meat/sausage", query: "raw fresh sausages", keywords: ["колбас", "сосиск", "sausage", "kiełbasa", "worst"], category: "meat" },
  { key: "meat/bacon", query: "raw bacon strips", keywords: ["бекон", "bacon", "boczek", "spek"], category: "meat" },
  { key: "meat/ham", query: "fresh ham", keywords: ["ветчин", "ham", "szynka", "ham"], category: "meat" },
  { key: "meat/liver", query: "raw chicken liver", keywords: ["печень", "liver", "wątroba", "lever"], category: "meat" },


  // ═══════════════════════════════════════════
  // FISH & SEAFOOD — Рыба и морепродукты
  // ═══════════════════════════════════════════
  { key: "fish/salmon", query: "fresh raw salmon fillet", keywords: ["лосось", "сёмга", "семга", "salmon", "łosoś", "zalm"], category: "fish" },
  { key: "fish/tuna", query: "fresh raw tuna steak", keywords: ["тунец", "tuna", "tuńczyk", "tonijn"], category: "fish" },
  { key: "fish/cod", query: "fresh raw cod fish", keywords: ["треска", "cod", "dorsz", "kabeljauw"], category: "fish" },
  { key: "fish/herring", query: "fresh raw herring fish", keywords: ["сельдь", "селёдк", "herring", "śledź", "haring"], category: "fish" },
  { key: "fish/mackerel", query: "fresh raw mackerel fish", keywords: ["скумбрия", "mackerel", "makrela", "makreel"], category: "fish" },
  { key: "fish/trout", query: "fresh raw trout fish", keywords: ["форель", "trout", "pstrąg", "forel"], category: "fish" },
  { key: "fish/shrimp", query: "fresh raw shrimp prawns", keywords: ["креветк", "shrimp", "krewetki", "garnalen"], category: "fish" },
  { key: "fish/squid", query: "fresh raw squid calamari", keywords: ["кальмар", "squid", "kałamarnica", "inktvis"], category: "fish" },
  { key: "fish/mussels", query: "fresh raw mussels", keywords: ["мидии", "mussels", "małże", "mosselen"], category: "fish" },
  { key: "fish/pollock", query: "fresh raw pollock fish", keywords: ["минтай", "pollock", "mintaj"], category: "fish" },
  { key: "fish/pike", query: "fresh raw pike fish", keywords: ["щука", "судак", "pike", "szczupak", "snoek"], category: "fish" },
  { key: "fish/carp", query: "fresh raw carp fish", keywords: ["карп", "carp", "karp", "karper"], category: "fish" },
  { key: "fish/crab", query: "fresh raw crab", keywords: ["краб", "crab", "krab"], category: "fish" },
  { key: "fish/octopus", query: "fresh raw octopus", keywords: ["осьминог", "octopus", "ośmiornica"], category: "fish" },


  // ═══════════════════════════════════════════
  // DAIRY & EGGS — Молочные продукты и яйца
  // ═══════════════════════════════════════════
  { key: "dairy/milk", query: "glass of fresh milk", keywords: ["молоко", "молок", "milk", "mleko", "melk"], category: "dairy" },
  { key: "dairy/eggs", query: "fresh raw chicken eggs", keywords: ["яйц", "яйцо", "eggs", "jajka", "eieren"], category: "dairy" },
  { key: "dairy/butter", query: "fresh butter block", keywords: ["масло сливочн", "butter", "masło", "boter"], category: "dairy" },
  { key: "dairy/cheese", query: "fresh cheese block", keywords: ["сыр", "cheese", "ser", "kaas"], category: "dairy" },
  { key: "dairy/cottage-cheese", query: "fresh cottage cheese", keywords: ["творог", "cottage cheese", "twaróg", "kwark"], category: "dairy" },
  { key: "dairy/sour-cream", query: "fresh sour cream", keywords: ["сметан", "sour cream", "śmietana", "zure room"], category: "dairy" },
  { key: "dairy/yogurt", query: "fresh plain yogurt", keywords: ["йогурт", "yogurt", "jogurt", "yoghurt"], category: "dairy" },
  { key: "dairy/kefir", query: "glass of kefir", keywords: ["кефир", "kefir"], category: "dairy" },
  { key: "dairy/cream", query: "fresh heavy cream", keywords: ["сливк", "cream", "śmietanka", "slagroom"], category: "dairy" },
  { key: "dairy/milk-condensed", query: "condensed milk can", keywords: ["сгущён", "сгущенк", "condensed milk"], category: "dairy" },
  { key: "dairy/ryazhenka", query: "baked milk fermented", keywords: ["ряженк", "ряженка"], category: "dairy" },
  { key: "dairy/cheddar", query: "cheddar cheese block", keywords: ["чеддер", "cheddar"], category: "dairy" },
  { key: "dairy/mozzarella", query: "fresh mozzarella cheese", keywords: ["моцарелл", "mozzarella"], category: "dairy" },
  { key: "dairy/parmesan", query: "parmesan cheese block", keywords: ["пармезан", "parmesan", "parmezan"], category: "dairy" },
  { key: "dairy/feta", query: "fresh feta cheese", keywords: ["фета", "feta"], category: "dairy" },
  { key: "dairy/cream-cheese", query: "fresh cream cheese", keywords: ["сливочный сыр", "cream cheese", "serek śmietankowy"], category: "dairy" },
  { key: "dairy/margarine", query: "margarine block", keywords: ["маргарин", "margarine"], category: "dairy" },


  // ═══════════════════════════════════════════
  // GRAINS & PASTA — Крупы и макароны
  // ═══════════════════════════════════════════
  { key: "grains/rice", query: "raw white rice grains", keywords: ["рис", "rice", "ryż", "rijst"], category: "grains" },
  { key: "grains/buckwheat", query: "raw buckwheat groats", keywords: ["гречк", "buckwheat", "kasza gryczana", "boekweit"], category: "grains" },
  { key: "grains/oatmeal", query: "raw oat flakes oatmeal", keywords: ["овсянк", "геркулес", "oatmeal", "płatki owsiane", "havermout"], category: "grains" },
  { key: "grains/pasta", query: "raw dry pasta", keywords: ["макарон", "pasta", "makaron"], category: "grains" },
  { key: "grains/spaghetti", query: "raw dry spaghetti", keywords: ["спагетт", "spaghetti"], category: "grains" },
  { key: "grains/flour", query: "wheat flour in bowl", keywords: ["мук", "flour", "mąka", "meel"], category: "grains" },
  { key: "grains/semolina", query: "raw semolina flour", keywords: ["манк", "semolina", "kasza manna", "griesmeel"], category: "grains" },
  { key: "grains/millet", query: "raw millet grains", keywords: ["пшено", "millet", "proso", "gierst"], category: "grains" },
  { key: "grains/barley", query: "raw pearl barley", keywords: ["перловк", "barley", "kasza pęczak", "gerst"], category: "grains" },
  { key: "grains/bulgur", query: "raw bulgur wheat", keywords: ["булгур", "bulgur"], category: "grains" },
  { key: "grains/couscous", query: "raw couscous", keywords: ["кускус", "couscous"], category: "grains" },
  { key: "grains/quinoa", query: "raw quinoa seeds", keywords: ["киноа", "quinoa"], category: "grains" },
  { key: "grains/lentils", query: "raw lentils", keywords: ["чечевиц", "lentils", "soczewica", "linzen"], category: "grains" },
  { key: "grains/chickpeas", query: "raw chickpeas", keywords: ["нут", "chickpeas", "ciecierzyca", "kikkererwten"], category: "grains" },
  { key: "grains/beans", query: "raw dried beans", keywords: ["фасол", "beans", "fasola", "bonen"], category: "grains" },
  { key: "grains/peas-dry", query: "raw dried peas", keywords: ["горох суш", "dried peas", "groch", "spliterwten"], category: "grains" },
  { key: "grains/bread", query: "fresh baked bread loaf", keywords: ["хлеб", "bread", "chleb", "brood"], category: "grains" },
  { key: "grains/starch", query: "cornstarch powder", keywords: ["крахмал", "starch", "skrobia", "zetmeel"], category: "grains" },


  // ═══════════════════════════════════════════
  // OILS & CONDIMENTS — Масла и приправы
  // ═══════════════════════════════════════════
  { key: "oils/sunflower-oil", query: "sunflower oil bottle", keywords: ["масло подсолнечн", "sunflower oil", "olej słonecznikowy", "zonnebloemolie"], category: "oils" },
  { key: "oils/olive-oil", query: "olive oil bottle", keywords: ["масло оливков", "olive oil", "oliwa z oliwek", "olijfolie"], category: "oils" },
  { key: "oils/vinegar", query: "vinegar bottle", keywords: ["уксус", "vinegar", "ocet", "azijn"], category: "oils" },
  { key: "oils/soy-sauce", query: "soy sauce", keywords: ["соевый соус", "soy sauce", "sos sojowy", "sojasaus"], category: "oils" },
  { key: "oils/ketchup", query: "ketchup tomato sauce", keywords: ["кетчуп", "ketchup", "keczup"], category: "oils" },
  { key: "oils/mayonnaise", query: "mayonnaise", keywords: ["майонез", "mayonnaise", "majonez"], category: "oils" },
  { key: "oils/mustard", query: "mustard jar", keywords: ["горчиц", "mustard", "musztarda", "mosterd"], category: "oils" },
  { key: "oils/honey", query: "fresh honey jar", keywords: ["мёд", "мед", "honey", "miód", "honing"], category: "oils" },
  { key: "oils/jam", query: "fruit jam jar", keywords: ["варенье", "джем", "jam", "dżem", "jam"], category: "oils" },

  // ═══════════════════════════════════════════
  // SPICES — Специи
  // ═══════════════════════════════════════════
  { key: "spices/salt", query: "sea salt crystals", keywords: ["соль", "salt", "sól", "zout"], category: "spices" },
  { key: "spices/sugar", query: "white sugar crystals", keywords: ["сахар", "sugar", "cukier", "suiker"], category: "spices" },
  { key: "spices/black-pepper", query: "black pepper corns", keywords: ["перец чёрн", "перец черн", "black pepper", "pieprz czarny", "zwarte peper"], category: "spices" },
  { key: "spices/paprika-powder", query: "red paprika powder", keywords: ["паприк", "paprika powder", "papryka mielona"], category: "spices" },
  { key: "spices/cinnamon", query: "cinnamon sticks", keywords: ["корица", "cinnamon", "cynamon", "kaneel"], category: "spices" },
  { key: "spices/turmeric", query: "turmeric powder yellow", keywords: ["куркум", "turmeric", "kurkuma"], category: "spices" },
  { key: "spices/bay-leaf", query: "dried bay leaves", keywords: ["лавр", "bay leaf", "liść laurowy", "laurierblad"], category: "spices" },
  { key: "spices/cumin", query: "cumin seeds", keywords: ["тмин", "зира", "cumin", "kminek", "komijn"], category: "spices" },
  { key: "spices/vanilla", query: "vanilla pods", keywords: ["ваниль", "vanilla", "wanilia", "vanille"], category: "spices" },
  { key: "spices/baking-soda", query: "baking soda powder", keywords: ["сода", "baking soda", "soda", "natrium"], category: "spices" },
  { key: "spices/yeast", query: "dry yeast", keywords: ["дрожж", "yeast", "drożdże", "gist"], category: "spices" },
  { key: "spices/baking-powder", query: "baking powder", keywords: ["разрыхлител", "baking powder", "proszek do pieczenia"], category: "spices" },


  // ═══════════════════════════════════════════
  // BEVERAGES — Напитки
  // ═══════════════════════════════════════════
  { key: "beverages/water", query: "glass of water", keywords: ["вода", "water", "woda"], category: "beverages" },
  { key: "beverages/juice", query: "fresh fruit juice glass", keywords: ["сок", "juice", "sok", "sap"], category: "beverages" },
  { key: "beverages/tea", query: "loose leaf tea", keywords: ["чай", "tea", "herbata", "thee"], category: "beverages" },
  { key: "beverages/coffee", query: "coffee beans", keywords: ["кофе", "coffee", "kawa", "koffie"], category: "beverages" },
  { key: "beverages/cocoa", query: "cocoa powder", keywords: ["какао", "cocoa", "kakao"], category: "beverages" },

  // ═══════════════════════════════════════════
  // NUTS & DRIED FRUITS — Орехи и сухофрукты
  // ═══════════════════════════════════════════
  { key: "nuts/walnut", query: "raw walnuts", keywords: ["грецк орех", "walnut", "orzech włoski", "walnoot"], category: "nuts" },
  { key: "nuts/almond", query: "raw almonds", keywords: ["миндал", "almond", "migdał", "amandel"], category: "nuts" },
  { key: "nuts/hazelnut", query: "raw hazelnuts", keywords: ["фундук", "hazelnut", "orzech laskowy", "hazelnoot"], category: "nuts" },
  { key: "nuts/cashew", query: "raw cashew nuts", keywords: ["кешью", "cashew", "nerkowiec"], category: "nuts" },
  { key: "nuts/peanut", query: "raw peanuts", keywords: ["арахис", "peanut", "orzeszki ziemne", "pinda"], category: "nuts" },
  { key: "nuts/raisins", query: "dried raisins", keywords: ["изюм", "raisins", "rodzynki", "rozijnen"], category: "nuts" },
  { key: "nuts/dried-apricot", query: "dried apricots", keywords: ["курага", "dried apricots", "morele suszone", "gedroogde abrikozen"], category: "nuts" },
  { key: "nuts/prunes", query: "dried prunes", keywords: ["чернослив", "prunes", "śliwki suszone", "pruimen"], category: "nuts" },
  { key: "nuts/dates", query: "fresh dates fruit", keywords: ["финик", "dates", "daktyle", "dadels"], category: "nuts" },

  // ═══════════════════════════════════════════
  // SWEETS & BAKED — Сладости и выпечка
  // ═══════════════════════════════════════════
  { key: "sweets/chocolate", query: "dark chocolate bar", keywords: ["шоколад", "chocolate", "czekolada", "chocolade"], category: "sweets" },
  { key: "sweets/cookies", query: "fresh baked cookies", keywords: ["печень", "cookies", "ciastka", "koekjes"], category: "sweets" },
  { key: "sweets/cake", query: "homemade cake", keywords: ["торт", "cake", "tort", "taart"], category: "sweets" },
  { key: "sweets/wafer", query: "wafer crackers", keywords: ["вафл", "wafer", "wafel"], category: "sweets" },
  { key: "sweets/candy", query: "colorful candy sweets", keywords: ["конфет", "candy", "cukierki", "snoep"], category: "sweets" },

  // ═══════════════════════════════════════════
  // FROZEN — Заморозка
  // ═══════════════════════════════════════════
  { key: "frozen/dumplings", query: "raw dumplings pelmeni", keywords: ["пельмен", "dumplings", "pierogi", "dumplings"], category: "frozen" },
  { key: "frozen/vareniki", query: "raw vareniki dumplings", keywords: ["вареник", "vareniki", "pierogi gotowane"], category: "frozen" },
  { key: "frozen/frozen-vegetables", query: "mixed frozen vegetables", keywords: ["замороженные овощи", "frozen vegetables", "mrożone warzywa", "diepvriesgroenten"], category: "frozen" },
  { key: "frozen/frozen-berries", query: "frozen mixed berries", keywords: ["замороженные ягоды", "frozen berries", "mrożone owoce", "diepvriesfruit"], category: "frozen" },
  { key: "frozen/ice-cream", query: "ice cream scoop", keywords: ["мороженое", "ice cream", "lody", "ijs"], category: "frozen" },
  { key: "frozen/pizza-dough", query: "raw pizza dough", keywords: ["тесто", "pizza dough", "ciasto", "deeg"], category: "frozen" },
  { key: "frozen/nuggets", query: "raw chicken nuggets", keywords: ["наггетс", "nuggets"], category: "frozen" },

  // ═══════════════════════════════════════════
  // GREENS — Зелень
  // ═══════════════════════════════════════════
  { key: "greens/dill", query: "fresh dill herbs", keywords: ["укроп", "dill", "koper", "dille"], category: "greens" },
  { key: "greens/parsley", query: "fresh parsley herbs", keywords: ["петрушк", "parsley", "pietruszka", "peterselie"], category: "greens" },
  { key: "greens/basil", query: "fresh basil leaves", keywords: ["базилик", "basil", "bazylia", "basilicum"], category: "greens" },
  { key: "greens/cilantro", query: "fresh cilantro coriander", keywords: ["кинз", "cilantro", "kolendra", "koriander"], category: "greens" },
  { key: "greens/green-onion", query: "fresh green spring onions", keywords: ["лук зелён", "green onion", "szczypiorek", "bosui"], category: "greens" },
  { key: "greens/lettuce", query: "fresh lettuce salad leaves", keywords: ["салат листов", "lettuce", "sałata", "sla"], category: "greens" },
  { key: "greens/mint", query: "fresh mint leaves", keywords: ["мята", "mint", "mięta", "munt"], category: "greens" },
  { key: "greens/thyme", query: "fresh thyme herbs", keywords: ["тимьян", "чабрец", "thyme", "tymianek", "tijm"], category: "greens" },
  { key: "greens/rosemary", query: "fresh rosemary sprigs", keywords: ["розмарин", "rosemary", "rozmaryn"], category: "greens" },
];

// Всего продуктов в словаре
export const TOTAL_PRODUCTS = PRODUCT_DICTIONARY.length;

/**
 * Найти запись по ключевым словам в названии продукта.
 * Возвращает путь к изображению или null.
 */
export function findProductEntry(productName: string): ProductImageEntry | null {
  const lower = productName.toLowerCase().trim();
  for (const entry of PRODUCT_DICTIONARY) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) return entry;
    }
  }
  return null;
}

/**
 * Получить URL изображения для продукта.
 * Возвращает путь от корня сайта.
 */
export function getProductImagePath(productName: string): string {
  const entry = findProductEntry(productName);
  if (entry) return `/images/products/${entry.key}.webp`;
  return `/images/products/placeholder.webp`;
}
