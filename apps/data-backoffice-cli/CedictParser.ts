export type DictionaryEntry = {
  simplifiedHanzi: string;
  numberedPinyin: string;
  diacriticPinyin: string;
  normalizedPinyin: string;
  numberedPinyinSearch: string;
  pinyinSyllables: string[];
  numberedPinyinSyllables: string[];
  meaning: string;
};

type Tone = 1 | 2 | 3 | 4 | 5;

type SearchPinyinSyllable = {
  normalized: string;
  numbered: string;
};

export function parseCedictLine(line: string) {
  if (!line || line.startsWith("#")) {
    return null;
  }

  const fields = parseCedictFields(line);
  if (!fields) {
    return null;
  }

  const { simplifiedHanzi, rawPinyin, rawMeaning } = fields;
  const keptSenses = parseSenses(rawMeaning).filter((sense) => !isOldVariantSense(sense));
  if (keptSenses.length === 0) {
    return null;
  }

  const numberedPinyin = unwrapBracedLiterals(normalizeWhitespace(rawPinyin));
  const searchPinyinSyllables = collectSearchPinyinSyllables(numberedPinyin);

  return {
    simplifiedHanzi: unwrapBracedLiterals(simplifiedHanzi),
    numberedPinyin,
    diacriticPinyin: toDiacriticPinyin(numberedPinyin),
    normalizedPinyin: searchPinyinSyllables.map((syllable) => syllable.normalized).join(""),
    numberedPinyinSearch: searchPinyinSyllables.map((syllable) => syllable.numbered).join(""),
    pinyinSyllables: searchPinyinSyllables.map((syllable) => syllable.normalized),
    numberedPinyinSyllables: searchPinyinSyllables.map((syllable) => syllable.numbered),
    meaning: formatDefinitionPinyin(keepSimplifiedHanziInDefinition(keptSenses.join("; "))),
  };
}

function parseCedictFields(line: string) {
  const pinyinStart = line.indexOf("[[");
  const pinyinEnd = line.indexOf("]]", pinyinStart + 2);
  if (pinyinStart === -1 || pinyinEnd === -1) {
    return null;
  }

  const head = line.slice(0, pinyinStart).trim();
  const rawPinyin = line.slice(pinyinStart + 2, pinyinEnd);
  const tail = line.slice(pinyinEnd + 2).trim();
  if (!tail.startsWith("/") || !tail.endsWith("/")) {
    return null;
  }

  const headParts = splitOnWhitespace(head);
  if (headParts.length < 2) {
    return null;
  }

  return {
    simplifiedHanzi: headParts[1]!,
    rawPinyin,
    rawMeaning: tail.slice(1, -1),
  };
}

function splitOnWhitespace(text: string) {
  const parts: string[] = [];
  let current = "";

  for (const char of text) {
    if (char === " " || char === "\t") {
      if (current) {
        parts.push(current);
        current = "";
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

function parseSenses(rawMeaning: string) {
  return rawMeaning.split("/").filter(Boolean);
}

function isOldVariantSense(sense: string) {
  return sense.trim().startsWith("old variant of ");
}

function normalizeWhitespace(text: string) {
  let result = "";
  let inWhitespace = false;

  for (const char of text.trim()) {
    if (char === " " || char === "\t" || char === "\n") {
      if (!inWhitespace && result.length > 0) {
        result += " ";
        inWhitespace = true;
      }

      continue;
    }

    result += char;
    inWhitespace = false;
  }

  return result;
}

function unwrapBracedLiterals(value: string) {
  let result = "";
  let index = 0;

  while (index < value.length) {
    if (value.charAt(index) === "{") {
      const close = value.indexOf("}", index + 1);
      if (close === -1) {
        result += value.slice(index);
        break;
      }

      result += value.slice(index + 1, close);
      index = close + 1;
      continue;
    }

    result += value.charAt(index);
    index += 1;
  }

  return result;
}

// When it hits a |, it walks backward and forward to find the traditional
// and simplified tokens (stopping at whitespace, brackets, slashes, etc.),
// drops the traditional part, and keeps only the simplified one.
function keepSimplifiedHanziInDefinition(text: string) {
  let result = "";
  let index = 0;

  while (index < text.length) {
    if (text.charAt(index) !== "|") {
      result += text.charAt(index);
      index += 1;
      continue;
    }

    let tradStart = index;
    while (tradStart > 0 && isCrossReferenceChar(text.charAt(tradStart - 1))) {
      tradStart -= 1;
    }

    let simpEnd = index + 1;
    while (simpEnd < text.length && isCrossReferenceChar(text.charAt(simpEnd))) {
      simpEnd += 1;
    }

    const traditional = text.slice(tradStart, index);
    const simplified = text.slice(index + 1, simpEnd);

    if (traditional.length > 0 && simplified.length > 0) {
      result = result.slice(0, result.length - traditional.length) + simplified;
      index = simpEnd;
      continue;
    }

    result += "|";
    index += 1;
  }

  return result;
}

function isCrossReferenceChar(char: string) {
  return (
    char !== "|" &&
    char !== "/" &&
    char !== "[" &&
    char !== "]" &&
    char !== "(" &&
    char !== ")" &&
    char !== " " &&
    char !== "\t" &&
    char !== "\n"
  );
}

function formatDefinitionPinyin(meaning: string) {
  let result = "";
  let index = 0;

  while (index < meaning.length) {
    const open = meaning.indexOf("[", index);
    if (open === -1) {
      result += meaning.slice(index);
      break;
    }

    result += meaning.slice(index, open);
    const close = meaning.indexOf("]", open + 1);
    if (close === -1) {
      result += meaning.slice(open);
      break;
    }

    const bracketed = meaning.slice(open + 1, close);
    if (looksLikeNumberedPinyin(bracketed)) {
      result += `[${toDiacriticPinyin(bracketed)}]`;
    } else {
      result += `[${bracketed}]`;
    }

    index = close + 1;
  }

  return result;
}

function looksLikeNumberedPinyin(value: string) {
  if (!hasPinyinLetters(value)) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (readNumberedSyllable(value, index)) {
      return true;
    }
  }

  return false;
}

function toDiacriticPinyin(numberedPinyin: string) {
  return mapPinyin(numberedPinyin, applyToneMark);
}

function collectSearchPinyinSyllables(numberedPinyin: string) {
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

function readNumberedSyllable(text: string, start: number) {
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
  // Matches pinyin letters (a-z), umlauts (ü/Ü), and the u: separator
  return /[a-zA-ZüÜ:]/.test(char);
}

function isLatinAlphanumeric(char: string) {
  // Matches ASCII letters (a-z) and digits (0-9)
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

function hasPinyinLetters(text: string) {
  for (const char of text) {
    if (isPinyinLetter(char)) {
      return true;
    }
  }

  return false;
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
