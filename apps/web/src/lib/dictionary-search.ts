export const DICTIONARY_SEARCH_DEBOUNCE_MS = 250;
export const DICTIONARY_SEARCH_LIMIT = 50;

export function wordIdentityKey(simplifiedHanzi: string, normalizedPinyin: string) {
  return `${simplifiedHanzi}:${normalizedPinyin}`;
}
