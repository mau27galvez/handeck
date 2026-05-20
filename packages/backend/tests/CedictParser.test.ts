import { describe, expect, test } from "bun:test";

import { parseCedictLine } from "../CedictParser";

describe("parseCedictLine", () => {
  test("parses a normal CC-CEDICT line into dictionary entry fields", () => {
    expect(parseCedictLine("你好 你好 [[ni3hao3]] /hello/hi/")).toEqual({
      simplifiedHanzi: "你好",
      numberedPinyin: "ni3hao3",
      diacriticPinyin: "nǐhǎo",
      normalizedPinyin: "nihao",
      numberedPinyinSearch: "ni3hao3",
      pinyinSyllables: ["ni", "hao"],
      numberedPinyinSyllables: ["ni3", "hao3"],
      meaning: "hello; hi",
    });
  });

  test("skips blank lines", () => {
    expect(parseCedictLine("")).toBeNull();
  });

  test("skips comment lines", () => {
    expect(parseCedictLine("# CC-CEDICT")).toBeNull();
  });

  test("skips malformed lines", () => {
    expect(parseCedictLine("not a cedict line")).toBeNull();
  });

  test("skips entries whose only senses are old variants", () => {
    expect(parseCedictLine("㐅 㐅 [[wu3]] /old variant of 五[wu3]/")).toBeNull();
  });

  test("removes old variant senses from mixed-definition entries", () => {
    expect(parseCedictLine("冃 冃 [[mao4]] /old variant of 帽[mao4]/hat/cap/")).toMatchObject({
      simplifiedHanzi: "冃",
      meaning: "hat; cap",
    });
  });

  test("normalizes source umlauts to v for search while preserving display umlauts", () => {
    expect(parseCedictLine("女 女 [[nu:3]] /woman/")).toMatchObject({
      diacriticPinyin: "nǚ",
      normalizedPinyin: "nv",
      numberedPinyinSearch: "nv3",
      pinyinSyllables: ["nv"],
      numberedPinyinSyllables: ["nv3"],
    });

    expect(parseCedictLine("綠 绿 [[lü4]] /green/")).toMatchObject({
      simplifiedHanzi: "绿",
      diacriticPinyin: "lǜ",
      normalizedPinyin: "lv",
      numberedPinyinSearch: "lv4",
      pinyinSyllables: ["lv"],
      numberedPinyinSyllables: ["lv4"],
    });
  });

  test("parses apostrophe-separated pinyin syllables", () => {
    expect(parseCedictLine("421 421 [[si4'er4yi1]] /four-two-one/")).toMatchObject({
      diacriticPinyin: "sì'èryī",
      normalizedPinyin: "sieryi",
      numberedPinyinSearch: "si4er4yi1",
      pinyinSyllables: ["si", "er", "yi"],
      numberedPinyinSyllables: ["si4", "er4", "yi1"],
    });
  });

  test("parses hyphenated tokens with literal letters in source pinyin", () => {
    expect(parseCedictLine("3D打印 3D打印 [[san1-D da3yin4]] /3D printing/")).toMatchObject({
      diacriticPinyin: "sān-D dǎyìn",
      normalizedPinyin: "sandayin",
      numberedPinyinSearch: "san1da3yin4",
      pinyinSyllables: ["san", "da", "yin"],
      numberedPinyinSyllables: ["san1", "da3", "yin4"],
    });
  });

  test("preserves comma-separated pinyin clauses for display and flattens them for search", () => {
    expect(
      parseCedictLine(
        "一不做，二不休 一不做，二不休 [[yi1bu4zuo4, er4bu4xiu1]] /lit. either don't do it, or don't rest (idiom)/",
      ),
    ).toMatchObject({
      diacriticPinyin: "yībùzuò, èrbùxiū",
      numberedPinyin: "yi1bu4zuo4, er4bu4xiu1",
      normalizedPinyin: "yibuzuoerbuxiu",
      numberedPinyinSearch: "yi1bu4zuo4er4bu4xiu1",
      pinyinSyllables: ["yi", "bu", "zuo", "er", "bu", "xiu"],
      numberedPinyinSyllables: ["yi1", "bu4", "zuo4", "er4", "bu4", "xiu1"],
    });
  });

  test("unwraps braced multi-syllable pinyin while indexing its syllables", () => {
    expect(
      parseCedictLine("兙 兙 [[{shi2ke4}]] /(old) contracted variant of 十克[shi2ke4]/"),
    ).toMatchObject({
      numberedPinyin: "shi2ke4",
      diacriticPinyin: "shíkè",
      normalizedPinyin: "shike",
      numberedPinyinSearch: "shi2ke4",
      pinyinSyllables: ["shi", "ke"],
      numberedPinyinSyllables: ["shi2", "ke4"],
    });
  });

  test("unwraps braced numeric literals in hanzi and pinyin without indexing them as syllables", () => {
    expect(
      parseCedictLine(
        "{21}三體綜合症 {21}三体综合症 [[{21} san1ti3 zong1he2zheng4]] /trisomy; Down's syndrome/",
      ),
    ).toMatchObject({
      simplifiedHanzi: "21三体综合症",
      numberedPinyin: "21 san1ti3 zong1he2zheng4",
      diacriticPinyin: "21 sāntǐ zōnghézhèng",
      normalizedPinyin: "santizonghezheng",
      numberedPinyinSearch: "san1ti3zong1he2zheng4",
      pinyinSyllables: ["san", "ti", "zong", "he", "zheng"],
      numberedPinyinSyllables: ["san1", "ti3", "zong1", "he2", "zheng4"],
    });
  });

  test("converts bracketed numbered pinyin in definitions only when it looks like pinyin", () => {
    expect(
      parseCedictLine(
        "拜拜 拜拜 [[bai2bai2]] /(loanword) bye-bye/also pr. [bai1 bai1] etc/(coll.) to part ways (with sb)/(fig.) to have nothing further to do (with sb or sth)/",
      ),
    ).toMatchObject({
      meaning:
        "(loanword) bye-bye; also pr. [bāi bāi] etc; (coll.) to part ways (with sb); (fig.) to have nothing further to do (with sb or sth)",
    });

    expect(
      parseCedictLine(
        "□ □ [[ging1]] /uptight; obstinate; to awkwardly force oneself to do sth (from Taiwanese, Tai-lo pr. [king], often written as ㄍㄧㄥ, no generally accepted hanzi form)/",
      ),
    ).toMatchObject({
      meaning:
        "uptight; obstinate; to awkwardly force oneself to do sth (from Taiwanese, Tai-lo pr. [king], often written as ㄍㄧㄥ, no generally accepted hanzi form)",
    });
  });
});
