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

type SearchPinyinSyllable = {
  normalized: string;
  numbered: string;
};

export function parseCedictLine(line: string): DictionaryEntry | null {
  if (!line || line.startsWith("#")) {
    return null;
  }

  // CC-CEDICT v2: Traditional Simplified [[pinyin]] /sense/sense/.../
  // https://cc-cedict.org/wiki/syntax_v2
  const match = line.match(/^(\S+)\s+(\S+)\s+\[\[(.*?)\]\]\s+\/(.+)\/$/);
  if (!match) {
    return null;
  }

  const [, , simplifiedHanzi, rawPinyin, rawMeaning] = match;
  const senses = rawMeaning?.split("/").filter(Boolean) ?? [];
  const keptSenses = senses.filter((sense) => !isOldVariantSense(sense));
  if (keptSenses.length === 0) {
    return null;
  }

  const numberedPinyin = unwrapBracedLiterals(rawPinyin?.trim().replace(/\s+/g, " ") ?? "");
  const searchPinyinSyllables = getSearchPinyinSyllables(numberedPinyin);

  return {
    simplifiedHanzi: unwrapBracedLiterals(simplifiedHanzi ?? ""),
    numberedPinyin,
    diacriticPinyin: toDiacriticPinyin(numberedPinyin),
    normalizedPinyin: searchPinyinSyllables.map((syllable) => syllable.normalized).join(""),
    numberedPinyinSearch: searchPinyinSyllables.map((syllable) => syllable.numbered).join(""),
    pinyinSyllables: searchPinyinSyllables.map((syllable) => syllable.normalized),
    numberedPinyinSyllables: searchPinyinSyllables.map((syllable) => syllable.numbered),
    meaning: formatDefinitionPinyin(keptSenses.join("; ")),
  };
}

function isOldVariantSense(sense: string) {
  return sense.trim().startsWith("old variant of ");
}

function unwrapBracedLiterals(value: string): string {
  return value.replace(/\{([^}]+)\}/g, "$1");
}

function formatDefinitionPinyin(meaning: string): string {
  return meaning.replace(/\[([^\][]+)\]/g, (match, bracketedPinyin: string) => {
    if (!looksLikeNumberedPinyin(bracketedPinyin)) {
      return match;
    }

    return `[${toDiacriticPinyin(bracketedPinyin)}]`;
  });
}

function looksLikeNumberedPinyin(value: string) {
  return /[a-zü:]/.test(value) && /[a-zA-ZüÜ:]+[1-5]/.test(value);
}

/**
 * Maps numbered CC-CEDICT v2 pinyin to diacritic or normalized form while preserving:
 * - spaces and ", " only between v2 words (never between syllables inside a word);
 * - hyphens between hyphenated pieces;
 * - apostrophes between syllables (e.g. si4'er4yi1).
 */
function mapV2PinyinWordStructure(
  pinyin: string,
  mapSyllable: (numberedSyllable: string) => string,
): string {
  const trimmed = pinyin.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(/(\s+|,\s*)/);
  return parts
    .map((part) => {
      if (/^\s+$/.test(part) || /^,\s*$/.test(part)) {
        return part;
      }
      return mapV2PinyinWordToken(part, mapSyllable);
    })
    .join("");
}

function mapV2PinyinWordToken(token: string, mapSyllable: (s: string) => string): string {
  if (token.includes("-")) {
    return token
      .split("-")
      .filter(Boolean)
      .map((piece) => mapBraceOrGluedPiece(piece, mapSyllable))
      .join("-");
  }
  return mapBraceOrGluedPiece(token, mapSyllable);
}

function mapBraceOrGluedPiece(piece: string, mapSyllable: (s: string) => string): string {
  if (piece.startsWith("{") && piece.endsWith("}")) {
    const inner = piece.slice(1, -1);
    if (/^\d+$/.test(inner)) {
      return inner;
    }
    return transformGluedChunk(inner, mapSyllable);
  }
  return transformGluedChunk(piece, mapSyllable);
}

function transformGluedChunk(chunk: string, mapSyllable: (s: string) => string): string {
  let out = "";
  let index = 0;
  while (index < chunk.length) {
    if (chunk.charAt(index) === "'") {
      out += "'";
      index += 1;
      continue;
    }
    const rest = chunk.slice(index);
    const syllable = rest.match(/^([a-zA-ZüÜ:]+)([1-5])/);
    if (syllable) {
      out += mapSyllable(syllable[1]! + syllable[2]!);
      index += syllable[0].length;
      continue;
    }
    const latin = rest.match(/^([a-zA-Z0-9]+)/);
    if (latin) {
      out += latin[1]!;
      index += latin[1]!.length;
      continue;
    }
    out += chunk.charAt(index);
    index += 1;
  }
  return out;
}

function toDiacriticPinyin(numberedPinyin: string): string {
  return mapV2PinyinWordStructure(numberedPinyin, (syllable) => applyToneMark(syllable));
}

function getSearchPinyinSyllables(numberedPinyin: string): SearchPinyinSyllable[] {
  const syllables: SearchPinyinSyllable[] = [];
  mapV2PinyinWordStructure(numberedPinyin, (syllable) => {
    if (!/[a-zA-ZüÜ]/.test(syllable)) {
      return syllable;
    }
    syllables.push(normalizeSearchPinyinSyllable(syllable));
    return syllable;
  });
  return syllables;
}

function normalizeSearchPinyinSyllable(syllable: string): SearchPinyinSyllable {
  const match = syllable.match(/^(.*?)([1-5])$/);
  const base = (match?.[1] ?? syllable).replace(/u:/gi, "v").replace(/ü/gi, "v").toLowerCase();
  const tone = match?.[2] ?? "";

  return {
    normalized: base,
    numbered: `${base}${tone}`,
  };
}

function applyToneMark(syllable: string): string {
  const match = syllable.match(/^(.*?)([1-5])$/);
  if (!match) {
    return syllable.replace(/u:/gi, "ü");
  }

  const [, rawBase, rawTone] = match;
  if (!rawBase || !rawTone) {
    return syllable.replace(/u:/gi, "ü");
  }

  // v2 literals like `{11}` expand to "11"; do not treat trailing digits as tone marks.
  if (!/[a-zA-ZüÜ]/.test(rawBase)) {
    return syllable.replace(/u:/gi, "ü");
  }

  const tone = Number.parseInt(rawTone, 10);
  const base = rawBase.replace(/u:/gi, "ü");

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

function getToneVowelIndex(syllable: string): number {
  const lower = syllable.replace(/u:/gi, "ü").toLowerCase();

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

function markTone(vowel: string, tone: number) {
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
