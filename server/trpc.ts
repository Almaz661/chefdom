import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { client } from "./db/index";

// Контекст: req/res доступны процедурам.
// token — Bearer-токен из Authorization header (если есть). Извлекается
// один раз тут, валидация — в protectedProcedure middleware ниже.
export function createContext({ req, res }: CreateExpressContextOptions) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  return { req, res, token };
}

export type Context = ReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;

// Публичные процедуры — без проверки токена.
// Использовать ТОЛЬКО для:
//   - auth.login (нужен для входа)
//   - auth.getUser (используется как health-check в ServerWakeUp ДО логина)
// Всё остальное должно быть protectedProcedure.
export const publicProcedure = t.procedure;

// Защищённые процедуры — требуют валидный Bearer-токен из таблицы sessions.
// Если токена нет, истёк или отсутствует в БД — UNAUTHORIZED (HTTP 401).
// При успехе — кладёт userId в ctx, чтобы процедура могла его использовать
// (вместо хардкода userId=1, который сейчас разбросан по роутерам).
//
// До этого изменения ВСЕ процедуры были публичными — любой по URL
// мог вызвать settings.exportBackup или settings.importBackup и
// скачать/стереть всю БД. Теперь без логина не пройти никуда.
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Требуется авторизация. Войдите по PIN-коду.",
    });
  }

  // Один SELECT с проверкой срока действия — сессия валидна, если
  // expires_at > NOW(). Истёкшие сессии не подойдут даже если строка
  // ещё в таблице (фоновая чистка опциональна).
  const rows = await client<{ user_id: number }[]>`
    SELECT user_id
    FROM sessions
    WHERE token = ${ctx.token}
      AND expires_at > NOW()
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Сессия не найдена или истекла. Войдите заново.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: rows[0].user_id,
    },
  });
});
