import { toNumberedPinyinSearchFromDiacritic } from "./utils";

export type HskVocabPackWord = {
  simplifiedHanzi: string;
  numberedPinyinSearch: string;
};

export function parseHskWordList(contents: string) {
  const words: HskVocabPackWord[] = [];
  const lines = contents.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0) {
      continue;
    }

    const columns = line.split("\t");
    const rawHanzi = columns[2]?.trim();
    const rawPinyin = columns[3]?.trim();

    if (!rawHanzi || !rawPinyin) {
      throw new Error(`Invalid HSK row ${index + 1}: expected hanzi and pinyin columns.`);
    }

    const normalizedPinyin = normalizeHskPinyin(rawPinyin);

    words.push({
      simplifiedHanzi: stripHskHanziSuffix(rawHanzi),
      numberedPinyinSearch: toNumberedPinyinSearchFromDiacritic(normalizedPinyin),
    });
  }

  return words;
}

export function stripHskHanziSuffix(hanzi: string) {
  return hanzi.replace(/[0-9]+$/, "");
}

/** HSK lists alternative pronunciations separated by slashes; CC-CEDICT uses the first one. */
export function takeFirstHskPinyinAlternative(pinyin: string) {
  return pinyin.split("/")[0]!.trim();
}

export function normalizeHskPinyin(pinyin: string) {
  let normalized = takeFirstHskPinyinAlternative(pinyin);

  if (normalized === "ǹg") {
    normalized = "èn";
  }

  return normalized;
}
