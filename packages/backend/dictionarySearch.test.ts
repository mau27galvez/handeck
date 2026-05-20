import { describe, expect, test } from "bun:test";

import { parseDictionarySearchQuery } from "./convex/dictionarySearch";

describe("parseDictionarySearchQuery", () => {
  test("keeps regular u and umlaut v distinct in pinyin input", () => {
    expect(parseDictionarySearchQuery("nu")).toMatchObject({
      kind: "latin",
      pinyin: { normalizedPinyin: "nu", numberedPinyinSearch: "nu" },
    });
    expect(parseDictionarySearchQuery("nv")).toMatchObject({
      kind: "latin",
      pinyin: { normalizedPinyin: "nv", numberedPinyinSearch: "nv" },
    });
  });

  test("rejects unsupported pinyin umlaut input", () => {
    expect(parseDictionarySearchQuery("nü")).toEqual({ kind: "unsupported" });
  });

  test("recognizes tone-number pinyin", () => {
    expect(parseDictionarySearchQuery("ni3hao3")).toMatchObject({
      kind: "latin",
      pinyin: {
        normalizedPinyin: "nihao",
        numberedPinyinSearch: "ni3hao3",
        hasToneNumbers: true,
      },
    });
  });

  test("recognizes simplified-character search", () => {
    expect(parseDictionarySearchQuery("你好")).toEqual({ kind: "simplified", value: "你好" });
  });

  test("recognizes mixed simplified-character and pinyin search", () => {
    expect(parseDictionarySearchQuery("你hao")).toMatchObject({
      kind: "mixed",
      tokens: [
        { kind: "han", value: "你" },
        { kind: "pinyin", value: { normalizedPinyin: "hao" } },
      ],
    });
    expect(parseDictionarySearchQuery("ni好")).toMatchObject({
      kind: "mixed",
      tokens: [
        { kind: "pinyin", value: { normalizedPinyin: "ni" } },
        { kind: "han", value: "好" },
      ],
    });
  });

  test("rejects excluded wildcard, full-text, and Zhuyin searches", () => {
    expect(parseDictionarySearchQuery("@不")).toEqual({ kind: "unsupported" });
    expect(parseDictionarySearchQuery("#wedding")).toEqual({ kind: "unsupported" });
    expect(parseDictionarySearchQuery("ㄅ")).toEqual({ kind: "unsupported" });
  });
});
