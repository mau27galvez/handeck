export type Tone = 1 | 2 | 3 | 4 | 5;

export type SearchPinyinSyllable = {
  normalized: string;
  numbered: string;
};

const DIACRITIC_VOWEL_TO_BASE_AND_TONE: Record<string, readonly [string, Tone]> = {
  ā: ["a", 1],
  á: ["a", 2],
  ǎ: ["a", 3],
  à: ["a", 4],
  ē: ["e", 1],
  é: ["e", 2],
  ě: ["e", 3],
  è: ["e", 4],
  ī: ["i", 1],
  í: ["i", 2],
  ǐ: ["i", 3],
  ì: ["i", 4],
  ō: ["o", 1],
  ó: ["o", 2],
  ǒ: ["o", 3],
  ò: ["o", 4],
  ū: ["u", 1],
  ú: ["u", 2],
  ǔ: ["u", 3],
  ù: ["u", 4],
  ǖ: ["v", 1],
  ǘ: ["v", 2],
  ǚ: ["v", 3],
  ǜ: ["v", 4],
  Ā: ["a", 1],
  Á: ["a", 2],
  Ǎ: ["a", 3],
  À: ["a", 4],
  Ē: ["e", 1],
  É: ["e", 2],
  Ě: ["e", 3],
  È: ["e", 4],
  Ī: ["i", 1],
  Í: ["i", 2],
  Ǐ: ["i", 3],
  Ì: ["i", 4],
  Ō: ["o", 1],
  Ó: ["o", 2],
  Ǒ: ["o", 3],
  Ò: ["o", 4],
  Ū: ["u", 1],
  Ú: ["u", 2],
  Ǔ: ["u", 3],
  Ù: ["u", 4],
  Ǖ: ["v", 1],
  Ǘ: ["v", 2],
  Ǚ: ["v", 3],
  Ǜ: ["v", 4],
};

