/**
 * Сервис для извлечения данных из YouTube видео.
 * Используется для импорта рецептов: берёт описание видео и/или субтитры,
 * отправляет в Gemini AI для структурирования в формат рецепта.
 */

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
const API_TIMEOUT_MS = 15000;

function getApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null;
}

/** Извлекает video ID из YouTube URL */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Информация о видео из YouTube Data API */
export interface VideoInfo {
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string | null;
}

/** Получить информацию о видео (название, описание, канал) */
export async function getVideoInfo(videoId: string): Promise<VideoInfo | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY не настроен. Добавь его в переменные окружения на Render.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const url = `${YOUTUBE_API_URL}/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`YouTube API вернул ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as {
      items?: Array<{
        snippet: {
          title: string;
          description: string;
          channelTitle: string;
          thumbnails?: { high?: { url: string }; medium?: { url: string } };
        };
      }>;
    };

    if (!data.items || data.items.length === 0) return null;

    const snippet = data.items[0].snippet;
    return {
      title: snippet.title,
      description: snippet.description,
      channelTitle: snippet.channelTitle,
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Получить субтитры видео (auto-generated или ручные).
 * YouTube Data API не даёт прямого доступа к субтитрам без OAuth,
 * поэтому используем публичный endpoint для auto-captions.
 */
export async function getVideoCaptions(videoId: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    // Пробуем получить субтитры через публичный endpoint YouTube
    // (timedtext API — работает для видео с включёнными субтитрами)
    const langs = ['ru', 'en', 'a.ru', 'a.en']; // ru, en, авто-ru, авто-en

    for (const lang of langs) {
      try {
        const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) continue;
        const xml = await res.text();
        if (xml.length < 50) continue;

        // Парсим XML субтитров — извлекаем текст из <text> тегов
        const textMatches = xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
        const lines: string[] = [];
        for (const match of textMatches) {
          const text = match[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<[^>]+>/g, '') // убираем HTML теги
            .trim();
          if (text) lines.push(text);
        }

        if (lines.length > 10) {
          return lines.join(' ');
        }
      } catch {
        continue;
      }
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Извлечь ссылки из описания видео (часто ведут на сайт с рецептом) */
export function extractLinksFromDescription(description: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const matches = description.match(urlRegex) || [];
  // Фильтруем: убираем YouTube, соцсети, спонсоров
  const blocked = ['youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com', 't.me', 'vk.com', 'bit.ly', 'amzn.to'];
  return matches.filter(url => {
    const lower = url.toLowerCase();
    return !blocked.some(b => lower.includes(b));
  });
}
