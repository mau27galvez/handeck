import {
  collectSearchPinyinSyllables,
  hasPinyinLetters,
  readNumberedSyllable,
  toDiacriticPinyin,
} from "./utils";

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
