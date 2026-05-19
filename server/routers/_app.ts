import { router } from "../trpc";
import { authRouter } from "./auth";
import { recipesRouter } from "./recipes";

export const appRouter = router({
  auth: authRouter,
  recipes: recipesRouter,
});

export type AppRouter = typeof appRouter;
