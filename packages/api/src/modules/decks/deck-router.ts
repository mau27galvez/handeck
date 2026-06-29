import { db } from "@handeck/db";
import { decksTable } from "@handeck/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { buildDeckFromTemplate } from "../../buildDeckFromTemplate";
import { getDeckDownloadFilename, getDeckDownloadUrl, getDeckObjectKey } from "../../deckStorage";
import { protectedProcedure } from "../../index";
import { getDeckGenerationProgressRatio } from "./deck-progress";
import { getOwnedDeckWithTemplate } from "./deck-use-cases";

export const deckRouter = {
  listForCurrentUser: protectedProcedure.handler(async ({ context }) => {
    const decks = await db.query.decksTable.findMany({
      where: eq(decksTable.userId, context.session.user.id),
      orderBy: desc(decksTable.createdAt),
      with: {
        template: true,
        generationJob: true,
      },
    });

    return decks.map((deck) => {
      return {
        id: deck.id,
        templateId: deck.templateId,
        templateName: deck.template.name,
        createdAt: deck.createdAt,
        status: deck.status,
        error: deck.error,
        progress: getDeckGenerationProgressRatio({
          status: deck.status,
          sentenceBatchTotal: deck.generationJob?.sentenceBatchTotal ?? 0,
          sentenceBatchCompleted: deck.generationJob?.sentenceBatchCompleted ?? 0,
          sentenceAudioTotal: deck.generationJob?.sentenceAudioTotal ?? 0,
          sentenceAudioCompleted: deck.generationJob?.sentenceAudioCompleted ?? 0,
          wordAudioTotal: deck.generationJob?.wordAudioTotal ?? 0,
          wordAudioCompleted: deck.generationJob?.wordAudioCompleted ?? 0,
        }),
      };
    });
  }),

  buildFromTemplate: protectedProcedure
    .input(z.object({ deckId: z.uuid(), templateId: z.uuid() }))
    .handler(async ({ input, context }) => {
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
      if (deck.status !== "completed") {
        throw new Error("Deck is still generating");
      }

      const filename = getDeckDownloadFilename(deck.template.name);
      const url = await getDeckDownloadUrl(getDeckObjectKey(userId, deck.id), filename);

      return url;
    }),
};
