import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

  test("keeps only the first slash-separated pinyin alternative", () => {
    expect(parseHskWordList("181\t1\t谁\tshéi/shuí\t代\n1689\t4\t熟\tshú/shóu\t形")).toEqual([
      { simplifiedHanzi: "谁", numberedPinyinSearch: "shei2" },
      { simplifiedHanzi: "熟", numberedPinyinSearch: "shu2" },
    ]);
  });

  test("lowercases proper-noun pinyin, including multi-word names", () => {
    expect(
      parseHskWordList("69\t1\t汉语\tHànyǔ\t名\n2884\t5\t中华民族\tZhōnghuá Mínzú\t名"),
    ).toEqual([
      { simplifiedHanzi: "汉语", numberedPinyinSearch: "han4yu3" },
      { simplifiedHanzi: "中华民族", numberedPinyinSearch: "zhong1hua2min2zu2" },
    ]);
  });

  test("converts uppercase diacritic vowels that pinyin-pro cannot handle directly", () => {
    expect(parseHskWordList("2809\t5\t欧洲\tŌuzhōu\t名")).toEqual([
      { simplifiedHanzi: "欧洲", numberedPinyinSearch: "ou1zhou1" },
    ]);
  });

  test("folds a trailing erhua r into the previous syllable as r5", () => {
    expect(parseHskWordList("256\t1\t一点儿\tyīdiǎnr\n175\t2\t一会儿\tyīhuìr\t名")).toEqual([
      { simplifiedHanzi: "一点儿", numberedPinyinSearch: "yi1dian3r5" },
      { simplifiedHanzi: "一会儿", numberedPinyinSearch: "yi1hui4r5" },
    ]);
  });

  test("splits syllables on apostrophes and hyphens used in HSK 7-9 idioms", () => {
    expect(
      parseHskWordList("5742\t7-9\t不言而喻\tbùyán’éryù\n5743\t7-9\t不厌其烦\tbùyàn-qífán"),
    ).toEqual([
      { simplifiedHanzi: "不言而喻", numberedPinyinSearch: "bu4yan2er2yu4" },
      { simplifiedHanzi: "不厌其烦", numberedPinyinSearch: "bu4yan4qi2fan2" },
    ]);
  });

  test("maps the interjection ǹg to CC-CEDICT's en reading", () => {
    expect(parseHskWordList("1534\t4\t嗯\tǹg\t叹")).toEqual([
      { simplifiedHanzi: "嗯", numberedPinyinSearch: "en4" },
    ]);
  });

  test("keeps neutral-tone syllables as tone 5", () => {
    expect(parseHskWordList("418\t2\t起来\tqǐlai\t动\n1290\t4\t好处\thǎochu\t名")).toEqual([
      { simplifiedHanzi: "起来", numberedPinyinSearch: "qi3lai5" },
      { simplifiedHanzi: "好处", numberedPinyinSearch: "hao3chu5" },
    ]);
  });

  test("parses every real HSK word file without errors", () => {
    const hskWordsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "hsk-words");
    const files = [
      "HSK_Level_1_words.txt",
      "HSK_Level_2_words.txt",
      "HSK_Level_3_words.txt",
      "HSK_Level_4_words.txt",
      "HSK_Level_5_words.txt",
      "HSK_Level_6_words.txt",
      "HSK_Level_7-9_words.txt",
    ];

    for (const file of files) {
      const contents = readFileSync(resolve(hskWordsRoot, file), "utf8");
      const nonBlankLines = contents.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const words = parseHskWordList(contents);

      expect(words.length).toBe(nonBlankLines.length);
      for (const word of words) {
        expect(word.simplifiedHanzi.length).toBeGreaterThan(0);
        expect(word.numberedPinyinSearch).toMatch(/^[a-z1-5]+$/);
      }
    }
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
