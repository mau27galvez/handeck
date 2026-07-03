import { type HskVocabPackWord } from "./hsk-vocab-pack-parser";

export type KnownUnmatchedHskWord = HskVocabPackWord & {
  /** Why this HSK word cannot be matched to a CC-CEDICT entry without changing its meaning or written form. */
  reason: string;
};

/**
 * HSK words that have no usable CC-CEDICT entry.
 *
 * Two categories:
 * - CC-CEDICT has the word only as a "variant of ..." entry. Variant entries are
 *   excluded from vocab packs because their definition text is a cross-reference,
 *   not a real definition, and rewriting the HSK hanzi to the main entry's form
 *   would change the written word the learner studies.
 * - CC-CEDICT has no entry for the word at all.
 *
 * These are skipped with a warning instead of failing the seed. If a future
 * CC-CEDICT release adds a proper entry, the word will match automatically and
 * its row here can be removed.
 */
export const KNOWN_UNMATCHED_HSK_WORDS: KnownUnmatchedHskWord[] = [
  {
    simplifiedHanzi: "纪录",
    numberedPinyinSearch: "ji4lu4",
    reason: "CC-CEDICT has 纪录 only as 'variant of 記錄|记录[ji4lu4]'; 记录 is already in HSK 5.",
  },
  {
    simplifiedHanzi: "下功夫",
    numberedPinyinSearch: "xia4gong1fu5",
    reason: "CC-CEDICT has 下功夫 only as 'variant of 下工夫[xia4gong1fu5]'.",
  },
  {
    simplifiedHanzi: "新媒体",
    numberedPinyinSearch: "xin1mei2ti3",
    reason: "No CC-CEDICT entry for 新媒体 (new media).",
  },
  {
    simplifiedHanzi: "新能源",
    numberedPinyinSearch: "xin1neng2yuan2",
    reason: "No CC-CEDICT entry for 新能源 (new energy).",
  },
  {
    simplifiedHanzi: "标识",
    numberedPinyinSearch: "biao1shi2",
    reason:
      "CC-CEDICT has 标识 only as biao1zhi4 'variant of 標誌|标志'; the HSK reading biāoshí has no entry.",
  },
  {
    simplifiedHanzi: "不予",
    numberedPinyinSearch: "bu4yu3",
    reason: "No CC-CEDICT entry for 不予 alone (only compounds such as 不予理会).",
  },
  {
    simplifiedHanzi: "纯朴",
    numberedPinyinSearch: "chun2pu3",
    reason:
      "CC-CEDICT has 纯朴 only as 'variant of 淳樸|淳朴[chun2pu3]'; 淳朴 is already in HSK 7-9.",
  },
  {
    simplifiedHanzi: "得意扬扬",
    numberedPinyinSearch: "de2yi4yang2yang2",
    reason: "CC-CEDICT has 得意扬扬 only as 'variant of 得意洋洋[de2yi4yang2yang2]'.",
  },
  {
    simplifiedHanzi: "精彩纷呈",
    numberedPinyinSearch: "jing1cai3fen1cheng2",
    reason: "No CC-CEDICT entry for 精彩纷呈 (only 纷呈, which references the combination).",
  },
  {
    simplifiedHanzi: "居于",
    numberedPinyinSearch: "ju1yu2",
    reason: "No CC-CEDICT entry for 居于.",
  },
  {
    simplifiedHanzi: "口哨儿",
    numberedPinyinSearch: "kou3shao4r5",
    reason: "CC-CEDICT only has the non-erhua form 口哨[kou3shao4].",
  },
  {
    simplifiedHanzi: "两翼",
    numberedPinyinSearch: "liang3yi4",
    reason: "No CC-CEDICT entry for 两翼.",
  },
  {
    simplifiedHanzi: "磨炼",
    numberedPinyinSearch: "mo2lian4",
    reason: "CC-CEDICT has 磨炼 only as 'variant of 磨練|磨练[mo2lian4]'.",
  },
  {
    simplifiedHanzi: "压轴",
    numberedPinyinSearch: "ya1zhou4",
    reason: "No CC-CEDICT entry for 压轴 alone (only 压轴戏).",
  },
  {
    simplifiedHanzi: "致力于",
    numberedPinyinSearch: "zhi4li4yu2",
    reason: "No CC-CEDICT entry for 致力于 (only 致力).",
  },
  {
    simplifiedHanzi: "做证",
    numberedPinyinSearch: "zuo4zheng4",
    reason: "CC-CEDICT has 做证 only as 'variant of 作證|作证[zuo4zheng4]'.",
  },
  {
    simplifiedHanzi: "做主",
    numberedPinyinSearch: "zuo4zhu3",
    reason: "CC-CEDICT has 做主 only as 'variant of 作主[zuo4zhu3]'.",
  },
];

export function findKnownUnmatchedHskWord(word: HskVocabPackWord) {
  return KNOWN_UNMATCHED_HSK_WORDS.find(
    (known) =>
      known.simplifiedHanzi === word.simplifiedHanzi &&
      known.numberedPinyinSearch === word.numberedPinyinSearch,
  );
}
