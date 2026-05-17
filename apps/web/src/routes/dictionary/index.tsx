import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@handeck/ui/components/input-group";
import { api } from "@handeck/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Search, X } from "lucide-react";
import { useState } from "react";

import { DictionaryEntryRow } from "./-dictionary-entry";
import { useDebounce } from "@/hooks/use-debounce";

const DICTIONARY_SEARCH_DEBOUNCE_MS = 250;
const DICTIONARY_SEARCH_LIMIT = 50;

export const Route = createFileRoute("/dictionary/")({
  component: Dictionary,
});

function DictionaryHeader({
  search,
  onSearchChange,
  onClear,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onClear: () => void;
}) {
  const showClear = search.trim().length > 0;

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">Handeck Dictionary</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Chinese-English dictionary for Handeck.
        </p>
      </div>
      <div className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl sm:shrink-0 sm:pt-1">
        <InputGroup className="h-9 w-full sm:h-10 md:h-11">
          <InputGroupAddon align="inline-start" className="py-0 sm:py-0.5 md:py-1">
            <Search
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground sm:size-4.5 md:size-5"
            />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search the dictionary"
            className="h-9 px-3 text-sm placeholder:text-sm sm:h-10 sm:px-3.5 sm:text-base sm:placeholder:text-base md:h-11 md:px-4 md:text-lg"
            placeholder="Search the dictionary..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {showClear ? (
            <InputGroupAddon align="inline-end" className="py-0 sm:py-0.5 md:py-1">
              <InputGroupButton
                aria-label="Clear search"
                size="icon-xs"
                type="button"
                onClick={onClear}
              >
                <X className="size-4 text-muted-foreground" />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>
    </div>
  );
}

function Dictionary() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, DICTIONARY_SEARCH_DEBOUNCE_MS);
  const searchQuery = debouncedSearch.trim();
  const entries = useQuery(
    api.dictionaryEntries.search,
    searchQuery ? { query: searchQuery, limit: DICTIONARY_SEARCH_LIMIT } : "skip",
  );
  const isSearching = searchQuery.length > 0 && entries === undefined;
  const hasEntries = entries != null && entries.length > 0;

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <DictionaryHeader search={search} onClear={() => setSearch("")} onSearchChange={setSearch} />
      {searchQuery.length <= 0 ? (
        <div className="mx-auto w-full max-w-3xl">
          <p className="py-8 text-center text-sm text-muted-foreground sm:text-base">
            Start typing to search the dictionary...
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          {isSearching ? (
            <p className="py-8 text-center text-sm text-muted-foreground sm:text-base">
              Searching dictionary...
            </p>
          ) : !hasEntries ? (
            <p className="py-8 text-center text-sm text-muted-foreground sm:text-base">
              No entries match your search.
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-card px-3 sm:px-5">
              {entries.map((entry) => (
                <DictionaryEntryRow key={entry._id} entry={entry} searchQuery={searchQuery} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
