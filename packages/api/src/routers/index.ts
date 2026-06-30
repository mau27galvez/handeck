import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { billingRouter } from "../modules/billing/billing-router";
import { deckRouter } from "../modules/decks/deck-router";
import { templateRouter } from "../modules/templates/template-router";
import { vocabPackRouter } from "../modules/vocab-packs/vocab-pack-router";
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

  billing: billingRouter,
  deck: deckRouter,
  word: wordRouter,
  template: templateRouter,
  vocabPack: vocabPackRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
