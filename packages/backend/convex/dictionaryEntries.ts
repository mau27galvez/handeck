import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const dictionaryEntry = v.object({
  simplifiedHanzi: v.string(),
  numberedPinyin: v.string(),
  diacriticPinyin: v.string(),
  normalizedPinyin: v.string(),
  meaning: v.string(),
});
const MAX_IMPORT_BATCH_SIZE = 500;
const MAX_SEARCH_RESULTS = 50;

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalizedQuery = normalizePinyinQuery(args.query);
    if (!normalizedQuery) {
      return [];
    }

    const limit = Math.min(
      Math.max(Math.trunc(args.limit ?? MAX_SEARCH_RESULTS), 1),
      MAX_SEARCH_RESULTS,
    );

    return await ctx.db
      .query("dictionaryEntry")
      .withIndex("by_normalizedPinyin", (q) =>
        q
          .gte("normalizedPinyin", normalizedQuery)
          .lt("normalizedPinyin", `${normalizedQuery}\uffff`),
      )
      .take(limit);
  },
});

function normalizePinyinQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((syllable) => syllable.replace(/[1-5]$/, "").replace(/u:/gi, "ü"))
    .join(" ")
    .toLowerCase();
}

export const insertBatch = mutation({
  args: {
    importToken: v.string(),
    entries: v.array(dictionaryEntry),
  },
  handler: async (ctx, args) => {
    validateImportToken(args.importToken);

    if (args.entries.length > MAX_IMPORT_BATCH_SIZE) {
      throw new Error(`Import batches cannot contain more than ${MAX_IMPORT_BATCH_SIZE} entries.`);
    }

    for (const entry of args.entries) {
      await ctx.db.insert("dictionaryEntry", entry);
    }

    return { inserted: args.entries.length };
  },
});

export const clearBatch = mutation({
  args: {
    importToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    validateImportToken(args.importToken);

    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 200), 1), MAX_IMPORT_BATCH_SIZE);
    const existingEntries = await ctx.db.query("dictionaryEntry").take(limit);

    for (const entry of existingEntries) {
      await ctx.db.delete(entry._id);
    }

    return {
      deleted: existingEntries.length,
      isDone: existingEntries.length < limit,
    };
  },
});

function validateImportToken(importToken: string) {
  const expectedToken = process.env.CEDICT_IMPORT_TOKEN;

  if (!expectedToken) {
    throw new Error("Set CEDICT_IMPORT_TOKEN in Convex before importing CEDICT.");
  }

  if (importToken !== expectedToken) {
    throw new Error("Invalid CEDICT import token.");
  }
}
