import { convert } from "pinyin-pro";

const DIACRITIC_VOWELS = new Set("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ");
const PLAIN_PINYIN_VOWELS = new Set("aeiouüAEIOUÜ");
const PINYIN_CONSONANTS = new Set("bpmfdtnlgkhjqxzcsrywBPMFDTNLGKHJQXZCSRYW");

export function toNumberedPinyinSearchFromDiacritic(pinyin: string) {
  const withoutSpaces = pinyin.replace(/[\s]+/g, "");
  const parts = withoutSpaces.split(/['\u2019-]+/).filter((part) => part.length > 0);
  const syllables = parts.flatMap(splitDiacriticSyllables);
  const numberedSyllables = syllables.map((syllable) =>
    convert(syllable, { format: "symbolToNum" }),
  );

  return normalizeCedictNumberedSearch(numberedSyllables);
}

/** HSK pinyin uses spaces, apostrophes, and hyphens between spoken chunks. */
export function splitHskDiacriticParts(pinyin: string) {
  return pinyin
    .trim()
    .split(/[\s'\u2019-]+/)
    .filter((part) => part.length > 0);
}

export function splitDiacriticSyllables(chunk: string) {
  const syllables: string[] = [];
  let index = 0;

  while (index < chunk.length) {
    const syllable = readDiacriticSyllable(chunk, index);
    if (!syllable) {
      throw new Error(`Invalid diacritic pinyin near "${chunk.slice(index)}" in "${chunk}".`);
    }

    syllables.push(syllable.text);
    index += syllable.length;
  }

  return syllables;
}

function readDiacriticSyllable(text: string, start: number) {
  if (start >= text.length) {
    return null;
  }

  let end = start;

  while (
    end < text.length &&
    isPinyinConsonant(text.charAt(end)) &&
    !isVowelChar(text.charAt(end))
  ) {
    end += 1;
  }

  if (end >= text.length || !isVowelChar(text.charAt(end))) {
    return null;
  }

  end = readVowelCluster(text, end);

  if (text.slice(end, end + 2) === "ng") {
    end += 2;
  }

  if (text.charAt(end) === "n" && !isVowelChar(text.charAt(end + 1))) {
    end += 1;
  }

  if (text.charAt(end) === "r" && !isVowelChar(text.charAt(end + 1))) {
    end += 1;
  }

  if (end <= start) {
    return null;
  }

  return {
    text: text.slice(start, end),
    length: end - start,
  };
}

function readVowelCluster(text: string, start: number) {
  let end = start + 1;
  let sawPlainVowel = isPlainPinyinVowel(text.charAt(start));
  let sawTonedVowel = DIACRITIC_VOWELS.has(text.charAt(start));

  while (end < text.length) {
    const char = text.charAt(end);

    if (isPlainPinyinVowel(char)) {
      end += 1;
      sawPlainVowel = true;
      continue;
    }

    if (DIACRITIC_VOWELS.has(char)) {
      if (sawPlainVowel && !sawTonedVowel) {
        end += 1;
        sawTonedVowel = true;
        continue;
      }

      break;
    }

    break;
  }

  return end;
}

function normalizeCedictNumberedSearch(syllables: string[]) {
  const normalized = syllables.map(normalizeCedictNumberedSyllable);

  if (normalized.length >= 2 && normalized.at(-1) === "r") {
    normalized.pop();
    normalized[normalized.length - 1] = `${normalized[normalized.length - 1]}r5`;
  }

  return normalized.join("");
}

function normalizeCedictNumberedSyllable(syllable: string) {
  let normalized = syllable
    .replaceAll("u:", "v")
    .replaceAll("U:", "v")
    .replaceAll("ü", "v")
    .replaceAll("Ü", "v")
    .toLowerCase()
    .replaceAll("0", "5");

  if (/^[a-z]+[1-5]r$/.test(normalized)) {
    normalized = `${normalized}5`;
  }

  return normalized;
}

function isVowelChar(char: string) {
  return isPlainPinyinVowel(char) || DIACRITIC_VOWELS.has(char);
}

function isPlainPinyinVowel(char: string) {
  return PLAIN_PINYIN_VOWELS.has(char);
}

function isPinyinConsonant(char: string) {
  return PINYIN_CONSONANTS.has(char);
}
