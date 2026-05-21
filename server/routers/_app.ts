import { router } from "../trpc";
import { authRouter } from "./auth";
import { recipesRouter } from "./recipes";
import { menuRouter } from "./menu";
import { shoppingRouter } from "./shopping";
import { inventoryRouter } from "./inventory";
import { settingsRouter } from "./settings";

export const appRouter = router({
  auth: authRouter,
  recipes: recipesRouter,
  menu: menuRouter,
  shopping: shoppingRouter,
  inventory: inventoryRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
