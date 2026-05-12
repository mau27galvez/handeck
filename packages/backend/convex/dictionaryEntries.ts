import { v } from "convex/values";

import { mutation } from "./_generated/server";

const dictionaryEntry = v.object({
  simplifiedHanzi: v.string(),
  numberedPinyin: v.string(),
  diacriticPinyin: v.string(),
  normalizedPinyin: v.string(),
  meaning: v.string(),
});
const maxImportBatchSize = 500;

export const insertBatch = mutation({
  args: {
    importToken: v.string(),
    entries: v.array(dictionaryEntry),
  },
  handler: async (ctx, args) => {
    validateImportToken(args.importToken);

    if (args.entries.length > maxImportBatchSize) {
      throw new Error(`Import batches cannot contain more than ${maxImportBatchSize} entries.`);
    }

    for (const entry of args.entries) {
      await ctx.db.insert("dictionary_entry", entry);
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

    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 200), 1), maxImportBatchSize);
    const existingEntries = await ctx.db.query("dictionary_entry").take(limit);

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
