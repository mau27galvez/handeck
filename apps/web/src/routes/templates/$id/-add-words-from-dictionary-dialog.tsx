import {
  DictionaryEntryRow,
  type DictionaryEntry,
} from "@/components/dictionary/dictionary-entry-row";
import { DictionarySearchInput } from "@/components/dictionary/dictionary-search-input";
import { useDictionarySearch } from "@/components/dictionary/use-dictionary-search";
import { wordIdentityKey } from "@/lib/dictionary-search";
import { api } from "@handeck/backend/convex/_generated/api";
import type { Id } from "@handeck/backend/convex/_generated/dataModel";
import { Button } from "@handeck/ui/components/button";
import { Checkbox } from "@handeck/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@handeck/ui/components/dialog";
import { cn } from "@handeck/ui/lib/utils";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type AddWordsFromDictionaryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: Id<"templates">;
  existingWordKeys: Set<string>;
};

function SelectableDictionaryEntryRow({
  entry,
  searchQuery,
  selected,
  disabled,
  onToggle,
}: {
  entry: DictionaryEntry;
  searchQuery: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={cn(
        "flex items-center gap-3 border-b border-border px-4 last:border-b-0",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/40",
        selected && !disabled && "bg-muted/30",
      )}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <DictionaryEntryRow entry={entry} searchQuery={searchQuery} showAddToTemplate={false} />
      </div>
      <div className="flex shrink-0 items-center">
        <Checkbox
          checked={disabled || selected}
          disabled={disabled}
          aria-label={`Select ${entry.simplifiedHanzi}`}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={() => {
            if (!disabled) onToggle();
          }}
        />
      </div>
    </div>
  );
}

export default function AddWordsFromDictionaryDialog({
  open,
  onOpenChange,
  templateId,
  existingWordKeys,
}: AddWordsFromDictionaryDialogProps) {
  const { search, setSearch, clearSearch, searchQuery, entries, isSearching } =
    useDictionarySearch();
  const toggleWordInTemplate = useMutation(api.template.toggleWordInTemplate);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"words">>>(new Set());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSearch("");
    }
  }, [open, setSearch]);

  function toggleSelection(wordId: Id<"words">) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  }

  async function handleAddWords() {
    if (selectedIds.size === 0) return;

    setPending(true);
    try {
      let added = 0;
      let skipped = 0;

      for (const wordId of selectedIds) {
        const entry = entries?.find((e) => e._id === wordId);
        if (!entry) continue;

        const identityKey = wordIdentityKey(entry.simplifiedHanzi, entry.normalizedPinyin);
        if (existingWordKeys.has(identityKey)) {
          skipped += 1;
          continue;
        }

        await toggleWordInTemplate({ templateId, wordId });
        added += 1;
      }

      const addedLabel = added === 1 ? "1 word" : `${added} words`;
      if (added > 0) {
        toast.success(`Added ${addedLabel} to template`);
      } else {
        toast.info("Selected words are already in this template");
      }

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add words";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(85vh,900px)] w-full max-w-[min(960px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 max-lg:h-[min(90vh,900px)] sm:max-w-[min(960px,calc(100%-2rem))]"
        showCloseButton={!pending}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <DialogTitle className="text-base font-semibold">Add words from dictionary</DialogTitle>
          <DialogDescription>
            Search the dictionary and select words to include in this template.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b px-6 py-4">
          <DictionarySearchInput
            autoFocus
            value={search}
            onChange={setSearch}
            onClear={clearSearch}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {searchQuery.length <= 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground sm:text-base">
              Start typing to search the dictionary...
            </p>
          ) : isSearching ? (
            <p className="py-12 text-center text-sm text-muted-foreground sm:text-base">
              Searching dictionary...
            </p>
          ) : entries && entries.length > 0 ? (
            <div className="rounded-lg border border-border bg-card">
              {entries.map((entry) => {
                const identityKey = wordIdentityKey(entry.simplifiedHanzi, entry.normalizedPinyin);
                const alreadyAdded = existingWordKeys.has(identityKey);
                const selected = selectedIds.has(entry._id);

                return (
                  <SelectableDictionaryEntryRow
                    key={entry._id}
                    entry={entry}
                    searchQuery={searchQuery}
                    selected={selected}
                    disabled={alreadyAdded}
                    onToggle={() => toggleSelection(entry._id)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground sm:text-base">
              No entries match your search.
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <DialogClose type="button" disabled={pending}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            disabled={pending || selectedCount === 0}
            aria-busy={pending}
            onClick={() => void handleAddWords()}
          >
            {pending
              ? "Adding…"
              : selectedCount === 0
                ? "Add words"
                : selectedCount === 1
                  ? "Add 1 word"
                  : `Add ${selectedCount} words`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
