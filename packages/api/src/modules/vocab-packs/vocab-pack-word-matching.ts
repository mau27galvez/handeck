export type VocabPackWordReference = {
  simplifiedHanzi: string;
  numberedPinyinSearch: string;
  matchSelector?: VocabPackWordMatchSelector;
};

export type VocabPackWordMatchSelector = {
  meaningStartsWith?: string;
  meaningIncludes?: string;
};

export type DictionaryWordCandidate = {
  id: string;
  simplifiedHanzi: string;
  numberedPinyinSearch: string;
  meaning: string;
};

export type ResolvedVocabPackWordMatches = {
  matchingWords: DictionaryWordCandidate[];
  missingWords: VocabPackWordReference[];
};

export function wordReferenceKey(
  word: Pick<VocabPackWordReference, "simplifiedHanzi" | "numberedPinyinSearch">,
) {
  return `${word.simplifiedHanzi}\t${word.numberedPinyinSearch}`;
}

export function wordReferenceDedupeKey(word: VocabPackWordReference) {
  return `${wordReferenceKey(word)}\t${JSON.stringify(word.matchSelector ?? null)}`;
}

export function isVariantOfDictionaryEntry(meaning: string) {
  return meaning.trim().toLowerCase().startsWith("variant of");
}

export function isSurnameOnlyDictionaryEntry(meaning: string) {
  const senses = splitDictionaryMeaningSenses(meaning);
  return senses.length > 0 && senses.every(isSurnameSense);
}

/** Keep in sync with the SQL filter in getMatchingWordsByReferences. */
export const NON_VARIANT_MEANING_LIKE_PATTERN = "variant of%";

/** CC-CEDICT surname readings use "surname <Name>". Not used in SQL because lexical
 *  senses like "surname and given name" also start with "surname ". */
export const SURNAME_ONLY_MEANING_LIKE_PATTERN = "surname %";

export function resolveReferencesToDictionaryWords(
  candidates: DictionaryWordCandidate[],
  wordReferences: VocabPackWordReference[],
) {
  const candidatesByKey = new Map<string, DictionaryWordCandidate[]>();
  const candidatesByHanzi = new Map<string, DictionaryWordCandidate[]>();

  for (const candidate of candidates) {
    const key = wordReferenceKey(candidate);
    const keyBucket = candidatesByKey.get(key);
    if (keyBucket) {
      keyBucket.push(candidate);
    } else {
      candidatesByKey.set(key, [candidate]);
    }

    const hanziBucket = candidatesByHanzi.get(candidate.simplifiedHanzi);
    if (hanziBucket) {
      hanziBucket.push(candidate);
    } else {
      candidatesByHanzi.set(candidate.simplifiedHanzi, [candidate]);
    }
  }

  const matchingWords: DictionaryWordCandidate[] = [];
  const missingWords: VocabPackWordReference[] = [];

  for (const reference of wordReferences) {
    const hanziCandidates = applyMatchSelector(
      getVocabPackMatchCandidates(candidatesByHanzi.get(reference.simplifiedHanzi) ?? []),
      reference.matchSelector,
    );

    if (hanziCandidates.length === 0) {
      missingWords.push(reference);
      continue;
    }

    const uniquePinyinSearch = new Set(
      hanziCandidates.map((candidate) => candidate.numberedPinyinSearch),
    );

    if (uniquePinyinSearch.size === 1) {
      matchingWords.push(hanziCandidates[0]!);
      continue;
    }

    const exactMatches = applyMatchSelector(
      getVocabPackMatchCandidates(candidatesByKey.get(wordReferenceKey(reference)) ?? []),
      reference.matchSelector,
    );

    if (exactMatches.length > 0) {
      matchingWords.push(...exactMatches);
      continue;
    }

    missingWords.push(reference);
  }

  return { matchingWords, missingWords };
}

export function pickMatchingWordsByReferences(
  candidates: DictionaryWordCandidate[],
  wordReferences: VocabPackWordReference[],
) {
  return resolveReferencesToDictionaryWords(candidates, wordReferences).matchingWords;
}

function applyMatchSelector(
  candidates: DictionaryWordCandidate[],
  selector: VocabPackWordMatchSelector | undefined,
) {
  if (!selector) {
    return candidates;
  }

  return candidates.filter((candidate) => {
    if (selector.meaningStartsWith && !candidate.meaning.startsWith(selector.meaningStartsWith)) {
      return false;
    }

    if (selector.meaningIncludes && !candidate.meaning.includes(selector.meaningIncludes)) {
      return false;
    }

    return true;
  });
}

function getVocabPackMatchCandidates(candidates: DictionaryWordCandidate[]) {
  return candidates.filter(
    (candidate) =>
      !isVariantOfDictionaryEntry(candidate.meaning) &&
      !isSurnameOnlyDictionaryEntry(candidate.meaning),
  );
}

function isSurnameSense(sense: string) {
  const normalized = sense.trim().toLowerCase();
  if (!normalized.startsWith("surname ")) {
    return false;
  }

  const rest = normalized.slice("surname ".length);
  return !/^(and|of|in|from|for|with|to|the|a|an)\b/.test(rest);
}

function splitDictionaryMeaningSenses(meaning: string) {
  return meaning
    .split("; ")
    .map((sense) => sense.trim())
    .filter(Boolean);
}
