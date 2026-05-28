import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  findMatchingDeck,
  getOwnedTemplateForQuery,
  loadTemplateWordsForGeneration,
} from "./deckLib";

const ESTIMATED_KUAI_COST_PLACEHOLDER = 0;

export const getGenerationPreview = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    const owned = await getOwnedTemplateForQuery(ctx, templateId);
    if (!owned) return null;

    const { template, profileId } = owned;
    const words = await loadTemplateWordsForGeneration(ctx, templateId);
    const sentencesPerWord = template.configs.sentencesPerWord;
    const wordCount = words.length;
    const noteCount = wordCount * sentencesPerWord;

    const matchingDeck = await findMatchingDeck(ctx, templateId, profileId, template.configs);

    return {
      wordCount,
      noteCount,
      sentencesPerWord,
      estimatedKuaiCost: ESTIMATED_KUAI_COST_PLACEHOLDER,
      matchingDeckId: matchingDeck?._id ?? null,
      matchingDeckNoteCount: matchingDeck ? matchingDeck.noteIds.length : null,
    };
  },
});
