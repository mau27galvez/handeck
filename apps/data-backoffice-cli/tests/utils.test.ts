import { describe, expect, test } from "bun:test";

import { toNumberedPinyinSearchFromDiacritic } from "../utils";

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
});
