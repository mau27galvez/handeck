import { api } from "@handeck/backend/convex/_generated/api";
import { useDebounce } from "@/hooks/use-debounce";
import { DICTIONARY_SEARCH_DEBOUNCE_MS, DICTIONARY_SEARCH_LIMIT } from "@/lib/dictionary-search";
import { useQuery } from "convex/react";
import { useState } from "react";

export function useDictionarySearch() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, DICTIONARY_SEARCH_DEBOUNCE_MS);
  const searchQuery = debouncedSearch.trim();
  const entries = useQuery(
    api.dictionaryEntries.search,
    searchQuery ? { query: searchQuery, limit: DICTIONARY_SEARCH_LIMIT } : "skip",
  );
  const isSearching = searchQuery.length > 0 && entries === undefined;
  const hasEntries = entries != null && entries.length > 0;

  function clearSearch() {
    setSearch("");
  }

  return {
    search,
    setSearch,
    clearSearch,
    searchQuery,
    entries,
    isSearching,
    hasEntries,
  };
}
