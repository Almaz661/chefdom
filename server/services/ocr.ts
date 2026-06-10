// G.19 — OCR через Google Gemini Vision.
// Бесплатный лимит: 15 запросов в минуту, 1500 в день.
// API ключ: Render → Environment → GEMINI_API_KEY.
// Получить ключ бесплатно: https://aistudio.google.com/apikey
//
// Gemini заменяет OCR.space потому что OCR.space путает буквы и цифры
// (L,37 вместо 1,37, O вместо 0), что приводило к неверным ценам в чеках.
// Gemini понимает структуру чека как человек и не делает таких ошибок.
//
// Модели (список приоритетов):
//   1. GEMINI_MODEL из env (кастомная, если задана)
//   2. gemini-2.5-flash   — основная (GA с мая 2026)
//   3. gemini-2.5-flash-lite — дешевле, резерв
//   4. gemini-1.5-flash   — старая, но стабильная резервная
//
// Если основная модель возвращает 503/429 на все 3 попытки →
// автоматически переключаемся на следующую по списку.

export interface OcrResult {
  text: string;
  raw: unknown;
  model: string; // какая модель в итоге сработала
}

export interface OcrOptions {
  language?: string; // оставлено для совместимости, Gemini определяет сам
}

// Список моделей-кандидатов в порядке приоритета.
// Первой всегда идёт GEMINI_MODEL из env (если задана).
function getModelCandidates(): string[] {
  const candidates = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
  ];
  const envModel = process.env.GEMINI_MODEL;
  if (envModel && !candidates.includes(envModel)) {
    return [envModel, ...candidates];
  }
  if (envModel) {
    // env-модель ставим первой
    return [envModel, ...candidates.filter(m => m !== envModel)];
  }
  return candidates;
}

const prompt = `This is a photo of a grocery store receipt.

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
): Promise<{ ok: true; text: string; raw: unknown } | { ok: false; retryable: boolean; status: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // До 3 retry с паузами для одной модели
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
      // Сетевая ошибка — пробуем ещё раз
      if (attempt < RETRIES) continue;
      return { ok: false, retryable: true, status: 0 };
    }

    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        // Модель ответила но текст пустой — не retryable, фото плохое
        return { ok: false, retryable: false, status: 200 };
      }
      return { ok: true, text, raw: data };
    }

    // 503/429 — перегрузка, пробуем ещё раз на этой модели
    if (res.status === 503 || res.status === 429) {
      if (attempt < RETRIES) continue;
      return { ok: false, retryable: true, status: res.status };
    }

    // 404 — модель не существует, переходим к следующей
    if (res.status === 404) {
      return { ok: false, retryable: false, status: 404 };
    }

    // 400 — плохое фото
    if (res.status === 400) {
      return { ok: false, retryable: false, status: 400 };
    }

    // Другая ошибка
    return { ok: false, retryable: false, status: res.status };
  }

  return { ok: false, retryable: true, status: 503 };
}

/**
 * Отправляет фото чека в Google Gemini Vision и возвращает распознанный текст.
 *
 * Автоматически перебирает модели если основная недоступна:
 *   gemini-2.5-flash → gemini-2.5-flash-lite → gemini-1.5-flash
 *
 * Каждую модель пробует до 3 раз с паузами.
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
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
    },
  };

  const models = getModelCandidates();
  const triedModels: string[] = [];

  for (const model of models) {
    triedModels.push(model);
    const result = await tryModel(model, body, apiKey);

    if (result.ok) {
      // Если сработала не основная модель — логируем для диагностики
      if (model !== models[0]) {
        console.warn(`[OCR] Основная модель недоступна, сработал fallback: ${model}`);
      }
      return { text: result.text, raw: result.raw, model };
    }

    if (result.status === 400) {
      throw new Error('Не удалось распознать фото — сфотографируйте чек ровнее при хорошем освещении.');
    }

    if (result.status === 200) {
      throw new Error('Gemini не распознал текст на фото — попробуйте сфотографировать при лучшем освещении.');
    }

    // 404 или retryable → пробуем следующую модель
    if (!result.retryable || result.status === 404) {
      continue;
    }

    // Перегрузка — пробуем следующую модель
    continue;
  }

  throw new Error(
    `Все модели недоступны (${triedModels.join(', ')}). ` +
    'Это временная проблема Google. Попробуйте через 30 минут.'
  );
}
