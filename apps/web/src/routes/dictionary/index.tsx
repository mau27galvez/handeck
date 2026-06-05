import { DictionaryEntryRow } from "@/components/dictionary/dictionary-entry-row";
import { DictionarySearchInput } from "@/components/dictionary/dictionary-search-input";
import { useDictionarySearch } from "@/components/dictionary/use-dictionary-search";
import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">Handeck Dictionary</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Chinese-English dictionary for Handeck.
        </p>
      </div>
      <div className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl sm:shrink-0 sm:pt-1">
        <DictionarySearchInput value={search} onChange={onSearchChange} onClear={onClear} />
      </div>
    </div>
  );
}

function Dictionary() {
  const { search, setSearch, clearSearch, searchQuery, entries, isSearching } =
    useDictionarySearch();

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <DictionaryHeader search={search} onClear={clearSearch} onSearchChange={setSearch} />
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
          ) : !entries || entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground sm:text-base">
              No entries match your search.
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-card px-3 sm:px-5">
              {entries.map((entry) => (
                <DictionaryEntryRow key={entry.id} entry={entry} searchQuery={searchQuery} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
