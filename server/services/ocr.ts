// G.19 — OCR через Google Gemini Vision.
// Бесплатный лимит: 15 запросов в минуту, 1500 в день.
// API ключ: Render → Environment → GEMINI_API_KEY.
//
// Автоматический fallback по цепочке моделей:
//   1. GEMINI_MODEL из env (кастомная, если задана)
//   2. gemini-2.5-flash   — основная (GA с мая 2026)
//   3. gemini-2.5-flash-lite — дешевле, резерв
//   4. gemini-1.5-flash   — старая, стабильная резервная
//
// Каждую модель пробуем до 3 раз с паузами 5с / 15с.
// Если все попытки провалились → переходим к следующей модели.
// Если все модели недоступны → понятное сообщение об ошибке.

export interface OcrResult {
  text: string;
  raw: unknown;
  model: string; // какая модель в итоге сработала
}

export interface OcrOptions {
  language?: string; // оставлено для совместимости, Gemini определяет сам
}

// Кэш актуальных моделей от Google API. Обновляется раз в 24 часа.
let cachedModels: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

// Запрашивает список доступных Flash-моделей напрямую у Google.
// Если запрос не удался — возвращает null (используем fallback-список).
async function fetchAvailableFlashModels(apiKey: string): Promise<string[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
    };

    // Отбираем только Flash-модели которые поддерживают generateContent
    const flashModels = (data.models ?? [])
      .filter(m =>
        m.name.includes('flash') &&
        !m.name.includes('image') &&
        !m.name.includes('audio') &&
        !m.name.includes('tts') &&
        (m.supportedGenerationMethods ?? []).includes('generateContent'),
      )
      .map(m => m.name.replace('models/', ''))
      // Сортируем: более новые версии первыми
      // gemini-3.x > gemini-2.5 > gemini-2.0 > gemini-1.5
      .sort((a, b) => {
        const versionScore = (name: string) => {
          const m = name.match(/gemini-(\d+)\.?(\d*)/);
          if (!m) return 0;
          return parseFloat(`${m[1]}.${m[2] || '0'}`);
        };
        // lite-модели чуть хуже основных
        const score = (name: string) =>
          versionScore(name) - (name.includes('lite') ? 0.05 : 0);
        return score(b) - score(a);
      });

    return flashModels.length > 0 ? flashModels : null;
  } catch {
    return null;
  }
}

// Возвращает список кандидатов: сначала живые модели от API, потом hardcoded резерв.
async function getModelCandidates(apiKey: string): Promise<string[]> {
  const hardcoded = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
  ];

  // env-модель всегда первая если задана
  const envModel = process.env.GEMINI_MODEL;

  // Обновляем кэш раз в 24 часа
  const now = Date.now();
  if (!cachedModels || now - cacheTimestamp > CACHE_TTL_MS) {
    const live = await fetchAvailableFlashModels(apiKey);
    if (live) {
      cachedModels = live;
      cacheTimestamp = now;
      console.log(`[OCR] Актуальные модели от Google API: ${live.slice(0, 5).join(', ')}`);
    } else {
      // Не смогли получить — используем hardcoded, сбрасываем кэш
      cachedModels = null;
    }
  }

  const base = cachedModels ?? hardcoded;

  if (envModel) {
    return [envModel, ...base.filter(m => m !== envModel)];
  }
  return base;
}

const RECEIPT_PROMPT = `This is a photo of a grocery store receipt.

First output metadata lines (if found on the receipt):
STORE: <store name>
DATE: <date in YYYY-MM-DD format>

Then extract ALL line items with their prices, one per line:
<product name>\t<price>

Rules:
- Keep product names exactly as printed, do NOT translate
- Include discount lines with negative prices (e.g. Artikelkorting\t-2.07)
- Skip quantity info lines (e.g. "2 x 1,99")
- Add total as last line: TE BETALEN\t<total amount>
- Use comma as decimal separator (Dutch format): 1,49 not 1.49
- If store name or date not found, skip those metadata lines

Only output the lines described above, no explanations.`;

async function tryModel(
  model: string,
  body: object,
  apiKey: string,
): Promise<
  | { ok: true; text: string; raw: unknown }
  | { ok: false; fatal: boolean; status: number; reason: string }
> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const RETRIES = 2;
  const DELAYS_MS = [5_000, 15_000];

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, DELAYS_MS[attempt - 1]));
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      if (attempt < RETRIES) continue;
      return { ok: false, fatal: false, status: 0, reason: 'network error' };
    }

    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        return { ok: false, fatal: true, status: 200, reason: 'empty response' };
      }
      return { ok: true, text, raw: data };
    }

    // Плохое фото — не поможет смена модели
    if (res.status === 400) {
      return { ok: false, fatal: true, status: 400, reason: 'bad image' };
    }

    // Модель не существует или отключена — переходим к следующей сразу
    if (res.status === 404) {
      return { ok: false, fatal: false, status: 404, reason: 'model not found' };
    }

    // 503/429 — перегрузка, retry внутри этой модели
    if (res.status === 503 || res.status === 429) {
      if (attempt < RETRIES) continue;
      return { ok: false, fatal: false, status: res.status, reason: 'overloaded' };
    }

    return { ok: false, fatal: false, status: res.status, reason: `http ${res.status}` };
  }

  return { ok: false, fatal: false, status: 503, reason: 'max retries' };
}

/**
 * Распознаёт текст на фото чека через Google Gemini Vision.
 *
 * Автоматически перебирает модели если основная недоступна:
 *   gemini-2.5-flash → gemini-2.5-flash-lite → gemini-1.5-flash
 *
 * Каждую модель пробует до 3 раз с паузами перед переходом к следующей.
 */
export async function recognizeImage(
  imageBase64: string,
  _options: OcrOptions = {},
): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не задан в переменных окружения Render');
  }

  const base64Data = imageBase64.startsWith('data:')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const body = {
    contents: [{
      parts: [
        { text: RECEIPT_PROMPT },
        { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048 },
  };

  const models = await getModelCandidates(apiKey);

  for (const model of models) {
    const result = await tryModel(model, body, apiKey);

    if (result.ok) {
      if (model !== models[0]) {
        console.warn(`[OCR] Fallback сработал: использована модель ${model}`);
      }
      return { text: result.text, raw: result.raw, model };
    }

    // Плохое фото — смена модели не поможет
    if (result.fatal) {
      if (result.status === 400) {
        throw new Error('Не удалось распознать фото — сфотографируйте чек ровнее при хорошем освещении.');
      }
      throw new Error('Gemini не распознал текст на фото — попробуйте при лучшем освещении.');
    }

    // Модель недоступна — переходим к следующей
    console.warn(`[OCR] Модель ${model} недоступна (${result.reason}), пробуем следующую…`);
  }

  throw new Error(
    `Все модели Gemini временно недоступны (${models.join(', ')}). ` +
    'Это временная проблема Google. Попробуйте через 30 минут.'
  );
}
