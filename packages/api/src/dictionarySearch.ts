export type PinyinSearch = {
  normalizedPinyin: string;
  numberedPinyinSearch: string;
  hasToneNumbers: boolean;
};

export type MixedSearchToken =
  | { kind: "han"; value: string }
  | { kind: "pinyin"; value: PinyinSearch };

export type DictionarySearchQuery =
  | { kind: "unsupported" }
  | { kind: "simplified"; value: string }
  | { kind: "latin"; englishQuery: string; pinyin: PinyinSearch | null }
  | { kind: "mixed"; tokens: MixedSearchToken[] };

const HAN_REGEX = /\p{Script=Han}/u;
const ZHUYIN_REGEX = /[\u3100-\u312f\u31a0-\u31bf]/u;
const PINYIN_TONE_MARK_REGEX = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛüÜ]/u;
const WILDCARD_REGEX = /[@$]/;
const FULL_TEXT_PREFIX = "#";
const PINYIN_INPUT_REGEX = /^[a-zA-ZvV1-5\s'-]+$/;

export function parseDictionarySearchQuery(rawQuery: string): DictionarySearchQuery {
  const query = rawQuery.trim().replace(/\s+/g, " ");
  if (!query || isUnsupportedSearchInput(query)) {
    return { kind: "unsupported" };
  }

  if (!HAN_REGEX.test(query)) {
    return {
      kind: "latin",
      englishQuery: query,
      pinyin: normalizePinyinSearchInput(query),
    };
  }

  const compactQuery = query.replace(/\s+/g, "");
  if (Array.from(compactQuery).every((character) => HAN_REGEX.test(character))) {
    return { kind: "simplified", value: compactQuery };
  }

  const tokens = tokenizeMixedSearchQuery(compactQuery);
  return tokens ? { kind: "mixed", tokens } : { kind: "unsupported" };
}

export function normalizePinyinSearchInput(input: string): PinyinSearch | null {
  if (!PINYIN_INPUT_REGEX.test(input) || PINYIN_TONE_MARK_REGEX.test(input)) {
    return null;
  }

  const compact = input.toLowerCase().replace(/[\s'-]+/g, "");
  if (!compact || !/[a-zv]/.test(compact) || /\d/.test(compact.replace(/[1-5]/g, ""))) {
    return null;
  }

  return {
    normalizedPinyin: compact.replace(/[1-5]/g, ""),
    numberedPinyinSearch: compact,
    hasToneNumbers: /[1-5]/.test(compact),
  };
}

function isUnsupportedSearchInput(query: string) {
  return (
    query.startsWith(FULL_TEXT_PREFIX) ||
    WILDCARD_REGEX.test(query) ||
    ZHUYIN_REGEX.test(query) ||
    PINYIN_TONE_MARK_REGEX.test(query)
  );
}

function tokenizeMixedSearchQuery(query: string): MixedSearchToken[] | null {
  const tokens: MixedSearchToken[] = [];
  let index = 0;

  while (index < query.length) {
    const character = query.charAt(index);
    if (HAN_REGEX.test(character)) {
      tokens.push({ kind: "han", value: character });
      index += 1;
      continue;
    }

    const pinyinMatch = query.slice(index).match(/^[a-zA-ZvV1-5'-]+/);
    if (!pinyinMatch) {
      return null;
    }

    const pinyin = normalizePinyinSearchInput(pinyinMatch[0]);
    if (!pinyin) {
      return null;
    }

    tokens.push({ kind: "pinyin", value: pinyin });
    index += pinyinMatch[0].length;
  }

  return tokens.some((token) => token.kind === "han") &&
    tokens.some((token) => token.kind === "pinyin")
    ? tokens
    : null;
}
