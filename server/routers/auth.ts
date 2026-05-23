import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { client } from "../db/index";

// Защита от перебора: 5 неверных попыток → блок на 30 минут.
// Счётчик в памяти процесса — сбрасывается при перезапуске сервера.
// На Render Free сервер засыпает каждые 15 мин, поэтому это слабая защита;
// в будущей итерации перенесём счётчик в БД (TODO в аудите).
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 30 * 60 * 1000;

// Срок жизни сессии. 30 дней — соответствует TTL клиентского localStorage.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface AttemptState {
  count: number;
  blockedUntil: number;
}

const attempts = new Map<string, AttemptState>();

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

export const authRouter = router({
  // Вход по PIN. Создаёт сессию, возвращает токен.
  // Клиент сохраняет токен в localStorage и шлёт его в Authorization
  // header при всех последующих запросах.
  login: publicProcedure
    .input(z.object({ pin: z.string().regex(/^\d{4}$/, "PIN — 4 цифры") }))
    .mutation(async ({ input, ctx }) => {
      const key = getKey(ctx.req.ip);
      const now = Date.now();
      const state = attempts.get(key) ?? { count: 0, blockedUntil: 0 };

      if (state.blockedUntil > now) {
        const minutesLeft = Math.ceil((state.blockedUntil - now) / 60000);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Слишком много попыток. Подождите ${minutesLeft} мин.`,
        });
      }

      const rows = await client<{ id: number; pin: string; name: string }[]>`
        SELECT id, pin, name FROM users WHERE pin = ${input.pin} LIMIT 1
      `;

      if (rows.length === 0) {
        const newCount = state.count + 1;
        if (newCount >= MAX_ATTEMPTS) {
          attempts.set(key, { count: 0, blockedUntil: now + BLOCK_MS });
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Слишком много попыток. Подождите 30 мин.",
          });
        }
        attempts.set(key, { count: newCount, blockedUntil: 0 });
        const left = MAX_ATTEMPTS - newCount;
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `Неверный PIN-код. Осталось попыток: ${left}`,
        });
      }

      // Успешный вход — сбрасываем счётчик попыток и создаём сессию.
      attempts.delete(key);
      const user = rows[0];
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
      // Без AND user_id = ctx.userId был бы баг: знаешь чужой PIN —
      // меняешь его (но это меняло бы поле в той же строке, так что
      // практически безвредно для одного юзера; всё равно сделаем строго).
      const rows = await client<{ id: number }[]>`
        SELECT id FROM users
        WHERE id = ${ctx.userId} AND pin = ${input.currentPin}
        LIMIT 1
      `;
      if (rows.length === 0) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Текущий PIN неверный",
        });
      }
      await client`
        UPDATE users SET pin = ${input.newPin} WHERE id = ${rows[0].id}
      `;
      // Удаляем все старые сессии этого пользователя — после смены PIN
      // безопаснее перелогинить везде. Текущая сессия тоже инвалидируется,
      // клиент должен обработать UNAUTHORIZED и перенаправить на /login.
      await client`DELETE FROM sessions WHERE user_id = ${rows[0].id}`;
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
