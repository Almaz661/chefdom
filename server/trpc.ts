import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

// Контекст: req/res доступны процедурам (нужны для PIN attempts по IP).
export function createContext({ req, res }: CreateExpressContextOptions) {
  return { req, res };
}

export type Context = ReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
