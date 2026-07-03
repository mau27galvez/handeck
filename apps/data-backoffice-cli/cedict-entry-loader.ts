import {
  finalizeDictionaryEntry,
  parseCedictLineRaw,
  type DictionaryEntry,
  type RawCedictEntry,
} from "./CedictParser";
import { DICT_CUSTOMIZATIONS } from "./dict-customizations";
import { collectSearchPinyinSyllables, toDiacriticPinyin } from "./utils";

type LoadDictionaryEntriesOptions = {
  maxEntries?: number;
  includeCustomizations?: boolean;
  warn?: (message: string) => void;
};

export type LoadedDictionaryEntries = {
  entries: DictionaryEntry[];
  parsed: number;
  skipped: number;
  customized: number;
};

type VariantReference = {
  simplifiedHanzi: string;
  numberedPinyinSearch?: string;
  notePinyin?: string;
  qualifier?: string;
};

export function loadDictionaryEntries(
  contents: string,
  options: LoadDictionaryEntriesOptions = {},
): LoadedDictionaryEntries {
  const warn = options.warn ?? console.warn;
  const rawEntries: RawCedictEntry[] = [];
  let skipped = 0;

  for (const line of contents.split(/\r?\n/)) {
    if (options.maxEntries !== undefined && rawEntries.length >= options.maxEntries) {
      break;
    }

    const entry = parseCedictLineRaw(line);
    if (!entry) {
      skipped += 1;
      continue;
    }

    rawEntries.push(entry);
  }

  const rawEntriesByHanzi = indexRawEntriesByHanzi(rawEntries);
  const resolvedRawEntries = rawEntries.map((entry) =>
    resolveVariantOnlyEntry(entry, rawEntriesByHanzi, new Set(), warn),
  );
  const entries = resolvedRawEntries.map(finalizeDictionaryEntry);
  const customized =
    options.includeCustomizations === false ? 0 : appendCustomizations(entries, warn);

  return {
    entries,
    parsed: rawEntries.length,
    skipped,
    customized,
  };
}

function indexRawEntriesByHanzi(rawEntries: RawCedictEntry[]) {
  const byHanzi = new Map<string, RawCedictEntry[]>();

  for (const entry of rawEntries) {
    const bucket = byHanzi.get(entry.simplifiedHanzi);
    if (bucket) {
      bucket.push(entry);
    } else {
      byHanzi.set(entry.simplifiedHanzi, [entry]);
    }
  }

  return byHanzi;
}

function resolveVariantOnlyEntry(
  entry: RawCedictEntry,
  rawEntriesByHanzi: Map<string, RawCedictEntry[]>,
  visitedKeys: Set<string>,
  warn: (message: string) => void,
): RawCedictEntry {
  if (!isVariantOnlyEntry(entry)) {
    return entry;
  }

  const entryKey = rawEntryKey(entry);
  if (visitedKeys.has(entryKey)) {
    warn(`Could not resolve variant cycle at ${entry.simplifiedHanzi} (${entry.numberedPinyin}).`);
    return entry;
  }

  visitedKeys.add(entryKey);
  const resolvedSenses: string[] = [];

  for (const sense of entry.senses) {
    const reference = parseVariantReference(sense);
    if (!reference) {
      warn(`Could not parse variant reference for ${entry.simplifiedHanzi}: ${sense}`);
      return entry;
    }

    const target = findVariantTarget(reference, entry, rawEntriesByHanzi);
    if (!target) {
      warn(
        `Could not resolve variant target ${reference.simplifiedHanzi} for ${entry.simplifiedHanzi}.`,
      );
      return entry;
    }

    const resolvedTarget = resolveVariantOnlyEntry(
      target,
      rawEntriesByHanzi,
      new Set(visitedKeys),
      warn,
    );

    if (isVariantOnlyEntry(resolvedTarget)) {
      return entry;
    }

    const targetMeaning = finalizeDictionaryEntry(resolvedTarget).meaning;
    resolvedSenses.push(`${targetMeaning} (${formatVariantNote(reference)})`);
  }

  return {
    ...entry,
    senses: resolvedSenses,
  };
}

