import { router } from "../trpc";
import { authRouter } from "./auth";
import { recipesRouter } from "./recipes";
import { menuRouter } from "./menu";
import { shoppingRouter } from "./shopping";

export const appRouter = router({
  auth: authRouter,
  recipes: recipesRouter,
  menu: menuRouter,
  shopping: shoppingRouter,
});

export type AppRouter = typeof appRouter;
