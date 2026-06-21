import { db } from "@handeck/db";
import { decksTable, templatesTable } from "@handeck/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { buildDeckFromTemplate } from "../../buildDeckFromTemplate";
import { getDeckDownloadFilename, getDeckDownloadUrl, getDeckObjectKey } from "../../deckStorage";
import { protectedProcedure } from "../../index";
import { getOwnedTemplate } from "../templates/template-use-cases";
import { getOwnedDeckWithTemplate } from "./deck-use-cases";

export const deckRouter = {
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
      const deck = await getOwnedDeckWithTemplate(input.deckId, userId);

      const filename = getDeckDownloadFilename(deck.template.name);
      const url = await getDeckDownloadUrl(getDeckObjectKey(userId, deck.id), filename);

      return url;
    }),
};
