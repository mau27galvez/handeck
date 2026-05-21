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

  describe("tone mark placement", () => {
    // Marks go on vowels using priority a > o > e > i > u > ü.
    // When i and u appear together, the mark goes on the latter vowel instead.

    function diacriticPinyinFor(numberedPinyin: string): string | undefined {
      return parseCedictLine(`测 测 [[${numberedPinyin}]] /tone placement regression/`)
        ?.diacriticPinyin;
    }

    // Numbered pinyin spells -iou as iu, -uei as ui, and -uen as un (see -iou/-uei/-uen rows).
    test.each([
      ["-a", "ma1", "mā"],
      ["-ai", "mai1", "māi"],
      ["-an", "ban1", "bān"],
      ["-ang", "bang1", "bāng"],
      ["-ao", "zao1", "zāo"],
      ["-e", "he1", "hē"],
      ["-ei", "fei1", "fēi"],
      ["-en", "hen1", "hēn"],
      ["-eng", "heng1", "hēng"],
      ["-er", "er2", "ér"],
      ["-i", "bi3", "bǐ"],
      ["-ia", "jia1", "jiā"],
      ["-ian", "jian1", "jiān"],
      ["-iang", "jiang1", "jiāng"],
      ["-iao", "xiao1", "xiāo"],
      ["-ie", "xie2", "xié"],
      ["-in", "bin1", "bīn"],
      ["-ing", "bing1", "bīng"],
      ["-iong", "xiong1", "xiōng"],
      ["-iou", "liu3", "liǔ"],
      ["-o", "bo2", "bó"],
      ["-ong", "hong1", "hōng"],
      ["-ou", "zou1", "zōu"],
      ["-u", "bu4", "bù"],
      ["-ua", "hua1", "huā"],
      ["-uai", "kuai4", "kuài"],
      ["-uan", "guan1", "guān"],
      ["-uang", "huang2", "huáng"],
      ["-uei", "gui3", "guǐ"],
      ["-uen", "wen2", "wén"],
      ["-ueng", "weng1", "wēng"],
      ["-uo", "huo3", "huǒ"],
      ["-ü", "lü3", "lǚ"],
      ["-üan", "quan2", "quán"],
      ["-üe", "lüe4", "lüè"],
      ["-ün", "jun1", "jūn"],
    ])("final %s (%s → %s)", (_final, numberedPinyin, expectedDiacritic) => {
      expect(diacriticPinyinFor(numberedPinyin)).toBe(expectedDiacritic);
    });

    describe("neutral tone (5)", () => {
      test("leaves the syllable without a tone mark", () => {
        expect(diacriticPinyinFor("ma5")).toBe("ma");
        expect(diacriticPinyinFor("ne5")).toBe("ne");
        expect(diacriticPinyinFor("yi5")).toBe("yi");
      });
    });

    describe("uppercase source letters", () => {
      test("places the mark on the prioritized vowel while preserving case", () => {
        expect(diacriticPinyinFor("LU4")).toBe("LÙ");
        expect(diacriticPinyinFor("ZHOU1")).toBe("ZHŌU");
        expect(diacriticPinyinFor("LÜ3")).toBe("LǙ");
      });
    });

    describe("syllables without a tone-bearing vowel", () => {
      test("drops the tone digit without adding a mark", () => {
        expect(diacriticPinyinFor("m2")).toBe("m"); // 呣
        expect(diacriticPinyinFor("hm5")).toBe("hm"); // 噷
        expect(diacriticPinyinFor("hng5")).toBe("hng"); // 哼
        expect(diacriticPinyinFor("xx5")).toBe("xx"); // 々
      });
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

// TODO: remove traditional hanzi from meaning
