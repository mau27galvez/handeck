import { db } from "@handeck/db";
import { decksTable, templatesTable, wordsTable } from "@handeck/db/schema";
import { env } from "@handeck/env/server";
import type { RouterClient } from "@orpc/server";
import { and, desc, eq, gte, ilike, inArray, lt } from "drizzle-orm";
import { v4 } from "uuid";
import { z } from "zod";

import { buildDeckFromTemplate } from "../buildDeckFromTemplate";
import { getDeckDownloadFilename, getDeckDownloadUrl, getDeckObjectKey } from "../deckStorage";
import { protectedProcedure, publicProcedure } from "../index";
import type { MixedSearchToken, PinyinSearch } from "../dictionarySearch";
import { parseDictionarySearchQuery } from "../dictionarySearch";
import { baseTemplateRouter } from "../modules/base-templates/base-template-router";
import { templateRouter } from "../modules/templates/template-router";
import { getOwnedTemplate } from "../modules/templates/template-use-cases";

const MAX_IMPORT_BATCH_SIZE = 500;
const MAX_SEARCH_RESULTS = 50;
const MAX_MIXED_SEARCH_CANDIDATES = 250;

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

type Word = typeof wordsTable.$inferSelect;
type WordSearchResult = Word & {
  searchMatchType: "english" | "mixed" | "pinyin" | "simplified";
};

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),

  auth: {
    getSession: publicProcedure.handler(({ context }) => {
      return context.session;
    }),

    getCurrentUser: protectedProcedure.handler(({ context }) => {
      return context.session.user;
    }),
  },

  baseTemplate: baseTemplateRouter,

  deck: {
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
        const deck = await db.query.decksTable.findFirst({
          where: and(eq(decksTable.id, input.deckId), eq(decksTable.userId, userId)),
          with: {
            template: true,
          },
        });

        if (!deck) throw new Error("Deck not found");

        const filename = getDeckDownloadFilename(deck.template.name);
        const url = await getDeckDownloadUrl(getDeckObjectKey(userId, deck.id), filename);

        return url;
      }),
  },

  word: {
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
            `Import batches cannot contain more than ${MAX_IMPORT_BATCH_SIZE} entries.`,
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
        const existingEntries = await db
          .select({ id: wordsTable.id })
          .from(wordsTable)
          .limit(limit);
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
  },

  template: templateRouter,
};

async function searchSimplified(simplifiedPrefix: string, limit: number) {
  return withSearchMatch(await querySimplifiedPrefix(simplifiedPrefix, limit), "simplified");
}

async function querySimplifiedPrefix(simplifiedPrefix: string, limit: number) {
  return await db
    .select()
    .from(wordsTable)
    .where(
      and(
        gte(wordsTable.simplifiedHanzi, simplifiedPrefix),
        lt(wordsTable.simplifiedHanzi, `${simplifiedPrefix}\uffff`),
      ),
    )
    .limit(limit);
}

async function searchLatin(pinyin: PinyinSearch | null, englishQuery: string, limit: number) {
  const results: WordSearchResult[] = [];

  if (pinyin) {
    appendUnique(results, withSearchMatch(await queryPinyinPrefix(pinyin, limit), "pinyin"), limit);
  }

  if (results.length < limit) {
    const englishResults = await db
      .select()
      .from(wordsTable)
      .where(ilike(wordsTable.meaning, `%${englishQuery}%`))
      .limit(limit);
    appendUnique(results, withSearchMatch(englishResults, "english"), limit);
  }

  return results;
}

async function queryPinyinPrefix(pinyin: PinyinSearch, limit: number) {
  if (pinyin.hasToneNumbers) {
    return await db
      .select()
      .from(wordsTable)
      .where(
        and(
          gte(wordsTable.numberedPinyinSearch, pinyin.numberedPinyinSearch),
          lt(wordsTable.numberedPinyinSearch, `${pinyin.numberedPinyinSearch}\uffff`),
        ),
      )
      .limit(limit);
  }

  return await db
    .select()
    .from(wordsTable)
    .where(
      and(
        gte(wordsTable.normalizedPinyin, pinyin.normalizedPinyin),
        lt(wordsTable.normalizedPinyin, `${pinyin.normalizedPinyin}\uffff`),
      ),
    )
    .limit(limit);
}

async function searchMixed(tokens: MixedSearchToken[], limit: number) {
  const firstToken = tokens[0];
  if (!firstToken) {
    return [];
  }

  const candidates =
    firstToken.kind === "han"
      ? await querySimplifiedPrefix(firstHanPrefix(tokens), MAX_MIXED_SEARCH_CANDIDATES)
      : await queryPinyinPrefix(firstToken.value, MAX_MIXED_SEARCH_CANDIDATES);

  return withSearchMatch(
    candidates.filter((entry) => matchesMixedSearch(entry, tokens)).slice(0, limit),
    "mixed",
  );
}

function firstHanPrefix(tokens: MixedSearchToken[]) {
  const firstNonHanIndex = tokens.findIndex((token) => token.kind !== "han");
  const endIndex = firstNonHanIndex === -1 ? tokens.length : firstNonHanIndex;
  return tokens
    .slice(0, endIndex)
    .filter((token): token is Extract<MixedSearchToken, { kind: "han" }> => token.kind === "han")
    .map((token) => token.value)
    .join("");
}

function matchesMixedSearch(entry: Word, tokens: MixedSearchToken[]) {
  const hanzi = [...entry.simplifiedHanzi];
  return matchesMixedSearchFrom(entry, tokens, hanzi, 0, 0);
}

function matchesMixedSearchFrom(
  entry: Word,
  tokens: MixedSearchToken[],
  hanzi: string[],
  tokenIndex: number,
  syllableIndex: number,
): boolean {
  const token = tokens[tokenIndex];
  if (!token) {
    return true;
  }

  if (token.kind === "han") {
    return (
      hanzi[syllableIndex] === token.value &&
      matchesMixedSearchFrom(entry, tokens, hanzi, tokenIndex + 1, syllableIndex + 1)
    );
  }

  const syllables = token.value.hasToneNumbers
    ? entry.numberedPinyinSyllables
    : entry.pinyinSyllables;
  for (let endIndex = syllableIndex + 1; endIndex <= syllables.length; endIndex += 1) {
    const segment = syllables.slice(syllableIndex, endIndex).join("");
    if (
      segment.startsWith(
        token.value.hasToneNumbers
          ? token.value.numberedPinyinSearch
          : token.value.normalizedPinyin,
      ) &&
      matchesMixedSearchFrom(entry, tokens, hanzi, tokenIndex + 1, endIndex)
    ) {
      return true;
    }
  }

  return false;
}

function appendUnique(results: WordSearchResult[], additions: WordSearchResult[], limit: number) {
  const seen = new Set(results.map((entry) => entry.id));
  for (const entry of additions) {
    if (seen.has(entry.id)) {
      continue;
    }
    results.push(entry);
    seen.add(entry.id);
    if (results.length >= limit) {
      return;
    }
  }
}

function withSearchMatch(entries: Word[], searchMatchType: WordSearchResult["searchMatchType"]) {
  return entries.map((entry) => ({ ...entry, searchMatchType }));
}

function validateImportToken(importToken: string) {
  const expectedToken = env.CEDICT_IMPORT_TOKEN;

  if (!expectedToken) {
    throw new Error("Set CEDICT_IMPORT_TOKEN before importing CEDICT.");
  }

  if (importToken !== expectedToken) {
    throw new Error("Invalid CEDICT import token.");
  }
}

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
