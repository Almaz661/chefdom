/**
 * Баннер хранилища — CSS градиент (никаких внешних файлов).
 * Автоматически, без ручной работы.
 */

const BANNER_CONFIG = {
  fridge: {
    gradient: 'linear-gradient(135deg, #0a1628 0%, #1a2f4a 50%, #0d2137 100%)',
    title: 'Холодильник',
    subtitle: 'Свежие продукты',
  },
  freezer: {
    gradient: 'linear-gradient(135deg, #0a1a2e 0%, #1a3a5c 50%, #0d2845 100%)',
    title: 'Морозилка',
    subtitle: 'Заморозка и заготовки',
  },
  pantry: {
    gradient: 'linear-gradient(135deg, #1a1208 0%, #3d2b0a 50%, #2a1e07 100%)',
    title: 'Кладовая',
    subtitle: 'Крупы, специи, консервы',
  },
} as const;

export function StorageBanner({
  storageType,
  itemCount,
}: {
  storageType: 'fridge' | 'freezer' | 'pantry';
  itemCount: number;
}) {
  const config = BANNER_CONFIG[storageType];

  const pluralProducts = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} продукт`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} продукта`;
    return `${n} продуктов`;
  };

  return (
    <div
      className="relative w-full h-32 rounded-xl overflow-hidden mb-6"
      style={{ background: config.gradient }}
    >
      {/* Декоративные элементы */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 right-6 w-20 h-20 rounded-full border border-white/20" />
        <div className="absolute bottom-2 right-16 w-10 h-10 rounded-full border border-white/10" />
      </div>
      {/* Текст */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h2 className="text-white text-xl font-bold">{config.title}</h2>
        <p className="text-white/60 text-sm">
          {itemCount > 0 ? pluralProducts(itemCount) : config.subtitle}
        </p>
      </div>
    </div>
  );
}