export function toNumberedPinyinSearchFromDiacritic(pinyin: string) {
  const compact = pinyin.trim().replace(/[\s'\u2019-]+/g, "");
  const syllables = splitDiacriticPinyin(compact);

  return syllables.map((syllable) => diacriticSyllableToNumbered(syllable)).join("");
}

export function toDiacriticPinyin(numberedPinyin: string) {
  return mapPinyin(numberedPinyin, applyToneMark);
}

export function collectSearchPinyinSyllables(numberedPinyin: string) {
  const syllables: SearchPinyinSyllable[] = [];

  mapPinyin(numberedPinyin, (syllable) => {
    if (!hasPinyinLetters(syllable)) {
      return syllable;
    }

    syllables.push(normalizeSearchPinyinSyllable(syllable));
    return syllable;
  });

  return syllables;
}

export function readNumberedSyllable(text: string, start: number) {
  let end = start;

  while (end < text.length && isPinyinLetter(text.charAt(end))) {
    end += 1;
  }

  if (end === start) {
    return null;
  }

  const toneChar = text.charAt(end);
  if (!isToneDigit(toneChar)) {
    return null;
  }

  return {
    text: text.slice(start, end + 1),
    length: end - start + 1,
  };
}

export function hasPinyinLetters(text: string) {
  for (const char of text) {
    if (isPinyinLetter(char)) {
      return true;
    }
  }

  return false;
}

function splitDiacriticPinyin(pinyin: string) {
  const syllables: string[] = [];
  let index = 0;

  while (index < pinyin.length) {
    const syllable = readDiacriticSyllable(pinyin, index);
    if (!syllable) {
      throw new Error(`Invalid HSK pinyin near "${pinyin.slice(index)}" in "${pinyin}".`);
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
  let hasVowel = false;

  while (end < text.length) {
    const char = text.charAt(end);

    if (DIACRITIC_VOWEL_TO_BASE_AND_TONE[char] || isPlainPinyinVowel(char)) {
      hasVowel = true;
      end += 1;

      while (end < text.length && isPlainPinyinVowel(text.charAt(end))) {
        end += 1;
      }

      if (
        (char === "ü" || char === "Ü") &&
        end < text.length &&
        DIACRITIC_VOWEL_TO_BASE_AND_TONE[text.charAt(end)]
      ) {
        end += 1;
      }

      if (text.slice(end, end + 2) === "ng") {
        end += 2;
      } else if (text.charAt(end) === "n") {
        end += 1;
      }

      if (text.charAt(end) === "r") {
        end += 1;
      }

      break;
    }

    if (isPinyinConsonant(char)) {
      end += 1;
      continue;
    }

    break;
  }

  if (!hasVowel || end <= start) {
    return null;
  }

  return {
    text: text.slice(start, end),
    length: end - start,
  };
}

function diacriticSyllableToNumbered(syllable: string) {
  let letters = "";
  let tone: Tone | null = null;

  for (const char of syllable) {
    const toneVowel = DIACRITIC_VOWEL_TO_BASE_AND_TONE[char];
    if (toneVowel) {
      letters += toneVowel[0];
      tone = toneVowel[1];
      continue;
    }

    letters += normalizeUmlautForSearch(char);
  }

  if (letters.endsWith("r") && (letters.endsWith("nr") || letters.endsWith("ngr"))) {
    letters = letters.slice(0, -1);
    return tone ? `${letters}${tone}r5` : `${letters}r5`;
  }

  return tone ? `${letters}${tone}` : `${letters}5`;
}

function mapPinyin(pinyin: string, mapSyllable: (numberedSyllable: string) => string) {
  return splitPinyinParts(pinyin)
    .map((part) => {
      if (isPinyinSeparator(part)) {
        return part;
      }

      return mapPinyinWord(part, mapSyllable);
    })
    .join("");
}

function splitPinyinParts(pinyin: string) {
  const parts: string[] = [];
  let current = "";

  for (let index = 0; index < pinyin.length; index += 1) {
    const char = pinyin.charAt(index);

    if (char === " ") {
      if (current) {
        parts.push(current);
        current = "";
      }
      parts.push(" ");
      continue;
    }

    if (char === ",") {
      if (current) {
        parts.push(current);
        current = "";
      }
      parts.push(", ");
      if (pinyin.charAt(index + 1) === " ") {
        index += 1;
      }
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function isPinyinSeparator(part: string) {
  return part === " " || part === ", ";
}

function mapPinyinWord(word: string, mapSyllable: (numberedSyllable: string) => string) {
  if (!word.includes("-")) {
    return mapPinyinPiece(word, mapSyllable);
  }

  return word
    .split("-")
    .filter(Boolean)
    .map((piece) => mapPinyinPiece(piece, mapSyllable))
    .join("-");
}

function mapPinyinPiece(piece: string, mapSyllable: (numberedSyllable: string) => string) {
  if (piece.startsWith("{") && piece.endsWith("}")) {
    const inner = piece.slice(1, -1);
    if (isNumericLiteral(inner)) {
      return inner;
    }

    return mapGluedSyllables(inner, mapSyllable);
  }

  return mapGluedSyllables(piece, mapSyllable);
}

function mapGluedSyllables(chunk: string, mapSyllable: (numberedSyllable: string) => string) {
  let output = "";
  let index = 0;

  while (index < chunk.length) {
    if (chunk.charAt(index) === "'") {
      output += "'";
      index += 1;
      continue;
    }

    const numberedSyllable = readNumberedSyllable(chunk, index);
    if (numberedSyllable) {
      output += mapSyllable(numberedSyllable.text);
      index += numberedSyllable.length;
      continue;
    }

    const latinRun = readLatinRun(chunk, index);
    if (latinRun) {
      output += latinRun.text;
      index += latinRun.length;
      continue;
    }

    output += chunk.charAt(index);
    index += 1;
  }

  return output;
}

function readLatinRun(text: string, start: number) {
  let end = start;

  while (end < text.length && isLatinAlphanumeric(text.charAt(end))) {
    end += 1;
  }

  if (end === start) {
    return null;
  }

  return {
    text: text.slice(start, end),
    length: end - start,
  };
}

function splitNumberedSyllable(syllable: string) {
  if (syllable.length === 0) {
    return { letters: syllable, tone: null };
  }

  const toneChar = syllable.charAt(syllable.length - 1);
  if (!isToneDigit(toneChar)) {
    return { letters: syllable, tone: null };
  }

  return {
    letters: syllable.slice(0, -1),
    tone: Number(toneChar) as Tone,
  };
}

function normalizeSearchPinyinSyllable(syllable: string) {
  const { letters, tone } = splitNumberedSyllable(syllable);
  const base = normalizeUmlautForSearch(letters);

  return {
    normalized: base,
    numbered: tone ? `${base}${tone}` : base,
  };
}

function applyToneMark(syllable: string) {
  const { letters, tone } = splitNumberedSyllable(syllable);
  const base = normalizeUmlautForDisplay(letters);

  if (!tone || !hasPinyinLetters(base)) {
    return base;
  }

  if (tone === 5) {
    return base;
  }

  const toneIndex = getToneVowelIndex(base);
  if (toneIndex === -1) {
    return base;
  }

  return (
    base.slice(0, toneIndex) + markTone(base.charAt(toneIndex), tone) + base.slice(toneIndex + 1)
  );
}

function normalizeUmlautForSearch(letters: string) {
  return letters
    .replaceAll("u:", "v")
    .replaceAll("U:", "v")
    .replaceAll("ü", "v")
    .replaceAll("Ü", "v")
    .toLowerCase();
}

function normalizeUmlautForDisplay(letters: string) {
  return letters.replaceAll("u:", "ü").replaceAll("U:", "Ü");
}

function isPinyinLetter(char: string) {
  return /[a-zA-ZüÜ:]/.test(char);
}

function isLatinAlphanumeric(char: string) {
  return /[a-zA-Z0-9]/.test(char);
}

function isToneDigit(char: string) {
  return char === "1" || char === "2" || char === "3" || char === "4" || char === "5";
}

function isNumericLiteral(text: string) {
  if (text.length === 0) {
    return false;
  }

  for (const char of text) {
    if (char < "0" || char > "9") {
      return false;
    }
  }

  return true;
}

function isPlainPinyinVowel(char: string) {
  return /[aeiouüAEIOUÜ]/.test(char);
}

function isPinyinConsonant(char: string) {
  return /[bpmfdtnlgkhjqxzcsrywBPMFDTNLGKHJQXZCSRYW]/.test(char);
}

function getToneVowelIndex(syllable: string) {
  const lower = normalizeUmlautForDisplay(syllable).toLowerCase();

  const iuIndex = lower.indexOf("iu");
  if (iuIndex !== -1) {
    return iuIndex + 1;
  }

  const uiIndex = lower.indexOf("ui");
  if (uiIndex !== -1) {
    return uiIndex + 1;
  }

  const vowelPriority = "aoeiuü";
  let bestIndex = -1;
  let bestRank = vowelPriority.length;

  for (let index = 0; index < lower.length; index += 1) {
    const rank = vowelPriority.indexOf(lower.charAt(index));
    if (rank === -1 || rank >= bestRank) {
      continue;
    }

    bestRank = rank;
    bestIndex = index;
  }

  return bestIndex;
}

function markTone(vowel: string, tone: Tone) {
  const toneMarks: Record<string, string[]> = {
    a: ["a", "ā", "á", "ǎ", "à"],
    e: ["e", "ē", "é", "ě", "è"],
    i: ["i", "ī", "í", "ǐ", "ì"],
    o: ["o", "ō", "ó", "ǒ", "ò"],
    u: ["u", "ū", "ú", "ǔ", "ù"],
    ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
    A: ["A", "Ā", "Á", "Ǎ", "À"],
    E: ["E", "Ē", "É", "Ě", "È"],
    I: ["I", "Ī", "Í", "Ǐ", "Ì"],
    O: ["O", "Ō", "Ó", "Ǒ", "Ò"],
    U: ["U", "Ū", "Ú", "Ǔ", "Ù"],
    Ü: ["Ü", "Ǖ", "Ǘ", "Ǚ", "Ǜ"],
  };

  return toneMarks[vowel]?.[tone] ?? vowel;
}
