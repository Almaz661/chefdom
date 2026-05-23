import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { client } from "../db/index";

// Защита от перебора PIN. Попытки и блокировка хранятся в БД (auth_attempts),
// поэтому переживают перезапуск сервера. До миграции 017 это было in-memory
// и на Render Free сбрасывалось каждые 15 мин.
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 30 * 60 * 1000;

// Срок жизни сессии. 30 дней — соответствует TTL клиентского localStorage.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getKey(ip: string | undefined): string {
  return ip || "unknown";
}

/**
 * Создаёт сессию для пользователя.
 * token — 32 байта криптостойкой случайности → 64 hex символа.
 * Не угадывается перебором (2^256 вариантов).
 */
async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await client`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt})
  `;
  return token;
}

/**
 * Проверяет, заблокирован ли IP. Возвращает оставшиеся минуты блокировки
 * или null если не заблокирован.
 */
async function checkBlocked(key: string): Promise<number | null> {
  const rows = await client<{ blocked_until: Date | null }[]>`
    SELECT blocked_until FROM auth_attempts
    WHERE key = ${key} AND blocked_until > NOW()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const blockedUntil = rows[0].blocked_until;
  if (!blockedUntil) return null;
  const ms = blockedUntil.getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 60000));
}

/**
 * Регистрирует неуспешную попытку. Атомарно увеличивает счётчик в БД.
 * Если достигли MAX_ATTEMPTS — выставляет blocked_until на BLOCK_MS вперёд
 * и сбрасывает счётчик.
 *
 * Возвращает: { left, blocked } — сколько попыток осталось до блока,
 * или blocked=true если только что заблокировали.
 */
async function recordFailedAttempt(
  key: string,
): Promise<{ left: number; blocked: boolean }> {
  // ON CONFLICT DO UPDATE — атомарный upsert.
  // Когда count после инкремента >= MAX_ATTEMPTS: ставим блок и обнуляем
  // счётчик (чтобы после разблокировки начать заново с 0).
  const blockMinutes = Math.floor(BLOCK_MS / 60000);
  const rows = await client<{ count: number; blocked_until: Date | null }[]>`
    INSERT INTO auth_attempts (key, count, blocked_until, updated_at)
    VALUES (${key}, 1, NULL, NOW())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN auth_attempts.count + 1 >= ${MAX_ATTEMPTS} THEN 0
        ELSE auth_attempts.count + 1
      END,
      blocked_until = CASE
        WHEN auth_attempts.count + 1 >= ${MAX_ATTEMPTS}
          THEN NOW() + make_interval(mins => ${blockMinutes})
        ELSE auth_attempts.blocked_until
      END,
      updated_at = NOW()
    RETURNING count, blocked_until
  `;
  const result = rows[0];
  // count=0 означает, что мы только что заблокировали.
  if (result.count === 0 && result.blocked_until && result.blocked_until > new Date()) {
    return { left: 0, blocked: true };
  }
  return { left: MAX_ATTEMPTS - result.count, blocked: false };
}

/**
 * Сбрасывает счётчик попыток после успешного входа.
 * Удаляем строку целиком — это и обнуляет count, и снимает blocked_until.
 */
async function clearAttempts(key: string): Promise<void> {
  await client`DELETE FROM auth_attempts WHERE key = ${key}`;
}

export const authRouter = router({
  // Вход по PIN. Создаёт сессию, возвращает токен.
  // Клиент сохраняет токен в localStorage и шлёт его в Authorization
  // header при всех последующих запросах.
  login: publicProcedure
    .input(z.object({ pin: z.string().regex(/^\d{4}$/, "PIN — 4 цифры") }))
    .mutation(async ({ input, ctx }) => {
      const key = getKey(ctx.req.ip);

      const blockedMinutes = await checkBlocked(key);
      if (blockedMinutes !== null) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Слишком много попыток. Подождите ${blockedMinutes} мин.`,
        });
      }

      const rows = await client<{ id: number; pin_hash: string; name: string }[]>`
        SELECT id, pin_hash, name FROM users LIMIT 1
      `;

      // PIN хешируется bcrypt'ом (миграция 018). Используем bcrypt.compare —
      // оно constant-time, не позволяет timing-атаки.
      const user = rows[0];
      const valid = user ? await bcrypt.compare(input.pin, user.pin_hash) : false;

      if (!valid) {
        const result = await recordFailedAttempt(key);
        if (result.blocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Слишком много попыток. Подождите 30 мин.",
          });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `Неверный PIN-код. Осталось попыток: ${result.left}`,
        });
      }

      // Успешный вход — сбрасываем счётчик попыток и создаём сессию.
      await clearAttempts(key);
      const token = await createSession(user.id);
      return { userId: user.id, name: user.name, token };
    }),

  // Получить пользователя по ID. Публичная процедура — используется в
  // ServerWakeUp как health-check ДО логина. Возвращает только публичные
  // поля (id, name), PIN и прочее не отдаём.
  getUser: publicProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const rows = await client<{ id: number; name: string }[]>`
        SELECT id, name FROM users WHERE id = ${input.userId} LIMIT 1
      `;
      if (rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Пользователь не найден",
        });
      }
      return rows[0];
    }),

  // Смена PIN. Защищена: нужен валидный токен сессии (proof of life)
  // ПЛЮС текущий PIN (proof of knowledge). Это «двухфакторная» проверка
  // против ситуации «украли телефон с активной сессией → меняют PIN».
  changePin: protectedProcedure
    .input(
      z.object({
        currentPin: z.string().regex(/^\d{4}$/, "PIN — 4 цифры"),
        newPin: z.string().regex(/^\d{4}$/, "PIN — 4 цифры"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Проверяем текущий PIN именно у того пользователя, чья сессия.
      const rows = await client<{ id: number; pin_hash: string }[]>`
        SELECT id, pin_hash FROM users WHERE id = ${ctx.userId} LIMIT 1
      `;
      const user = rows[0];
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
      }
      const valid = await bcrypt.compare(input.currentPin, user.pin_hash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Текущий PIN неверный",
        });
      }
      const newHash = await bcrypt.hash(input.newPin, 10);
      // Обновляем pin_hash; колонку pin (plain) обновляем тем же значением,
      // что и newPin, чтобы NOT NULL constraint не сломался — после
      // следующей миграции, которая дропнет pin, эту строчку можно убрать.
      await client`
        UPDATE users
        SET pin_hash = ${newHash}, pin = ${input.newPin}
        WHERE id = ${user.id}
      `;
      // Удаляем все старые сессии этого пользователя — после смены PIN
      // безопаснее перелогинить везде. Текущая сессия тоже инвалидируется,
      // клиент должен обработать UNAUTHORIZED и перенаправить на /login.
      await client`DELETE FROM sessions WHERE user_id = ${user.id}`;
      return { ok: true };
    }),

  // Логаут. Удаляет текущую сессию из БД.
  // Клиент сам очищает localStorage. Если кто-то перехватил токен —
  // после logout он становится бесполезен.
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.token) {
      await client`DELETE FROM sessions WHERE token = ${ctx.token}`;
    }
    return { ok: true };
  }),

  // Текущий пользователь по сессии. Удобно для проверки «жива ли сессия»
  // на старте приложения и для отображения имени в UI.
  me: protectedProcedure.query(async ({ ctx }) => {
    const rows = await client<{ id: number; name: string }[]>`
      SELECT id, name FROM users WHERE id = ${ctx.userId} LIMIT 1
    `;
    if (rows.length === 0) {
      // Сессия ссылается на удалённого юзера — нештатно, но возможно.
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Пользователь не найден",
      });
    }
    return rows[0];
  }),
});
