import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { baseTemplateRouter } from "../modules/base-templates/base-template-router";
import { billingRouter } from "../modules/billing/billing-router";
import { deckRouter } from "../modules/decks/deck-router";
import { templateRouter } from "../modules/templates/template-router";
import { wordRouter } from "../modules/words/word-router";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),

  auth: {
    getSession: publicProcedure.handler(({ context }) => {
      return context.session;
    }),

    getCurrentUser: protectedProcedure.handler(({ context }) => {
      return context.session.user;
    }),
  },

  baseTemplate: baseTemplateRouter,
  billing: billingRouter,
  deck: deckRouter,
  word: wordRouter,
  template: templateRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
