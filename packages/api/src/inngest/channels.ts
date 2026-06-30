import { channel } from "inngest/realtime";
import { z } from "zod";

export const deckGenerationChannel = channel({
  name: (deckId: string) => `deck-generation:${deckId}`,
  topics: {
    progress: {
      schema: z.object({
        deckId: z.string(),
        status: z.enum(["queued", "generating", "completed", "failed"]),
        progress: z.number(),
        sentenceBatchTotal: z.number(),
        sentenceBatchCompleted: z.number(),
        sentenceAudioTotal: z.number(),
        sentenceAudioCompleted: z.number(),
        wordAudioTotal: z.number(),
        wordAudioCompleted: z.number(),
        error: z.string().nullable(),
        updatedAt: z.string(),
      }),
    },
  },
});