function isVariantOnlyEntry(entry: RawCedictEntry) {
  return entry.senses.length > 0 && entry.senses.every(isVariantSense);
}

function isVariantSense(sense: string) {
  return sense.trim().startsWith("variant of ");
}

function rawEntryKey(entry: RawCedictEntry) {
  return `${entry.simplifiedHanzi}\t${numberedPinyinSearch(entry.numberedPinyin)}`;
}

function parseVariantReference(sense: string): VariantReference | null {
  const rest = sense.trim().slice("variant of ".length).trim();
  if (!rest) {
    return null;
  }

  const openBracket = rest.indexOf("[");
  if (openBracket === -1) {
    const [targetToken, ...qualifierParts] = rest.split(/\s+/);
    if (!targetToken) {
      return null;
    }

    return {
      simplifiedHanzi: simplifiedCrossReference(targetToken),
      qualifier: qualifierParts.join(" ") || undefined,
    };
  }

  const closeBracket = rest.indexOf("]", openBracket + 1);
  if (closeBracket === -1) {
    return null;
  }

  const targetToken = rest.slice(0, openBracket).trim();
  const notePinyin = rest.slice(openBracket + 1, closeBracket).trim();
  const qualifier = rest.slice(closeBracket + 1).trim();

  if (!targetToken || !notePinyin) {
    return null;
  }

  return {
    simplifiedHanzi: simplifiedCrossReference(targetToken),
    numberedPinyinSearch: numberedPinyinSearch(notePinyin),
    notePinyin,
    qualifier: qualifier || undefined,
  };
}

function simplifiedCrossReference(reference: string) {
  return reference.includes("|") ? reference.split("|").at(-1)! : reference;
}

function findVariantTarget(
  reference: VariantReference,
  sourceEntry: RawCedictEntry,
  rawEntriesByHanzi: Map<string, RawCedictEntry[]>,
) {
  const candidates = (rawEntriesByHanzi.get(reference.simplifiedHanzi) ?? []).filter(
    (candidate) => candidate !== sourceEntry,
  );

  if (reference.numberedPinyinSearch) {
    const matchingCandidates = candidates.filter(
      (candidate) =>
        numberedPinyinSearch(candidate.numberedPinyin) === reference.numberedPinyinSearch,
    );

    return (
      matchingCandidates.find((candidate) => !isVariantOnlyEntry(candidate)) ??
      matchingCandidates[0]
    );
  }

  const nonVariantCandidates = candidates.filter((candidate) => !isVariantOnlyEntry(candidate));
  return nonVariantCandidates.length === 1 ? nonVariantCandidates[0] : undefined;
}

function formatVariantNote(reference: VariantReference) {
  const pinyin = reference.notePinyin ? `[${toDiacriticPinyin(reference.notePinyin)}]` : "";
  const qualifier = reference.qualifier ? ` ${reference.qualifier}` : "";
  return `variant of ${reference.simplifiedHanzi}${pinyin}${qualifier}`;
}

function numberedPinyinSearch(numberedPinyin: string) {
  return collectSearchPinyinSyllables(numberedPinyin)
    .map((syllable) => syllable.numbered)
    .join("");
}

function appendCustomizations(entries: DictionaryEntry[], warn: (message: string) => void) {
  const existingKeys = new Set(entries.map(dictionaryEntryKey));
  let customized = 0;

  for (const customization of DICT_CUSTOMIZATIONS) {
    const rawEntry = parseCedictLineRaw(customization.line);
    if (!rawEntry) {
      throw new Error(`Invalid dictionary customization: ${customization.line}`);
    }

    const entry = finalizeDictionaryEntry(rawEntry);
    const key = dictionaryEntryKey(entry);
    if (existingKeys.has(key)) {
      warn(
        `Skipping dictionary customization for ${entry.simplifiedHanzi}: ${customization.reason}`,
      );
      continue;
    }

    entries.push(entry);
    existingKeys.add(key);
    customized += 1;
  }

  return customized;
}

function dictionaryEntryKey(
  entry: Pick<DictionaryEntry, "simplifiedHanzi" | "numberedPinyinSearch">,
) {
  return `${entry.simplifiedHanzi}\t${entry.numberedPinyinSearch}`;
}
