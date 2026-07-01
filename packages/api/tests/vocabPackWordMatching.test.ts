import { describe, expect, test } from "bun:test";

import {
  isVariantOfDictionaryEntry,
  NON_VARIANT_MEANING_LIKE_PATTERN,
  pickMatchingWordsByReferences,
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

describe("pickMatchingWordsByReferences", () => {
  test("matches words by hanzi and numbered pinyin search", () => {
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
      pickMatchingWordsByReferences(candidates, [
        { simplifiedHanzi: "岸", numberedPinyinSearch: "an4" },
      ]),
    ).toEqual([candidates[1]]);
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
      pickMatchingWordsByReferences(
        [variant, main],
        [{ simplifiedHanzi: "岸", numberedPinyinSearch: "an4" }],
      ),
    ).toEqual([main]);
  });

  test("returns no matches when only variant-of entries match", () => {
    expect(
      pickMatchingWordsByReferences(
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
    ).toEqual([]);
  });
});
