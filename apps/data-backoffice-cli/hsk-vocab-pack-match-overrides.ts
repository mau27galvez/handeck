import type { VocabPackWordMatchSelector } from "@handeck/api/modules/vocab-packs/vocab-pack-word-matching";

import type { HskVocabPackWordWithMetadata } from "./hsk-vocab-pack-parser";

type HskVocabPackMatchOverride = {
  hskHanzi: string;
  numberedPinyinSearch: string;
  matchSelector: VocabPackWordMatchSelector;
  reason: string;
};

const HSK_VOCAB_PACK_MATCH_OVERRIDES: HskVocabPackMatchOverride[] = [
  {
    hskHanzi: "喂1",
    numberedPinyinSearch: "wei4",
    matchSelector: { meaningStartsWith: "hey" },
    reason: "HSK 1 marks 喂 as an interjection, not the verb 'to feed'.",
  },
  {
    hskHanzi: "喂2",
    numberedPinyinSearch: "wei4",
    matchSelector: { meaningStartsWith: "to feed" },
    reason: "HSK 5 marks 喂 as a verb, not the interjection.",
  },
  {
    hskHanzi: "只",
    numberedPinyinSearch: "zhi1",
    matchSelector: { meaningIncludes: "classifier for birds" },
    reason: "HSK 1 marks 只 as a measure word, not 秖 'grain that has begun to ripen'.",
  },
  {
    hskHanzi: "比",
    numberedPinyinSearch: "bi3",
    matchSelector: { meaningStartsWith: "to compare" },
    reason: "HSK 2 teaches 比 as a verb/preposition, not the abbreviation for Belgium.",
  },
  {
    hskHanzi: "中",
    numberedPinyinSearch: "zhong1",
    matchSelector: { meaningStartsWith: "within; among" },
    reason: "HSK 3 teaches 中 as 'middle/inside', not the bound form for China.",
  },
  {
    hskHanzi: "并",
    numberedPinyinSearch: "bing4",
    matchSelector: { meaningStartsWith: "and; furthermore" },
    reason: "HSK 4 teaches 并 as an adverb/conjunction, not only 'to combine'.",
  },
  {
    hskHanzi: "当",
    numberedPinyinSearch: "dang1",
    matchSelector: { meaningStartsWith: "to be; to act as" },
    reason: "HSK 4 teaches 当 as a verb/preposition, not the onomatopoeic bell sound.",
  },
  {
    hskHanzi: "干",
    numberedPinyinSearch: "gan1",
    matchSelector: { meaningStartsWith: "dry; dried food" },
    reason: "HSK 4/5 teaches 干 gān as 'dry', not 干 as heavenly-stem/shield.",
  },
  {
    hskHanzi: "凉",
    numberedPinyinSearch: "liang2",
    matchSelector: { meaningStartsWith: "cool; cold" },
    reason: "HSK 4 teaches 凉 as an adjective, not the historical Liang kingdoms.",
  },
  {
    hskHanzi: "台",
    numberedPinyinSearch: "tai2",
    matchSelector: { meaningStartsWith: "platform; stage" },
    reason: "HSK 4/5 teaches 台 as a measure word/noun, not Taiwan, desk, or typhoon.",
  },
  {
    hskHanzi: "鲜",
    numberedPinyinSearch: "xian1",
    matchSelector: { meaningStartsWith: "fresh" },
    reason: "HSK 4 teaches 鲜 as an adjective, not 'fish'.",
  },
  {
    hskHanzi: "朝",
    numberedPinyinSearch: "chao2",
    matchSelector: { meaningIncludes: "facing; towards" },
    reason: "HSK 5 teaches 朝 as a verb/preposition, not the abbreviation for Korea.",
  },
  {
    hskHanzi: "冲",
    numberedPinyinSearch: "chong1",
    matchSelector: { meaningStartsWith: "(of water) to dash against" },
    reason: "HSK 5 teaches 冲 chōng as an action verb, not 衝 'thoroughfare'.",
  },
  {
    hskHanzi: "哈",
    numberedPinyinSearch: "ha1",
    matchSelector: { meaningStartsWith: "(interj.) ha!" },
    reason: "HSK 5 teaches 哈 as an interjection/onomatopoeia, not an abbreviation.",
  },
  {
    hskHanzi: "划",
    numberedPinyinSearch: "hua2",
    matchSelector: { meaningStartsWith: "to row; to paddle" },
    reason: "HSK 5 teaches 划 huá as 'to row'/'worth it', not 'to scratch'.",
  },
  {
    hskHanzi: "系",
    numberedPinyinSearch: "xi4",
    matchSelector: { meaningStartsWith: "system; department; faculty" },
    reason: "HSK 5 teaches 系 xì as a noun, not 繫/係 verb senses.",
  },
  {
    hskHanzi: "大都",
    numberedPinyinSearch: "da4du1",
    matchSelector: { meaningStartsWith: "for the most part" },
    reason: "HSK 6 teaches 大都 as an adverb, not the Yuan capital.",
  },
  {
    hskHanzi: "卷",
    numberedPinyinSearch: "juan3",
    matchSelector: { meaningStartsWith: "to roll up; (fig.)" },
    reason: "HSK 6 teaches 卷 juǎn with the modern rolled-up/competitive senses.",
  },
  {
    hskHanzi: "扎",
    numberedPinyinSearch: "zha1",
    matchSelector: { meaningStartsWith: "to prick" },
    reason: "HSK 6 teaches 扎 zhā as 'to prick/stick in', not troop stationing.",
  },
  {
    hskHanzi: "糊",
    numberedPinyinSearch: "hu2",
    matchSelector: { meaningStartsWith: "to paste; to glue" },
    reason: "HSK 7-9 teaches 糊 as a verb/adjective, not 'congee'.",
  },
  {
    hskHanzi: "冷战",
    numberedPinyinSearch: "leng3zhan4",
    matchSelector: { meaningStartsWith: "cold war" },
    reason:
      "HSK 7-9 teaches the general noun/figurative sense, not specifically the US-Soviet Cold War.",
  },
  {
    hskHanzi: "蒙",
    numberedPinyinSearch: "meng2",
    matchSelector: { meaningStartsWith: "to cover" },
    reason: "HSK 7-9 teaches 蒙 méng as a verb, not literary/hazy/blind senses.",
  },
  {
    hskHanzi: "蒙",
    numberedPinyinSearch: "meng1",
    matchSelector: { meaningStartsWith: "to deceive" },
    reason: "HSK 7-9 teaches 蒙 mēng as a verb, not the dazed adjective sense.",
  },
];

export function applyHskVocabPackMatchOverrides(words: HskVocabPackWordWithMetadata[]) {
  return words.map(({ hskHanzi: _hskHanzi, ...word }) => {
    const override = findHskVocabPackMatchOverride(_hskHanzi, word.numberedPinyinSearch);
    if (!override) {
      return word;
    }

    return {
      ...word,
      matchSelector: override.matchSelector,
    };
  });
}

function findHskVocabPackMatchOverride(hskHanzi: string, numberedPinyinSearch: string) {
  return HSK_VOCAB_PACK_MATCH_OVERRIDES.find(
    (override) =>
      override.hskHanzi === hskHanzi && override.numberedPinyinSearch === numberedPinyinSearch,
  );
}
