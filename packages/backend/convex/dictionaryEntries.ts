import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import type { MixedSearchToken, PinyinSearch } from "./dictionarySearch";
import { parseDictionarySearchQuery } from "./dictionarySearch";
import { mutation, query } from "./_generated/server";

const dictionaryEntry = v.object({
  simplifiedHanzi: v.string(),
  numberedPinyin: v.string(),
  diacriticPinyin: v.string(),
  normalizedPinyin: v.string(),
  numberedPinyinSearch: v.string(),
  pinyinSyllables: v.array(v.string()),
  numberedPinyinSyllables: v.array(v.string()),
  meaning: v.string(),
});
const MAX_IMPORT_BATCH_SIZE = 500;
const MAX_SEARCH_RESULTS = 50;
const MAX_MIXED_SEARCH_CANDIDATES = 250;

type DictionaryEntry = Doc<"dictionaryEntry">;
type DictionarySearchResult = DictionaryEntry & {
  searchMatchType: "english" | "mixed" | "pinyin" | "simplified";
};

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(
      Math.max(Math.trunc(args.limit ?? MAX_SEARCH_RESULTS), 1),
      MAX_SEARCH_RESULTS,
    );
    const parsedQuery = parseDictionarySearchQuery(args.query);

    switch (parsedQuery.kind) {
      case "unsupported":
        return [];
      case "simplified":
        return await searchSimplified(ctx, parsedQuery.value, limit);
      case "latin":
        return await searchLatin(ctx, parsedQuery.pinyin, parsedQuery.englishQuery, limit);
      case "mixed":
        return await searchMixed(ctx, parsedQuery.tokens, limit);
    }
  },
});

async function searchSimplified(ctx: QueryCtx, simplifiedPrefix: string, limit: number) {
  return withSearchMatch(await querySimplifiedPrefix(ctx, simplifiedPrefix, limit), "simplified");
}

async function querySimplifiedPrefix(ctx: QueryCtx, simplifiedPrefix: string, limit: number) {
  return await ctx.db
    .query("dictionaryEntry")
    .withIndex("by_simplifiedHanzi", (q) =>
      q.gte("simplifiedHanzi", simplifiedPrefix).lt("simplifiedHanzi", `${simplifiedPrefix}\uffff`),
    )
    .take(limit);
}

async function searchLatin(
  ctx: QueryCtx,
  pinyin: PinyinSearch | null,
  englishQuery: string,
  limit: number,
) {
  const results: DictionarySearchResult[] = [];

  if (pinyin) {
    appendUnique(
      results,
      withSearchMatch(await queryPinyinPrefix(ctx, pinyin, limit), "pinyin"),
      limit,
    );
  }

  if (results.length < limit) {
    const englishResults = await ctx.db
      .query("dictionaryEntry")
      .withSearchIndex("search_meaning", (q) => q.search("meaning", englishQuery))
      .take(limit);
    appendUnique(results, withSearchMatch(englishResults, "english"), limit);
  }

  return results;
}

async function queryPinyinPrefix(ctx: QueryCtx, pinyin: PinyinSearch, limit: number) {
  if (pinyin.hasToneNumbers) {
    return await ctx.db
      .query("dictionaryEntry")
      .withIndex("by_numberedPinyinSearch", (q) =>
        q
          .gte("numberedPinyinSearch", pinyin.numberedPinyinSearch)
          .lt("numberedPinyinSearch", `${pinyin.numberedPinyinSearch}\uffff`),
      )
      .take(limit);
  }

  return await ctx.db
    .query("dictionaryEntry")
    .withIndex("by_normalizedPinyin", (q) =>
      q
        .gte("normalizedPinyin", pinyin.normalizedPinyin)
        .lt("normalizedPinyin", `${pinyin.normalizedPinyin}\uffff`),
    )
    .take(limit);
}

async function searchMixed(ctx: QueryCtx, tokens: MixedSearchToken[], limit: number) {
  const firstToken = tokens[0];
  if (!firstToken) {
    return [];
  }

  const candidates =
    firstToken.kind === "han"
      ? await querySimplifiedPrefix(ctx, firstHanPrefix(tokens), MAX_MIXED_SEARCH_CANDIDATES)
      : await queryPinyinPrefix(ctx, firstToken.value, MAX_MIXED_SEARCH_CANDIDATES);

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

function matchesMixedSearch(entry: DictionaryEntry, tokens: MixedSearchToken[]) {
  const hanzi = [...entry.simplifiedHanzi];
  return matchesMixedSearchFrom(entry, tokens, hanzi, 0, 0);
}

function matchesMixedSearchFrom(
  entry: DictionaryEntry,
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

function appendUnique(
  results: DictionarySearchResult[],
  additions: DictionarySearchResult[],
  limit: number,
) {
  const seen = new Set(results.map((entry) => entry._id));
  for (const entry of additions) {
    if (seen.has(entry._id)) {
      continue;
    }
    results.push(entry);
    seen.add(entry._id);
    if (results.length >= limit) {
      return;
    }
  }
}

function withSearchMatch(
  entries: DictionaryEntry[],
  searchMatchType: DictionarySearchResult["searchMatchType"],
) {
  return entries.map((entry) => ({ ...entry, searchMatchType }));
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
