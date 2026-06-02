/**
 * Баннер хранилища (холодильник/морозилка/кладовая).
 * Показывает фото из /public/images/ если оно есть,
 * иначе — красивый CSS-градиент.
 *
 * Чтобы подключить реальные фото:
 * 1. Скачайте фото и положите в /public/images/:
 *    - banner-fridge.jpg  (холодильник)
 *    - banner-freezer.jpg (морозилка)
 *    - banner-pantry.jpg  (кладовая)
 * 2. Компонент автоматически покажет их вместо градиента.
 */

import { useState } from 'react';

const BANNER_CONFIG = {
  fridge: {
    src: '/images/banner-fridge.jpg',
    gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0891b2 50%, #06b6d4 100%)',
    title: 'Холодильник',
    subtitle: 'Свежие продукты',
  },
  freezer: {
    src: '/images/banner-freezer.jpg',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
    title: 'Морозилка',
    subtitle: 'Заморозка и заготовки',
  },
  pantry: {
    src: '/images/banner-pantry.jpg',
    gradient: 'linear-gradient(135deg, #451a03 0%, #92400e 50%, #b45309 100%)',
    title: 'Кладовая',
    subtitle: 'Сухие продукты и специи',
  },
} as const;

export function StorageBanner({
  storageType,
  itemCount,
}: {
  storageType: 'fridge' | 'freezer' | 'pantry';
  itemCount: number;
}) {
  const [imgError, setImgError] = useState(false);
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
      className="relative w-full h-36 rounded-xl overflow-hidden mb-6"
      style={{ background: config.gradient }}
    >
      {/* Реальное фото (если есть) */}
      {!imgError && (
        <img
          src={config.src}
          alt={config.title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
      {/* Затемнение поверх фото */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      {/* Текст */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h2 className="text-white text-xl font-bold">{config.title}</h2>
        <p className="text-white/70 text-sm">
          {itemCount > 0 ? pluralProducts(itemCount) : config.subtitle}
        </p>
      </div>
    </div>
  );
}
