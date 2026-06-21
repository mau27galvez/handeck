import { db } from "@handeck/db";
import { wordsTable } from "@handeck/db/schema";
import { inArray } from "drizzle-orm";
import { v4 } from "uuid";
import { z } from "zod";

import { parseDictionarySearchQuery } from "../../dictionarySearch";
import { publicProcedure } from "../../index";
import { MAX_SEARCH_RESULTS, searchLatin, searchMixed, searchSimplified } from "./word-search";
import { MAX_IMPORT_BATCH_SIZE, validateImportToken } from "./word-use-cases";

const wordFieldsSchema = z.object({
  simplifiedHanzi: z.string(),
  numberedPinyin: z.string(),
  diacriticPinyin: z.string(),
  normalizedPinyin: z.string(),
  numberedPinyinSearch: z.string(),
  pinyinSyllables: z.array(z.string()),
  numberedPinyinSyllables: z.array(z.string()),
  meaning: z.string(),
});

export const wordRouter = {
  search: publicProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const limit = Math.min(
        Math.max(Math.trunc(input.limit ?? MAX_SEARCH_RESULTS), 1),
        MAX_SEARCH_RESULTS,
      );
      const parsedQuery = parseDictionarySearchQuery(input.query);

      switch (parsedQuery.kind) {
        case "unsupported":
          return [];
        case "simplified":
          return await searchSimplified(parsedQuery.value, limit);
        case "latin":
          return await searchLatin(parsedQuery.pinyin, parsedQuery.englishQuery, limit);
        case "mixed":
          return await searchMixed(parsedQuery.tokens, limit);
      }
    }),

  insertBatch: publicProcedure
    .input(
      z.object({
        importToken: z.string(),
        entries: z.array(wordFieldsSchema),
      }),
    )
    .handler(async ({ input }) => {
      validateImportToken(input.importToken);

      if (input.entries.length > MAX_IMPORT_BATCH_SIZE) {
        throw new Error(
          `Import batches cannot contain more than $
        {MAX_IMPORT_BATCH_SIZE} entries.`,
        );
      }

      const now = new Date();
      await db.insert(wordsTable).values(
        input.entries.map((entry) => ({
          id: v4(),
          ...entry,
          audioUrl: null,
          createdAt: now,
          updatedAt: now,
        })),
      );

      return { inserted: input.entries.length };
    }),

  clearBatch: publicProcedure
    .input(
      z.object({
        importToken: z.string(),
        limit: z.number().optional(),
      }),
    )
    .handler(async ({ input }) => {
      validateImportToken(input.importToken);

      const limit = Math.min(Math.max(Math.trunc(input.limit ?? 200), 1), MAX_IMPORT_BATCH_SIZE);
      const existingEntries = await db.select({ id: wordsTable.id }).from(wordsTable).limit(limit);
      if (existingEntries.length > 0) {
        await db.delete(wordsTable).where(
          inArray(
            wordsTable.id,
            existingEntries.map((entry) => entry.id),
          ),
        );
      }

      return {
        deleted: existingEntries.length,
        isDone: existingEntries.length < limit,
      };
    }),
};
