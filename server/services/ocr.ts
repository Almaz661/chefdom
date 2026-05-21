// G.19 — OCR через OCR.space.
// Бесплатный сервис, без обязательной регистрации. Публичный ключ
// 'helloworld' имеет лимит 1 запрос в 10 секунд, без месячного лимита
// (https://ocr.space/ocrapi/free).
// Если упрёшься в лимит — зарегистрируй свой бесплатный ключ
// и положи в Render → Environment → OCR_SPACE_API_KEY.

const OCR_ENDPOINT = 'https://api.ocr.space/parse/image';

export interface OcrResult {
  text: string;
  raw: unknown;
}

export interface OcrOptions {
  // 'eng' для голландских/английских чеков, 'rus' для русских.
  // Можно передать массив — OCR.space обработает мультиязычно.
  language?: string;
}

/**
 * Отправляет фото в OCR.space и возвращает распознанный текст.
 * Принимает base64 (с или без префикса data:image/...;base64,).
 */
export async function recognizeImage(
  imageBase64: string,
  options: OcrOptions = {},
): Promise<OcrResult> {
  const apiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';

  // OCR.space принимает base64 с префиксом data: или просто как сырую base64-строку.
  // Если прислали без префикса — добавим, иначе сервис ругается.
  const dataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const form = new URLSearchParams();
  form.set('apikey', apiKey);
  form.set('base64Image', dataUrl);
  form.set('language', options.language ?? 'eng');
  // Намеренно НЕ ставим isTable=true. На чеках ALDI / Albert Heijn / Jumbo
  // (одна колонка названий + одна колонка цен) табличный режим перестраивает
  // текст и сливает соседние строки в один блок. Без него OCR.space сохраняет
  // построчную структуру, и парсер легко находит «название · цена».
  form.set('OCREngine', '2'); // 2 устойчивее к шуму бытовых фото
  form.set('scale', 'true'); // увеличивает мелкий текст
  form.set('detectOrientation', 'true'); // фото перевёрнуто? OCR сам повернёт

  const res = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    throw new Error(`OCR.space вернул ошибку HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: Array<{ ParsedText?: string }>;
  };

  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join('; ')
      : data.ErrorMessage ?? 'неизвестная ошибка OCR';
    throw new Error(`OCR.space: ${msg}`);
  }

  const parsed = data.ParsedResults?.[0]?.ParsedText ?? '';
  return { text: parsed, raw: data };
}
