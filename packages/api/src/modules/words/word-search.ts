import { db } from "@handeck/db";
import { wordsTable } from "@handeck/db/schema";
import { and, gte, ilike, lt } from "drizzle-orm";

import type { MixedSearchToken, PinyinSearch } from "../../dictionarySearch";

export const MAX_SEARCH_RESULTS = 50;
const MAX_MIXED_SEARCH_CANDIDATES = 250;

type Word = typeof wordsTable.$inferSelect;
export type WordSearchResult = Word & {
  searchMatchType: "english" | "mixed" | "pinyin" | "simplified";
};

export async function searchSimplified(simplifiedPrefix: string, limit: number) {
  return withSearchMatch(await querySimplifiedPrefix(simplifiedPrefix, limit), "simplified");
}

export async function searchLatin(
  pinyin: PinyinSearch | null,
  englishQuery: string,
  limit: number,
) {
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

export async function searchMixed(tokens: MixedSearchToken[], limit: number) {
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
