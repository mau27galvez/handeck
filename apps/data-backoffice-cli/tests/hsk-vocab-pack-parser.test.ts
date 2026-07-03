import { describe, expect, test } from "bun:test";

import {
  parseHskWordList,
  extractHskPinyinFromLine,
  stripHskHanziSuffix,
} from "../hsk-vocab-pack-parser";

describe("parseHskWordList", () => {
  test("parses hanzi and tone-aware numbered pinyin columns", () => {
    expect(parseHskWordList("1\t1\t出租车\tchūzūchē\t名\n2\t1\t不客气\tbú kèqi\t")).toEqual([
      { simplifiedHanzi: "出租车", numberedPinyinSearch: "chu1zu1che1" },
      { simplifiedHanzi: "不客气", numberedPinyinSearch: "bu2ke4qi5" },
    ]);
  });

  test("strips HSK disambiguation suffixes from hanzi", () => {
    expect(parseHskWordList("10\t1\t本1\tběn\t量\n1646\t4（7-9）\t生2\tshēng\t形")).toEqual([
      { simplifiedHanzi: "本", numberedPinyinSearch: "ben3" },
      { simplifiedHanzi: "生", numberedPinyinSearch: "sheng1" },
    ]);
  });

  test("distinguishes same hanzi with different tones", () => {
    expect(parseHskWordList("1\t1\t好\thǎo\t形\n2\t5\t好\thào\t动")).toEqual([
      { simplifiedHanzi: "好", numberedPinyinSearch: "hao3" },
      { simplifiedHanzi: "好", numberedPinyinSearch: "hao4" },
    ]);
  });

  test("throws for rows without hanzi and pinyin columns", () => {
    expect(() => parseHskWordList("1\t1\t爱")).toThrow("Invalid HSK row 1");
  });

  test("parses compound vowels with tone on the second vowel", () => {
    expect(
      parseHskWordList("6\t1\t白天\tbáitiān\t名\n11\t1\t边\tbiān\t名\n25\t1\t打电话\tdǎ diànhuà\n"),
    ).toEqual([
      { simplifiedHanzi: "白天", numberedPinyinSearch: "bai2tian1" },
      { simplifiedHanzi: "边", numberedPinyinSearch: "bian1" },
      { simplifiedHanzi: "打电话", numberedPinyinSearch: "da3dian4hua4" },
    ]);
  });

  test("extracts pinyin up to the last tone-marked letter and ignores POS tags", () => {
    expect(extractHskPinyinFromLine("7\t1（4）\t半\tbàn\t数、（副）")).toBe("bàn");
    expect(extractHskPinyinFromLine("14\t1\t不客气\tbú kèqi")).toBe("bú kèqi");
  });
});

describe("stripHskHanziSuffix", () => {
  test("removes trailing numeric suffixes", () => {
    expect(stripHskHanziSuffix("点1")).toBe("点");
    expect(stripHskHanziSuffix("则12")).toBe("则");
  });

  test("keeps hanzi without suffixes unchanged", () => {
    expect(stripHskHanziSuffix("出租车")).toBe("出租车");
  });
});
