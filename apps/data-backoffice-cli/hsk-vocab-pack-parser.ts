import { toNumberedPinyinSearchFromDiacritic } from "./pinyinSearchFromDiacritic";

export type HskVocabPackWord = {
  simplifiedHanzi: string;
  numberedPinyinSearch: string;
};

const PINYIN_LETTER = /[a-zA-Z\u00c0-\u024f]/;

export function parseHskWordList(contents: string) {
  const words: HskVocabPackWord[] = [];
  const lines = contents.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0) {
      continue;
    }

    const columns = line.split("\t");
    const rawHanzi = columns[2]?.trim();

    if (!rawHanzi) {
      throw new Error(`Invalid HSK row ${index + 1}: expected hanzi column.`);
    }

    const rawPinyin = extractHskPinyinFromLine(line);

    if (!rawPinyin) {
      throw new Error(`Invalid HSK row ${index + 1}: expected pinyin after hanzi.`);
    }

    const normalizedPinyin = normalizeHskPinyin(rawPinyin);

    words.push({
      simplifiedHanzi: stripHskHanziSuffix(rawHanzi),
      numberedPinyinSearch: toNumberedPinyinSearchFromDiacritic(normalizedPinyin),
    });
  }

  return words;
}

export function extractHskPinyinFromLine(line: string) {
  const columns = line.split("\t");
  const afterHanzi = columns.slice(3).join("\t");

  let first = -1;
  let last = -1;

  for (let index = 0; index < afterHanzi.length; index += 1) {
    const char = afterHanzi.charAt(index);

    if (!isPinyinLetter(char)) {
      continue;
    }

    if (first === -1) {
      first = index;
    }

    last = index;
  }

  if (first === -1 || last === -1) {
    return null;
  }

  return afterHanzi.slice(first, last + 1);
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

  return normalized.replace(/[\s]+/g, "");
}

function isPinyinLetter(char: string) {
  return PINYIN_LETTER.test(char);
}
