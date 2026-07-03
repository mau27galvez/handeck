import { describe, expect, test } from "bun:test";

import {
  isVariantOfDictionaryEntry,
  NON_VARIANT_MEANING_LIKE_PATTERN,
  pickMatchingWordsByReferences,
  resolveReferencesToDictionaryWords,
} from "../src/modules/vocab-packs/vocab-pack-word-matching";

describe("isVariantOfDictionaryEntry", () => {
  test("detects variant-of dictionary entries", () => {
    expect(isVariantOfDictionaryEntry("variant of 岸[àn]")).toBe(true);
    expect(isVariantOfDictionaryEntry("  Variant of 参[cān]")).toBe(true);
  });

  test("does not treat regular entries as variants", () => {
    expect(isVariantOfDictionaryEntry("bank; shore; beach; coast")).toBe(false);
    expect(isVariantOfDictionaryEntry("to collapse; variant of 毙[bì]")).toBe(false);
  });

  test("matches the SQL not-like pattern used for vocab pack lookup", () => {
    expect(NON_VARIANT_MEANING_LIKE_PATTERN).toBe("variant of%");
    expect(isVariantOfDictionaryEntry("variant of 岸[àn]")).toBe(true);
    expect(isVariantOfDictionaryEntry("  Variant of 参[cān]")).toBe(true);
  });
});

describe("resolveReferencesToDictionaryWords", () => {
  test("matches words by hanzi and numbered pinyin search when hanzi is ambiguous", () => {
    const candidates = [
      {
        id: "1",
        simplifiedHanzi: "你好",
        numberedPinyinSearch: "ni3hao3",
        meaning: "hello; hi",
      },
      {
        id: "2",
        simplifiedHanzi: "岸",
        numberedPinyinSearch: "an4",
        meaning: "bank; shore; beach; coast",
      },
    ];

    expect(
      resolveReferencesToDictionaryWords(candidates, [
        { simplifiedHanzi: "岸", numberedPinyinSearch: "an4" },
      ]),
    ).toEqual({
      matchingWords: [candidates[1]],
      missingWords: [],
    });
  });

  test("matches by hanzi alone when the dictionary reading is unambiguous", () => {
    const dictionaryEntry = {
      id: "bu4ke4qi5",
      simplifiedHanzi: "不客气",
      numberedPinyinSearch: "bu4ke4qi5",
      meaning: "you're welcome; don't mention it",
    };

    expect(
      resolveReferencesToDictionaryWords(
        [dictionaryEntry],
        [{ simplifiedHanzi: "不客气", numberedPinyinSearch: "bu2ke4qi5" }],
      ),
    ).toEqual({
      matchingWords: [dictionaryEntry],
      missingWords: [],
    });
  });

  test("requires pinyin when the same hanzi has multiple readings", () => {
    const hao3 = {
      id: "hao3",
      simplifiedHanzi: "好",
      numberedPinyinSearch: "hao3",
      meaning: "good",
    };
    const hao4 = {
      id: "hao4",
      simplifiedHanzi: "好",
      numberedPinyinSearch: "hao4",
      meaning: "to be fond of",
    };

    expect(
      resolveReferencesToDictionaryWords(
        [hao3, hao4],
        [{ simplifiedHanzi: "好", numberedPinyinSearch: "hao3" }],
      ),
    ).toEqual({
      matchingWords: [hao3],
      missingWords: [],
    });

    expect(
      resolveReferencesToDictionaryWords(
        [hao3, hao4],
        [{ simplifiedHanzi: "好", numberedPinyinSearch: "hao2" }],
      ),
    ).toEqual({
      matchingWords: [],
      missingWords: [{ simplifiedHanzi: "好", numberedPinyinSearch: "hao2" }],
    });
  });

  test("rejects variant-of entries when a main entry exists", () => {
    const variant = {
      id: "variant",
      simplifiedHanzi: "岸",
      numberedPinyinSearch: "an4",
      meaning: "variant of 岸[àn]",
    };
    const main = {
      id: "main",
      simplifiedHanzi: "岸",
      numberedPinyinSearch: "an4",
      meaning: "bank; shore; beach; coast",
    };

    expect(
      resolveReferencesToDictionaryWords(
        [variant, main],
        [{ simplifiedHanzi: "岸", numberedPinyinSearch: "an4" }],
      ),
    ).toEqual({
      matchingWords: [main],
      missingWords: [],
    });
  });

  test("returns no matches when only variant-of entries match", () => {
    expect(
      resolveReferencesToDictionaryWords(
        [
          {
            id: "variant",
            simplifiedHanzi: "岸",
            numberedPinyinSearch: "an4",
            meaning: "variant of 岸[àn]",
          },
        ],
        [{ simplifiedHanzi: "岸", numberedPinyinSearch: "an4" }],
      ),
    ).toEqual({
      matchingWords: [],
      missingWords: [{ simplifiedHanzi: "岸", numberedPinyinSearch: "an4" }],
    });
  });
});

describe("pickMatchingWordsByReferences", () => {
  test("returns only matching dictionary words", () => {
    const dictionaryEntry = {
      id: "bu4ke4qi5",
      simplifiedHanzi: "不客气",
      numberedPinyinSearch: "bu4ke4qi5",
      meaning: "you're welcome; don't mention it",
    };

    expect(
      pickMatchingWordsByReferences(
        [dictionaryEntry],
        [{ simplifiedHanzi: "不客气", numberedPinyinSearch: "bu2ke4qi5" }],
      ),
    ).toEqual([dictionaryEntry]);
  });
});
