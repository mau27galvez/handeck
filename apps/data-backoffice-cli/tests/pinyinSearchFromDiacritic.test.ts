import { describe, expect, test } from "bun:test";

import {
  splitDiacriticSyllables,
  splitHskDiacriticParts,
  toNumberedPinyinSearchFromDiacritic,
} from "../pinyinSearchFromDiacritic";

describe("toNumberedPinyinSearchFromDiacritic", () => {
  test("converts tone-mark pinyin to numbered search form", () => {
    expect(toNumberedPinyinSearchFromDiacritic("chūzūchē")).toBe("chu1zu1che1");
    expect(toNumberedPinyinSearchFromDiacritic("bú kèqi")).toBe("bu2ke4qi5");
    expect(toNumberedPinyinSearchFromDiacritic("hǎo")).toBe("hao3");
    expect(toNumberedPinyinSearchFromDiacritic("hào")).toBe("hao4");
    expect(toNumberedPinyinSearchFromDiacritic("hǎowánr")).toBe("hao3wan2r5");
  });

  test("normalizes umlaut pinyin to v", () => {
    expect(toNumberedPinyinSearchFromDiacritic("lǜ")).toBe("lv4");
    expect(toNumberedPinyinSearchFromDiacritic("nǚ'ér")).toBe("nv3er2");
    expect(toNumberedPinyinSearchFromDiacritic("rán’ér")).toBe("ran2er2");
    expect(toNumberedPinyinSearchFromDiacritic("cèlüè")).toBe("ce4lve4");
  });

  test("keeps neutral-tone syllables as tone 5 for Cedict matching", () => {
    expect(toNumberedPinyinSearchFromDiacritic("ba")).toBe("ba5");
    expect(toNumberedPinyinSearchFromDiacritic("de")).toBe("de5");
    expect(toNumberedPinyinSearchFromDiacritic("bàba")).toBe("ba4ba5");
  });

  test("keeps compound vowels in one syllable when tone is on the second vowel", () => {
    expect(toNumberedPinyinSearchFromDiacritic("báitiān")).toBe("bai2tian1");
    expect(toNumberedPinyinSearchFromDiacritic("biān")).toBe("bian1");
    expect(toNumberedPinyinSearchFromDiacritic("dǎ diànhuà")).toBe("da3dian4hua4");
    expect(toNumberedPinyinSearchFromDiacritic("liú")).toBe("liu2");
    expect(toNumberedPinyinSearchFromDiacritic("duì")).toBe("dui4");
    expect(toNumberedPinyinSearchFromDiacritic("xiāo")).toBe("xiao1");
    expect(toNumberedPinyinSearchFromDiacritic("nǚ'ér")).toBe("nv3er2");
  });

  test("splits syllables before n or r that start the next syllable", () => {
    expect(toNumberedPinyinSearchFromDiacritic("jiārén")).toBe("jia1ren2");
    expect(toNumberedPinyinSearchFromDiacritic("niúnǎi")).toBe("niu2nai3");
    expect(toNumberedPinyinSearchFromDiacritic("qùnián")).toBe("qu4nian2");
    expect(toNumberedPinyinSearchFromDiacritic("xīngqīrì")).toBe("xing1qi1ri4");
  });
});

describe("splitHskDiacriticParts", () => {
  test("splits on spaces, apostrophes, and hyphens", () => {
    expect(splitHskDiacriticParts("bú kèqi")).toEqual(["bú", "kèqi"]);
    expect(splitHskDiacriticParts("dǎ diànhuà")).toEqual(["dǎ", "diànhuà"]);
    expect(splitHskDiacriticParts("nǚ'ér")).toEqual(["nǚ", "ér"]);
    expect(splitHskDiacriticParts("qiānjiā-wànhù")).toEqual(["qiānjiā", "wànhù"]);
  });
});

describe("splitDiacriticSyllables", () => {
  test("splits glued HSK chunks into tone-marked syllables", () => {
    expect(splitDiacriticSyllables("chūzūchē")).toEqual(["chū", "zū", "chē"]);
    expect(splitDiacriticSyllables("kèqi")).toEqual(["kè", "qi"]);
    expect(splitDiacriticSyllables("jiārén")).toEqual(["jiā", "rén"]);
    expect(splitDiacriticSyllables("hǎowánr")).toEqual(["hǎo", "wánr"]);
  });
});
