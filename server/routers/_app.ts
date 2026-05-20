import { router } from "../trpc";
import { authRouter } from "./auth";
import { recipesRouter } from "./recipes";
import { menuRouter } from "./menu";

export const appRouter = router({
  auth: authRouter,
  recipes: recipesRouter,
  menu: menuRouter,
});

export type AppRouter = typeof appRouter;
