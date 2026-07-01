export type VocabPackWordReference = {
  simplifiedHanzi: string;
  numberedPinyinSearch: string;
};

export type DictionaryWordCandidate = {
  id: string;
  simplifiedHanzi: string;
  numberedPinyinSearch: string;
  meaning: string;
};

export function wordReferenceKey(
  word: Pick<VocabPackWordReference, "simplifiedHanzi" | "numberedPinyinSearch">,
) {
  return `${word.simplifiedHanzi}\t${word.numberedPinyinSearch}`;
}

export function isVariantOfDictionaryEntry(meaning: string) {
  return meaning.trim().toLowerCase().startsWith("variant of");
}

/** Keep in sync with the SQL filter in getMatchingWordsByReferences. */
export const NON_VARIANT_MEANING_LIKE_PATTERN = "variant of%";

export function pickMatchingWordsByReferences(
  candidates: DictionaryWordCandidate[],
  wordReferences: VocabPackWordReference[],
) {
  const candidatesByKey = new Map<string, DictionaryWordCandidate[]>();

  for (const candidate of candidates) {
    const key = wordReferenceKey(candidate);
    const bucket = candidatesByKey.get(key);
    if (bucket) {
      bucket.push(candidate);
    } else {
      candidatesByKey.set(key, [candidate]);
    }
  }

  const matchingWords: DictionaryWordCandidate[] = [];

  for (const reference of wordReferences) {
    const keyCandidates = candidatesByKey.get(wordReferenceKey(reference)) ?? [];
    const nonVariantCandidates = keyCandidates.filter(
      (candidate) => !isVariantOfDictionaryEntry(candidate.meaning),
    );
    matchingWords.push(...nonVariantCandidates);
  }

  return matchingWords;
}
