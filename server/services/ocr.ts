// G.19 — OCR через Google Gemini Vision (gemini-1.5-flash).
// Бесплатный лимит: 15 запросов в минуту, 1500 в день.
// API ключ: Render → Environment → GEMINI_API_KEY.
// Получить ключ бесплатно: https://aistudio.google.com/apikey
//
// Gemini заменяет OCR.space потому что OCR.space путает буквы и цифры
// (L,37 вместо 1,37, O вместо 0), что приводило к неверным ценам в чеках.
// Gemini понимает структуру чека как человек и не делает таких ошибок.

export interface OcrResult {
  text: string;
  raw: unknown;
}

export interface OcrOptions {
  language?: string; // оставлено для совместимости, Gemini определяет сам
}

/**
 * Отправляет фото чека в Google Gemini Vision и возвращает распознанный текст.
 * Gemini понимает структуру чека намного лучше классического OCR —
 * не путает буквы и цифры (L/1, O/0), читает голландский и русский.
 *
 * Формат ответа: каждая позиция на отдельной строке «название\tцена»,
 * итог как «TE BETALEN\tсумма» — это совместимо с существующим parseReceiptText.
 */
export async function recognizeImage(
  imageBase64: string,
  _options: OcrOptions = {},
): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не задан в переменных окружения Render');
  }

  // Убираем data: префикс если есть — Gemini принимает чистый base64
  const base64Data = imageBase64.startsWith('data:')
    ? imageBase64.split(',')[1]
    : imageBase64;

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

  // gemini-flash-latest — всегда указывает на актуальную версию Flash модели
  // (подтверждено официальной документацией Google AI, май 2026)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ошибка ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!text) {
    throw new Error('Gemini не вернул текст — возможно фото нечёткое');
  }

  return { text, raw: data };
}
