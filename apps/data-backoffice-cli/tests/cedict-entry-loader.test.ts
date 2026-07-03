import { describe, expect, test } from "bun:test";

import { isVariantOfDictionaryEntry } from "@handeck/api/modules/vocab-packs/vocab-pack-word-matching";

import { parseCedictLine, parseCedictLineRaw } from "../CedictParser";
import { loadDictionaryEntries } from "../cedict-entry-loader";
import { DICT_CUSTOMIZATIONS } from "../dict-customizations";

describe("parseCedictLineRaw", () => {
  test("keeps raw senses for seed-time variant resolution", () => {
    expect(
      parseCedictLineRaw(
        '紀錄 纪录 [[ji4lu4]] /variant of 記錄|记录[ji4lu4] (but in Taiwan, not for the verb sense "to record")/',
      ),
    ).toEqual({
      simplifiedHanzi: "纪录",
      numberedPinyin: "ji4lu4",
      senses: ['variant of 記錄|记录[ji4lu4] (but in Taiwan, not for the verb sense "to record")'],
    });
  });
});

describe("loadDictionaryEntries", () => {
  test("resolves variant-only entries to target definitions with a variant note", () => {
    const { entries } = loadDictionaryEntries(
      [
        "記錄 记录 [[ji4lu4]] /record/to record/",
        '紀錄 纪录 [[ji4lu4]] /variant of 記錄|记录[ji4lu4] (but in Taiwan, not for the verb sense "to record")/',
      ].join("\n"),
      { includeCustomizations: false },
    );

    expect(entries.find((entry) => entry.simplifiedHanzi === "纪录")).toMatchObject({
      simplifiedHanzi: "纪录",
      numberedPinyinSearch: "ji4lu4",
      meaning:
        'record; to record (variant of 记录[jìlù] (but in Taiwan, not for the verb sense "to record"))',
    });
    expect(
      isVariantOfDictionaryEntry(
        entries.find((entry) => entry.simplifiedHanzi === "纪录")!.meaning,
      ),
    ).toBe(false);
  });

  test("resolves variant references without pinyin only when the target is unambiguous", () => {
    const { entries } = loadDictionaryEntries(
      ["仇 仇 [[chou2]] /enmity/", "㐜 㐜 [[chou2]] /variant of 仇/"].join("\n"),
      { includeCustomizations: false },
    );

    expect(entries.find((entry) => entry.simplifiedHanzi === "㐜")).toMatchObject({
      meaning: "enmity (variant of 仇)",
    });
  });

  test("resolves chained variants with a cycle guard", () => {
    const { entries } = loadDictionaryEntries(
      [
        "下工夫 下工夫 [[xia4gong1fu5]] /to put in time and energy/to concentrate one's efforts/",
        "下功夫 下功夫 [[xia4gong1fu5]] /variant of 下工夫[xia4gong1fu5]/",
        "下功夫兒 下功夫儿 [[xia4gong1fu5r5]] /variant of 下功夫[xia4gong1fu5]/",
        "甲 甲 [[jia3]] /variant of 乙[yi3]/",
        "乙 乙 [[yi3]] /variant of 甲[jia3]/",
      ].join("\n"),
      { includeCustomizations: false, warn: () => {} },
    );

    expect(entries.find((entry) => entry.simplifiedHanzi === "下功夫儿")).toMatchObject({
      meaning:
        "to put in time and energy; to concentrate one's efforts (variant of 下工夫[xiàgōngfu]) (variant of 下功夫[xiàgōngfu])",
    });
    expect(entries.find((entry) => entry.simplifiedHanzi === "甲")).toMatchObject({
      meaning: "variant of 乙[yǐ]",
    });
  });

  test("leaves mixed-sense and unresolvable variant entries untouched", () => {
    const warnings: string[] = [];
    const { entries } = loadDictionaryEntries(
      [
        "㗂 㗂 [[sheng3]] /variant of 省[sheng3]/tight-lipped/to examine/",
        "失配 失配 [[shi1pei4]] /variant of 不存在[bu4cun2zai4]/",
      ].join("\n"),
      { includeCustomizations: false, warn: (message) => warnings.push(message) },
    );

    expect(entries.find((entry) => entry.simplifiedHanzi === "㗂")).toMatchObject({
      meaning: "variant of 省[shěng]; tight-lipped; to examine",
    });
    expect(entries.find((entry) => entry.simplifiedHanzi === "失配")).toMatchObject({
      meaning: "variant of 不存在[bùcúnzài]",
    });
    expect(warnings).toContain("Could not resolve variant target 不存在 for 失配.");
  });

  test("parses every customization line and skips customizations that already exist upstream", () => {
    for (const customization of DICT_CUSTOMIZATIONS) {
      expect(parseCedictLine(customization.line)).not.toBeNull();
    }

    const warnings: string[] = [];
    const { entries, customized } = loadDictionaryEntries(DICT_CUSTOMIZATIONS[0]!.line, {
      warn: (message) => warnings.push(message),
    });

    expect(customized).toBe(DICT_CUSTOMIZATIONS.length - 1);
    expect(entries.filter((entry) => entry.simplifiedHanzi === "新媒体")).toHaveLength(1);
    expect(warnings).toEqual([
      "Skipping dictionary customization for 新媒体: HSK 7-9 word with no standalone CC-CEDICT entry.",
    ]);
  });
});
