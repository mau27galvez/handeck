import { describe, expect, test } from "bun:test";

import { applyHskVocabPackMatchOverrides } from "../hsk-vocab-pack-match-overrides";
import { parseHskWordListWithMetadata } from "../hsk-vocab-pack-parser";

describe("applyHskVocabPackMatchOverrides", () => {
  test("uses raw HSK suffixes to select different 喂 senses", () => {
    const words = parseHskWordListWithMetadata("218\t1\t喂1\twèi\t叹\n3183\t5\t喂2\twèi\t动");

    expect(applyHskVocabPackMatchOverrides(words)).toEqual([
      {
        simplifiedHanzi: "喂",
        numberedPinyinSearch: "wei4",
        matchSelector: { meaningStartsWith: "hey" },
      },
      {
        simplifiedHanzi: "喂",
        numberedPinyinSearch: "wei4",
        matchSelector: { meaningStartsWith: "to feed" },
      },
    ]);
  });

  test("leaves unambiguous words unchanged", () => {
    const words = parseHskWordListWithMetadata("1\t1\t你好\tnǐ hǎo\t");

    expect(applyHskVocabPackMatchOverrides(words)).toEqual([
      { simplifiedHanzi: "你好", numberedPinyinSearch: "ni3hao3" },
    ]);
  });
});
