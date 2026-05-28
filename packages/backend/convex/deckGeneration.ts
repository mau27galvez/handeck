import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { buildDeckTsvContent, DECK_TSV_VERSION, type DeckTsvRow } from "./deckTsv";
import { getOwnedTemplate, loadTemplateWordsForGeneration } from "./deckLib";

const deckModeValidator = v.union(v.literal("fresh"), v.literal("fromBase"));

export const createGenerationBundle = internalMutation({
  args: {
    templateId: v.id("templates"),
    useCache: v.boolean(),
    mode: deckModeValidator,
  },
  returns: v.object({
    profileId: v.id("profiles"),
    templateId: v.id("templates"),
    noteIds: v.array(v.id("notes")),
    tsvContent: v.string(),
    useCache: v.boolean(),
    configSnapshot: v.object({
      topics: v.array(v.string()),
      sentencesPerWord: v.number(),
    }),
  }),
  handler: async (ctx, { templateId, useCache, mode }) => {
    if (mode === "fromBase") {
      throw new Error("Generating from an existing deck is not supported yet");
    }

    const { template, profileId } = await getOwnedTemplate(ctx, templateId);
    const words = await loadTemplateWordsForGeneration(ctx, templateId);

    if (words.length === 0) {
      throw new Error("Add at least one word to the template before generating a deck");
    }

    const sentencesPerWord = template.configs.sentencesPerWord;
    const now = Date.now();
    const noteIds: Id<"notes">[] = [];
    const tsvRows: DeckTsvRow[] = [];

    for (const word of words) {
      for (let slotIndex = 0; slotIndex < sentencesPerWord; slotIndex++) {
        const sentenceId = await ctx.db.insert("sentences", {
          simplifiedHanzi: "",
          translation: "",
          audioUrl: null,
          createdAt: now,
          updatedAt: now,
        });

        const noteId = await ctx.db.insert("notes", {
          wordId: word._id,
          sentenceId,
          createdAt: now,
          updatedAt: now,
        });

        noteIds.push(noteId);
        tsvRows.push({
          noteId,
          hanzi: word.simplifiedHanzi,
          diacriticPinyin: word.diacriticPinyin,
          meaning: word.meaning,
        });
      }
    }

    return {
      profileId,
      templateId,
      noteIds,
      tsvContent: buildDeckTsvContent(tsvRows),
      useCache,
      configSnapshot: {
        topics: template.configs.topics,
        sentencesPerWord: template.configs.sentencesPerWord,
      },
    };
  },
});

export const finalizeDeck = internalMutation({
  args: {
    profileId: v.id("profiles"),
    templateId: v.id("templates"),
    noteIds: v.array(v.id("notes")),
    tsvStorageId: v.id("_storage"),
    useCache: v.boolean(),
    configSnapshot: v.object({
      topics: v.array(v.string()),
      sentencesPerWord: v.number(),
    }),
  },
  returns: v.object({
    deckId: v.id("decks"),
    noteCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const deckId = await ctx.db.insert("decks", {
      userId: args.profileId,
      templateId: args.templateId,
      noteIds: args.noteIds,
      tsvStorageId: args.tsvStorageId,
      tsvVersion: DECK_TSV_VERSION,
      configSnapshot: args.configSnapshot,
      useCache: args.useCache,
      mode: "fresh",
      createdAt: now,
      updatedAt: now,
    });

    return { deckId, noteCount: args.noteIds.length };
  },
});
