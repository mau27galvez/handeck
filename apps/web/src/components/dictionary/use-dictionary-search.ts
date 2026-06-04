import { useDebounce } from "@/hooks/use-debounce";
import { DICTIONARY_SEARCH_DEBOUNCE_MS, DICTIONARY_SEARCH_LIMIT } from "@/lib/dictionary-search";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export function useDictionarySearch() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, DICTIONARY_SEARCH_DEBOUNCE_MS);
  const searchQuery = debouncedSearch.trim();
  const { data: entries, isFetching } = useQuery(
    orpc.word.search.queryOptions({
      input: { query: searchQuery, limit: DICTIONARY_SEARCH_LIMIT },
      enabled: searchQuery.length > 0,
    }),
  );
  const isSearching = searchQuery.length > 0 && isFetching;
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
