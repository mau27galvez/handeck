import { db } from "@handeck/db";
import { decksTable, templatesTable } from "@handeck/db/schema";
import type { RouterClient } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { buildDeckFromTemplate } from "../buildDeckFromTemplate";
import { getDeckDownloadFilename, getDeckDownloadUrl, getDeckObjectKey } from "../deckStorage";
import { protectedProcedure, publicProcedure } from "../index";
import { baseTemplateRouter } from "../modules/base-templates/base-template-router";
import { templateRouter } from "../modules/templates/template-router";
import { getOwnedTemplate } from "../modules/templates/template-use-cases";
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

  deck: {
    listForCurrentUser: protectedProcedure.handler(async ({ context }) => {
      return await db
        .select({
          id: decksTable.id,
          templateId: decksTable.templateId,
          templateName: templatesTable.name,
          createdAt: decksTable.createdAt,
        })
        .from(decksTable)
        .innerJoin(templatesTable, eq(decksTable.templateId, templatesTable.id))
        .where(eq(decksTable.userId, context.session.user.id))
        .orderBy(desc(decksTable.createdAt));
    }),

    buildFromTemplate: protectedProcedure
      .input(z.object({ deckId: z.uuid(), templateId: z.uuid() }))
      .handler(async ({ input, context }) => {
        await getOwnedTemplate(input.templateId, context.session.user.id);

        await buildDeckFromTemplate({
          deckId: input.deckId,
          templateId: input.templateId,
          userId: context.session.user.id,
        });
      }),

    getDownloadUrl: protectedProcedure
      .input(z.object({ deckId: z.uuid() }))
      .handler(async ({ input, context }) => {
        const userId = context.session.user.id;
        const deck = await db.query.decksTable.findFirst({
          where: and(eq(decksTable.id, input.deckId), eq(decksTable.userId, userId)),
          with: {
            template: true,
          },
        });

        if (!deck) throw new Error("Deck not found");

        const filename = getDeckDownloadFilename(deck.template.name);
        const url = await getDeckDownloadUrl(getDeckObjectKey(userId, deck.id), filename);

        return url;
      }),
  },

  word: wordRouter,

  template: templateRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
