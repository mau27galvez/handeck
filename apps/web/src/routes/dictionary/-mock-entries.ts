/**
 * Matches Convex `dictionaryEntry` shape (see packages/backend/convex/schema.ts).
 */
export type DictionaryEntryRow = {
  simplifiedHanzi: string;
  numberedPinyin: string;
  diacriticPinyin: string;
  normalizedPinyin: string;
  meaning: string;
};

export const MOCK_DICTIONARY_ENTRIES: DictionaryEntryRow[] = [
  {
    simplifiedHanzi: "墓地",
    numberedPinyin: "mu4 di4",
    diacriticPinyin: "mù dì",
    normalizedPinyin: "mu di",
    meaning: "graveyard; burial ground; cemetery",
  },
  {
    simplifiedHanzi: "坟地",
    numberedPinyin: "fen2 di4",
    diacriticPinyin: "fén dì",
    normalizedPinyin: "fen di",
    meaning: "graveyard; cemetery",
  },
  {
    simplifiedHanzi: "公墓",
    numberedPinyin: "gong1 mu4",
    diacriticPinyin: "gōng mù",
    normalizedPinyin: "gong mu",
    meaning:
      "1 public cemetery 2 archaic royal or aristocratic burial ground (often truncated in dictionary lists)",
  },
  {
    simplifiedHanzi: "出殡",
    numberedPinyin: "chu1 bin4",
    diacriticPinyin: "chū bìn",
    normalizedPinyin: "chu bin",
    meaning: "carry a coffin to the cemetery; hold a funeral procession",
  },
  {
    simplifiedHanzi: "陵园",
    numberedPinyin: "ling2 yuan2",
    diacriticPinyin: "líng yuán",
    normalizedPinyin: "ling yuan",
    meaning: "cemetery (especially landscaped or memorial park)",
  },
  {
    simplifiedHanzi: "埋葬",
    numberedPinyin: "mai2 zang4",
    diacriticPinyin: "mái zàng",
    normalizedPinyin: "mai zang",
    meaning: "bury; inter",
  },
  {
    simplifiedHanzi: "你好",
    numberedPinyin: "ni3 hao3",
    diacriticPinyin: "nǐ hǎo",
    normalizedPinyin: "ni hao",
    meaning: "hello; hi",
  },
  {
    simplifiedHanzi: "谢谢",
    numberedPinyin: "xie4 xie5",
    diacriticPinyin: "xiè xie",
    normalizedPinyin: "xie xie",
    meaning: "thank you; thanks",
  },
  {
    simplifiedHanzi: "学习",
    numberedPinyin: "xue2 xi2",
    diacriticPinyin: "xué xí",
    normalizedPinyin: "xue xi",
    meaning: "study; learn",
  },
  {
    simplifiedHanzi: "工作",
    numberedPinyin: "gong1 zuo4",
    diacriticPinyin: "gōng zuò",
    normalizedPinyin: "gong zuo",
    meaning: "work; job",
  },
  {
    simplifiedHanzi: "家庭",
    numberedPinyin: "jia1 ting2",
    diacriticPinyin: "jiā tíng",
    normalizedPinyin: "jia ting",
    meaning: "family; household",
  },
  {
    simplifiedHanzi: "孩子",
    numberedPinyin: "hai2 zi5",
    diacriticPinyin: "hái zi",
    normalizedPinyin: "hai zi",
    meaning: "child; children",
  },
  {
    simplifiedHanzi: "学校",
    numberedPinyin: "xue2 xiao4",
    diacriticPinyin: "xué xiào",
    normalizedPinyin: "xue xiao",
    meaning: "school",
  },
  {
    simplifiedHanzi: "老师",
    numberedPinyin: "lao3 shi1",
    diacriticPinyin: "lǎo shī",
    normalizedPinyin: "lao shi",
    meaning: "teacher",
  },
  {
    simplifiedHanzi: "学生",
    numberedPinyin: "xue2 sheng1",
    diacriticPinyin: "xué shēng",
    normalizedPinyin: "xue sheng",
    meaning: "student",
  },
  {
    simplifiedHanzi: "医生",
    numberedPinyin: "yi1 sheng1",
    diacriticPinyin: "yī shēng",
    normalizedPinyin: "yi sheng",
    meaning: "doctor; physician",
  },
  {
    simplifiedHanzi: "医院",
    numberedPinyin: "yi1 yuan4",
    diacriticPinyin: "yī yuàn",
    normalizedPinyin: "yi yuan",
    meaning: "hospital",
  },
  {
    simplifiedHanzi: "公共汽车",
    numberedPinyin: "gong1 gong4 qi4 che1",
    diacriticPinyin: "gōng gòng qì chē",
    normalizedPinyin: "gong gong qi che",
    meaning: "public bus",
  },
  {
    simplifiedHanzi: "火车",
    numberedPinyin: "huo3 che1",
    diacriticPinyin: "huǒ chē",
    normalizedPinyin: "huo che",
    meaning: "train",
  },
  {
    simplifiedHanzi: "飞机",
    numberedPinyin: "fei1 ji1",
    diacriticPinyin: "fēi jī",
    normalizedPinyin: "fei ji",
    meaning: "airplane; aircraft",
  },
  {
    simplifiedHanzi: "酒店",
    numberedPinyin: "jiu3 dian4",
    diacriticPinyin: "jiǔ diàn",
    normalizedPinyin: "jiu dian",
    meaning: "hotel",
  },
  {
    simplifiedHanzi: "地图",
    numberedPinyin: "di4 tu2",
    diacriticPinyin: "dì tú",
    normalizedPinyin: "di tu",
    meaning: "map",
  },
  {
    simplifiedHanzi: "天气",
    numberedPinyin: "tian1 qi4",
    diacriticPinyin: "tiān qì",
    normalizedPinyin: "tian qi",
    meaning: "weather",
  },
  {
    simplifiedHanzi: "下雨",
    numberedPinyin: "xia4 yu3",
    diacriticPinyin: "xià yǔ",
    normalizedPinyin: "xia yu",
    meaning: "to rain; rainfall",
  },
  {
    simplifiedHanzi: "太阳",
    numberedPinyin: "tai4 yang2",
    diacriticPinyin: "tài yáng",
    normalizedPinyin: "tai yang",
    meaning: "sun",
  },
  {
    simplifiedHanzi: "山",
    numberedPinyin: "shan1",
    diacriticPinyin: "shān",
    normalizedPinyin: "shan",
    meaning: "mountain; hill",
  },
  {
    simplifiedHanzi: "河",
    numberedPinyin: "he2",
    diacriticPinyin: "hé",
    normalizedPinyin: "he",
    meaning: "river",
  },
  {
    simplifiedHanzi: "海",
    numberedPinyin: "hai3",
    diacriticPinyin: "hǎi",
    normalizedPinyin: "hai",
    meaning: "sea; ocean",
  },
  {
    simplifiedHanzi: "花",
    numberedPinyin: "hua1",
    diacriticPinyin: "huā",
    normalizedPinyin: "hua",
    meaning: "flower; blossom",
  },
  {
    simplifiedHanzi: "树",
    numberedPinyin: "shu4",
    diacriticPinyin: "shù",
    normalizedPinyin: "shu",
    meaning: "tree",
  },
  {
    simplifiedHanzi: "鸟",
    numberedPinyin: "niao3",
    diacriticPinyin: "niǎo",
    normalizedPinyin: "niao",
    meaning: "bird",
  },
  {
    simplifiedHanzi: "猫",
    numberedPinyin: "mao1",
    diacriticPinyin: "māo",
    normalizedPinyin: "mao",
    meaning: "cat",
  },
  {
    simplifiedHanzi: "狗",
    numberedPinyin: "gou3",
    diacriticPinyin: "gǒu",
    normalizedPinyin: "gou",
    meaning: "dog",
  },
  {
    simplifiedHanzi: "米饭",
    numberedPinyin: "mi3 fan4",
    diacriticPinyin: "mǐ fàn",
    normalizedPinyin: "mi fan",
    meaning: "cooked rice",
  },
  {
    simplifiedHanzi: "茶",
    numberedPinyin: "cha2",
    diacriticPinyin: "chá",
    normalizedPinyin: "cha",
    meaning: "tea",
  },
  {
    simplifiedHanzi: "咖啡",
    numberedPinyin: "ka1 fei1",
    diacriticPinyin: "kā fēi",
    normalizedPinyin: "ka fei",
    meaning: "coffee",
  },
  {
    simplifiedHanzi: "苹果",
    numberedPinyin: "ping2 guo3",
    diacriticPinyin: "píng guǒ",
    normalizedPinyin: "ping guo",
    meaning: "apple",
  },
  {
    simplifiedHanzi: "篮球",
    numberedPinyin: "lan2 qiu2",
    diacriticPinyin: "lán qiú",
    normalizedPinyin: "lan qiu",
    meaning: "basketball",
  },
  {
    simplifiedHanzi: "跑步",
    numberedPinyin: "pao3 bu4",
    diacriticPinyin: "pǎo bù",
    normalizedPinyin: "pao bu",
    meaning: "jog; run (for exercise)",
  },
  {
    simplifiedHanzi: "音乐",
    numberedPinyin: "yin1 yue4",
    diacriticPinyin: "yīn yuè",
    normalizedPinyin: "yin yue",
    meaning: "music",
  },
  {
    simplifiedHanzi: "电影",
    numberedPinyin: "dian4 ying3",
    diacriticPinyin: "diàn yǐng",
    normalizedPinyin: "dian ying",
    meaning: "movie; film",
  },
  {
    simplifiedHanzi: "书",
    numberedPinyin: "shu1",
    diacriticPinyin: "shū",
    normalizedPinyin: "shu",
    meaning: "book",
  },
  {
    simplifiedHanzi: "电脑",
    numberedPinyin: "dian4 nao3",
    diacriticPinyin: "diàn nǎo",
    normalizedPinyin: "dian nao",
    meaning: "computer",
  },
  {
    simplifiedHanzi: "手机",
    numberedPinyin: "shou3 ji1",
    diacriticPinyin: "shǒu jī",
    normalizedPinyin: "shou ji",
    meaning: "mobile phone; cellphone",
  },
  {
    simplifiedHanzi: "互联网",
    numberedPinyin: "hu4 lian2 wang3",
    diacriticPinyin: "hù lián wǎng",
    normalizedPinyin: "hu lian wang",
    meaning: "internet",
  },
  {
    simplifiedHanzi: "快乐",
    numberedPinyin: "kuai4 le4",
    diacriticPinyin: "kuài lè",
    normalizedPinyin: "kuai le",
    meaning: "happy; happiness",
  },
  {
    simplifiedHanzi: "难过",
    numberedPinyin: "nan2 guo4",
    diacriticPinyin: "nán guò",
    normalizedPinyin: "nan guo",
    meaning: "sad; feel bad; hard to get through (situation)",
  },
  {
    simplifiedHanzi: "梦想",
    numberedPinyin: "meng4 xiang3",
    diacriticPinyin: "mèng xiǎng",
    normalizedPinyin: "meng xiang",
    meaning: "dream; aspiration",
  },
  {
    simplifiedHanzi: "希望",
    numberedPinyin: "xi1 wang4",
    diacriticPinyin: "xī wàng",
    normalizedPinyin: "xi wang",
    meaning: "hope; wish",
  },
  {
    simplifiedHanzi: "城市",
    numberedPinyin: "cheng2 shi4",
    diacriticPinyin: "chéng shì",
    normalizedPinyin: "cheng shi",
    meaning: "city",
  },
];

// Builds one searchable string from all five fields.
function entryHaystack(entry: DictionaryEntryRow): string {
  return [
    entry.simplifiedHanzi,
    entry.numberedPinyin,
    entry.diacriticPinyin,
    entry.normalizedPinyin,
    entry.meaning,
  ].join("\u0000");
}

export function filterDictionaryEntries(
  entries: DictionaryEntryRow[],
  query: string,
): DictionaryEntryRow[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return entries;
  }

  const needle = trimmed.toLowerCase();
  return entries.filter((entry) => entryHaystack(entry).toLowerCase().includes(needle));
}