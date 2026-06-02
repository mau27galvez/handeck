import { v } from "convex/values";
import type { WorkflowId } from "@convex-dev/workflow";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { getProfileIdForAuthUser } from "./profile";
import { workflow } from "./workflows";

const TSV_VERSION = "1";
const TSV_HEADERS = [
  "tsvVersion",
  "noteId",
  "hanzi",
  "diacriticPinyin",
  "meaning",
  "sentenceHanzi",
  "sentenceTranslation",
] as const;

type DeckTsvData = {
  deck: Pick<Doc<"decks">, "_id" | "templateId" | "userId">;
  notes: Array<{
    noteId: Id<"notes">;
    word: Pick<Doc<"words">, "simplifiedHanzi" | "diacriticPinyin" | "meaning">;
    sentence: Pick<Doc<"sentences">, "simplifiedHanzi" | "translation"> | null;
  }>;
};

async function getOwnedTemplate(ctx: MutationCtx, templateId: Id<"templates">) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) throw new Error("Not authenticated");

  const profileId = await getProfileIdForAuthUser(ctx, authUser);
  if (!profileId) throw new Error("Not authenticated");

  const template = await ctx.db.get(templateId);
  if (!template || template.userId !== profileId) {
    throw new Error("Template not found");
  }

  return { profileId, template };
}

function normalizeTsvField(value: string) {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

function toTsvRow(fields: readonly string[]) {
  return fields.map(normalizeTsvField).join("\t");
}

function parseTsvData(data: DeckTsvData) {
  const rows = data.notes.map((note) =>
    toTsvRow([
      TSV_VERSION,
      note.noteId,
      note.word.simplifiedHanzi,
      note.word.diacriticPinyin,
      note.word.meaning,
      note.sentence?.simplifiedHanzi ?? "",
      note.sentence?.translation ?? "",
    ]),
  );

  return [toTsvRow(TSV_HEADERS), ...rows].join("\n");
}

export const generateDeck = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }): Promise<{ workflowId: WorkflowId }> => {
    const { profileId } = await getOwnedTemplate(ctx, templateId);
    const firstTemplateWord = await ctx.db
      .query("templateWords")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .first();

    if (!firstTemplateWord) {
      throw new Error("Add at least one word before generating a deck");
    }

    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.deckGeneration.generateDeckWorkflow,
      {
        templateId,
        userId: profileId,
      },
      { startAsync: true },
    );

    return { workflowId };
  },
});

export const generateDeckWorkflow = workflow
  .define({
    args: {
      templateId: v.id("templates"),
      userId: v.id("profiles"),
    },
    returns: v.object({
      deckId: v.id("decks"),
      noteCount: v.number(),
      tsvFileId: v.id("_storage"),
    }),
  })
  .handler(async (step, { templateId, userId }) => {
    const deckId: Id<"decks"> = await step.runMutation(
      internal.deckGeneration.writeDeck,
      { templateId, userId },
      { name: "writeDeck" },
    );
    const noteCount: number = await step.runMutation(
      internal.deckGeneration.writeNotes,
      { deckId },
      { name: "writeNotes" },
    );
    const tsvFileId: Id<"_storage"> = await step.runAction(
      internal.deckGeneration.writeTsvData,
      { deckId },
      { name: "writeTsvData" },
    );

    return { deckId, noteCount, tsvFileId };
  });

export const writeDeck = internalMutation({
  args: {
    templateId: v.id("templates"),
    userId: v.id("profiles"),
  },
  handler: async (ctx, { templateId, userId }) => {
    const template = await ctx.db.get(templateId);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found");
    }

    const now = Date.now();
    return await ctx.db.insert("decks", {
      userId,
      templateId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const writeNotes = internalMutation({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) throw new Error("Deck not found");

    const now = Date.now();
    let noteCount = 0;

    for await (const templateWord of ctx.db
      .query("templateWords")
      .withIndex("by_template", (q) => q.eq("templateId", deck.templateId))) {
      const word = await ctx.db.get(templateWord.wordId);
      if (!word) throw new Error("Template contains a missing word");

      await ctx.db.insert("notes", {
        deckId,
        wordId: templateWord.wordId,
        sentenceId: null,
        createdAt: now,
        updatedAt: now,
      });
      noteCount += 1;
    }

    if (noteCount === 0) {
      throw new Error("Add at least one word before generating a deck");
    }

    return noteCount;
  },
});

export const getDeckData = internalQuery({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) throw new Error("Deck not found");

    const notes = [];
    for await (const note of ctx.db
      .query("notes")
      .withIndex("by_deckId", (q) => q.eq("deckId", deckId))) {
      const word = await ctx.db.get(note.wordId);
      if (!word) throw new Error("Note references a missing word");

      const sentence = note.sentenceId ? await ctx.db.get(note.sentenceId) : null;
      if (note.sentenceId && !sentence) {
        throw new Error("Note references a missing sentence");
      }

      notes.push({
        noteId: note._id,
        word: {
          simplifiedHanzi: word.simplifiedHanzi,
          diacriticPinyin: word.diacriticPinyin,
          meaning: word.meaning,
        },
        sentence: sentence
          ? {
              simplifiedHanzi: sentence.simplifiedHanzi,
              translation: sentence.translation,
            }
          : null,
      });
    }

    return {
      deck: {
        _id: deck._id,
        templateId: deck.templateId,
        userId: deck.userId,
      },
      notes,
    };
  },
});

export const writeTsvData = internalAction({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const deckData: DeckTsvData = await ctx.runQuery(internal.deckGeneration.getDeckData, {
      deckId,
    });
    const tsvData = parseTsvData(deckData);
    const tsvFileId = await ctx.storage.store(
      new Blob([tsvData], { type: "text/tab-separated-values;charset=utf-8" }),
    );

    await ctx.runMutation(internal.deckGeneration.writeDeckTsvFile, {
      deckId,
      tsvFileId,
    });

    return tsvFileId;
  },
});

export const writeDeckTsvFile = internalMutation({
  args: {
    deckId: v.id("decks"),
    tsvFileId: v.id("_storage"),
  },
  handler: async (ctx, { deckId, tsvFileId }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) throw new Error("Deck not found");

    await ctx.db.patch(deckId, {
      tsvFileId,
      updatedAt: Date.now(),
    });
  },
});
