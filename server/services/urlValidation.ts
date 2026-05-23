/**
 * Валидация URL перед fetch — защита от SSRF.
 *
 * Не позволяет пользователю заставить сервер обратиться к:
 * - Внутренним IP-адресам (127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x)
 * - IPv6 loopback (::1)
 * - link-local адресам (169.254.x.x)
 * - localhost
 * - Облачным метаданным AWS/GCP/Azure (169.254.169.254, metadata.google.internal)
 * - Не-HTTP(S) протоколам (file://, ftp://, etc.)
 *
 * Используется в recipeScraper.ts и sectionImport.ts перед fetch
 * на пользовательский URL.
 */

// Паттерны приватных / запрещённых хостов
const BLOCKED_HOSTS = [
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
];

const BLOCKED_IP_PATTERNS = [
  /^127\./,               // loopback
  /^10\./,                // private class A
  /^172\.(1[6-9]|2\d|3[01])\./,  // private class B
  /^192\.168\./,          // private class C
  /^169\.254\./,          // link-local / cloud metadata
  /^0\./,                 // "this" network
  /^fc00:/i,              // IPv6 ULA
  /^fe80:/i,              // IPv6 link-local
  /^::1$/,               // IPv6 loopback
  /^::$/,                 // IPv6 unspecified
];

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

/**
 * Проверяет URL на допустимость для серверного fetch.
 * Выбрасывает SsrfError если URL указывает на приватный ресурс.
 */
export function validateFetchUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfError('Некорректный URL');
  }

  // Только HTTP(S)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfError('Разрешены только http:// и https:// URL');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Проверка на запрещённые хосты
  if (BLOCKED_HOSTS.includes(hostname)) {
    throw new SsrfError('Доступ к этому хосту запрещён');
  }

  // Проверка на IP-паттерны
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new SsrfError('Доступ к внутренним IP-адресам запрещён');
    }
  }

  // Запрет пользовательских портов которые могут указывать на внутренние сервисы
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    const portNum = parseInt(parsed.port, 10);
    // Разрешаем стандартные HTTP-порты и популярные для рецептов
    if (portNum < 80 || (portNum > 443 && portNum < 8000) || portNum > 9999) {
      throw new SsrfError('Нестандартный порт не разрешён');
    }
  }

  return parsed;
}
