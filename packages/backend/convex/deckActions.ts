import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { CreateDeckResult, FinalizeDeckResult, GenerationBundle } from "./deckGenerationTypes";

export const create = action({
  args: {
    templateId: v.id("templates"),
  },
  returns: v.object({
    deckId: v.id("decks"),
    tsvStorageId: v.id("_storage"),
    noteCount: v.number(),
  }),
  handler: async (ctx, args): Promise<CreateDeckResult> => {
    const bundle: GenerationBundle = await ctx.runMutation(
      internal.deckGeneration.createGenerationBundle,
      args,
    );
    const tsvStorageId = await ctx.storage.store(
      new Blob([bundle.tsvContent], { type: "text/tab-separated-values;charset=utf-8" }),
    );
    const finalized: FinalizeDeckResult = await ctx.runMutation(
      internal.deckGeneration.finalizeDeck,
      {
        profileId: bundle.profileId,
        templateId: bundle.templateId,
        noteIds: bundle.noteIds,
        tsvStorageId,
      },
    );

    return {
      deckId: finalized.deckId,
      tsvStorageId,
      noteCount: finalized.noteCount,
    };
  },
});
