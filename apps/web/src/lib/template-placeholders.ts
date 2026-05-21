export type PlaceholderWord = {
  simplifiedHanzi: string;
  pinyin: string;
  translation: string;
};

export const PLACEHOLDER_WORDS: PlaceholderWord[] = [
  { simplifiedHanzi: "你好", pinyin: "nǐ hǎo", translation: "hello" },
  { simplifiedHanzi: "谢谢", pinyin: "xiè xie", translation: "thank you" },
  { simplifiedHanzi: "再见", pinyin: "zài jiàn", translation: "goodbye" },
  { simplifiedHanzi: "请", pinyin: "qǐng", translation: "please" },
];

export const KUAI_COST_PLACEHOLDER = 0;

export const TEMPLATE_WORDS_PANEL_ID = "template-words-panel";
