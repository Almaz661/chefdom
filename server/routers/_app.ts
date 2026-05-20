import { router } from "../trpc";
import { authRouter } from "./auth";
import { recipesRouter } from "./recipes";
import { menuRouter } from "./menu";
import { shoppingRouter } from "./shopping";
import { inventoryRouter } from "./inventory";

export const appRouter = router({
  auth: authRouter,
  recipes: recipesRouter,
  menu: menuRouter,
  shopping: shoppingRouter,
  inventory: inventoryRouter,
});

export type AppRouter = typeof appRouter;
