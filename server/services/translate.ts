// Сервис перевода через DeepL API (Free tier: 500 000 символов/мес).
// Используется для перевода названий товаров из чеков (NL→RU) и
// штрих-кодов из Open Food Facts (NL/EN→RU).
//
// Если API ключ не задан — возвращает оригинальный текст без перевода.
// Если DeepL вернул ошибку — возвращает оригинал (best-effort, не ломает импорт).

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

function getApiKey(): string | null {
  return process.env.DEEPL_API_KEY || null;
}

/**
 * Переводит текст на русский язык через DeepL API.
 * Формат результата: "Оригинал (Перевод)" — чтобы видеть и NL и RU.
 * source_lang: 'NL' | 'EN' | null (auto-detect).
 * Если ключа нет или перевод не удался — возвращает оригинал.
 */
export async function translateToRu(
  text: string,
  sourceLang?: 'NL' | 'EN' | null,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return text;
  if (!text || text.trim().length < 2) return text;

  // Если текст уже на русском — не переводим
  if (/[а-яА-ЯёЁ]/.test(text) && !/[a-zA-Z]/.test(text)) return text;

  try {
    const params = new URLSearchParams({
      text,
      target_lang: 'RU',
    });
    if (sourceLang) {
      params.set('source_lang', sourceLang);
    }

    const res = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      console.warn(`[translate] DeepL вернул ${res.status} для "${text.slice(0, 50)}"`);
      return text;
    }

    const data = await res.json() as {
      translations?: Array<{ text: string }>;
    };

    if (data.translations && data.translations.length > 0) {
      const translated = data.translations[0].text;
      // Формат: "Оригинал (Перевод)" — видно и NL и RU
      if (translated.toLowerCase() !== text.toLowerCase()) {
        return `${text} (${translated})`;
      }
      return text;
    }

    return text;
  } catch (err) {
    console.warn('[translate] Ошибка DeepL:', err instanceof Error ? err.message : err);
    return text;
  }
}

/**
 * Переводит ОДИН текст на русский БЕЗ формата "Оригинал (Перевод)".
 * Возвращает только чистый перевод. Используется там, где нужно сохранять
 * именно русское название (инвентарь, каталог товаров по штрих-коду).
 *
 * Если ключа нет / DeepL вернул ошибку / уже на русском — возвращает
 * исходный текст. Это best-effort: при отсутствии перевода UX остаётся
 * рабочим, просто без локализации.
 */
export async function translatePlainToRu(
  text: string,
  sourceLang?: 'NL' | 'EN' | null,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return text;
  if (!text || text.trim().length < 2) return text;

  // Уже на русском (нет латиницы) — не переводим
  if (/[а-яА-ЯёЁ]/.test(text) && !/[a-zA-Z]/.test(text)) return text;
  // Нет ни латиницы ни кириллицы (только цифры/символы) — нечего переводить
  if (!/[a-zA-Z]/.test(text)) return text;

  try {
    const params = new URLSearchParams({
      text,
      target_lang: 'RU',
    });
    if (sourceLang) params.set('source_lang', sourceLang);

    const res = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      console.warn(`[translate] translatePlainToRu вернул ${res.status} для "${text.slice(0, 50)}"`);
      return text;
    }

    const data = await res.json() as {
      translations?: Array<{ text: string }>;
    };

    const translated = data.translations?.[0]?.text;
    if (translated && translated.trim().length > 0) return translated;
    return text;
  } catch (err) {
    console.warn('[translate] Ошибка translatePlainToRu:', err instanceof Error ? err.message : err);
    return text;
  }
}

/**
 * Переводит массив строк одним запросом (экономит лимит).
 * DeepL поддерживает до 50 текстов в одном запросе.
 */
export async function translateBatchToRu(
  texts: string[],
  sourceLang?: 'NL' | 'EN' | 'DE' | 'PL' | null,
): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) return texts;
  if (texts.length === 0) return [];

  // Фильтруем: переводим только те что не на русском
  const needTranslation = texts.map((t, i) => ({
    text: t,
    index: i,
    needsIt: t.trim().length >= 2 && !(/[а-яА-ЯёЁ]/.test(t) && !/[a-zA-Z]/.test(t)),
  }));

  const toTranslate = needTranslation.filter(n => n.needsIt);
  if (toTranslate.length === 0) return texts;

  try {
    // DeepL принимает несколько text параметров
    const params = new URLSearchParams({ target_lang: 'RU' });
    if (sourceLang) params.set('source_lang', sourceLang);
    for (const item of toTranslate) {
      params.append('text', item.text);
    }

    const res = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      console.warn(`[translate] DeepL batch вернул ${res.status}`);
      return texts;
    }

    const data = await res.json() as {
      translations?: Array<{ text: string }>;
    };

    if (!data.translations || data.translations.length !== toTranslate.length) {
      return texts;
    }

    // Собираем результат: "Оригинал (Перевод)" + оригиналы для русских
    const result = [...texts];
    for (let i = 0; i < toTranslate.length; i++) {
      const original = toTranslate[i].text;
      const translated = data.translations[i].text;
      // Формат: "Оригинал (Перевод)" — видно и NL и RU
      if (translated.toLowerCase() !== original.toLowerCase()) {
        result[toTranslate[i].index] = `${original} (${translated})`;
      }
    }
    return result;
  } catch (err) {
    console.warn('[translate] Ошибка DeepL batch:', err instanceof Error ? err.message : err);
    return texts;
  }
}

/**
 * Перевод массива текстов на русский БЕЗ формата "Оригинал (Перевод)".
 * Возвращает только перевод. Используется для рецептов где нужен чистый
 * русский текст в названии, описании, ингредиентах и шагах.
 *
 * Если API ключа нет — возвращает оригинал.
 * Тексты которые уже на русском — не переводятся (возвращаются как есть).
 */
export async function translatePlainBatch(
  texts: string[],
  sourceLang?: 'NL' | 'EN' | null,
): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) return texts;
  if (texts.length === 0) return [];

  // Переводим только то что не на русском (содержит латиницу и нет кириллицы или есть и то и то)
  const needTranslation = texts.map((t, i) => ({
    text: t,
    index: i,
    needsIt: t.trim().length >= 2 && /[a-zA-Z]/.test(t) && !(/[а-яА-ЯёЁ]/.test(t)),
  }));

  const toTranslate = needTranslation.filter(n => n.needsIt);
  if (toTranslate.length === 0) return texts;

  try {
    // DeepL обрабатывает максимум 50 текстов за раз, разбиваем на батчи
    const batches: typeof toTranslate[] = [];
    for (let i = 0; i < toTranslate.length; i += 50) {
      batches.push(toTranslate.slice(i, i + 50));
    }

    const result = [...texts];

    for (const batch of batches) {
      const params = new URLSearchParams({ target_lang: 'RU' });
      if (sourceLang) params.set('source_lang', sourceLang);
      for (const item of batch) {
        params.append('text', item.text);
      }

      const res = await fetch(DEEPL_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!res.ok) {
        console.warn(`[translate] translatePlainBatch вернул ${res.status}`);
        continue;
      }

      const data = await res.json() as {
        translations?: Array<{ text: string }>;
      };

      if (!data.translations || data.translations.length !== batch.length) continue;

      for (let i = 0; i < batch.length; i++) {
        result[batch[i].index] = data.translations[i].text;
      }
    }

    return result;
  } catch (err) {
    console.warn('[translate] Ошибка translatePlainBatch:', err instanceof Error ? err.message : err);
    return texts;
  }
}

