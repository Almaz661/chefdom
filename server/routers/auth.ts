import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { client } from "../db/index";

// Защита от перебора: 5 неверных попыток → блок на 30 минут.
// Счётчик в памяти процесса — сбрасывается при перезапуске сервера.
// Для домашнего приложения этого достаточно.
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 30 * 60 * 1000;

interface AttemptState {
  count: number;
  blockedUntil: number;
}

const attempts = new Map<string, AttemptState>();

function getKey(ip: string | undefined): string {
  return ip || "unknown";
}

export const authRouter = router({
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

      // Успешный вход — сбрасываем счётчик
      attempts.delete(key);
      const user = rows[0];
      return { userId: user.id, name: user.name };
    }),

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

  // Смена PIN (раздел 14.2 плана)
  changePin: publicProcedure
    .input(
      z.object({
        currentPin: z.string().regex(/^\d{4}$/, "PIN — 4 цифры"),
        newPin: z.string().regex(/^\d{4}$/, "PIN — 4 цифры"),
      })
    )
    .mutation(async ({ input }) => {
      // Проверяем текущий PIN
      const rows = await client<{ id: number }[]>`
        SELECT id FROM users WHERE pin = ${input.currentPin} LIMIT 1
      `;
      if (rows.length === 0) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Текущий PIN неверный",
        });
      }
      // Обновляем PIN
      await client`
        UPDATE users SET pin = ${input.newPin} WHERE id = ${rows[0].id}
      `;
      return { ok: true };
    }),
});
