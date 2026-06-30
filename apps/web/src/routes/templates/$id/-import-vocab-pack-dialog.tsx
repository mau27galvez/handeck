import { orpc } from "@/utils/orpc";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ImportVocabPackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
};

type VocabPackListItem = {
  id: string;
  name: string;
  description?: string;
  wordCount: number;
};

function SelectableVocabPackRow({
  pack,
  selected,
  onToggle,
}: {
  pack: VocabPackListItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0",
        "cursor-pointer hover:bg-muted/40",
        selected && "bg-muted/30",
      )}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Package className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">{pack.name}</span>
          <span className="text-xs text-muted-foreground">
            {pack.wordCount} {pack.wordCount === 1 ? "word" : "words"}
          </span>
        </div>
        {pack.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{pack.description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          aria-label={`Select ${pack.name}`}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  );
}

export default function ImportVocabPackDialog({
  open,
  onOpenChange,
  templateId,
}: ImportVocabPackDialogProps) {
  const queryClient = useQueryClient();
  const packs = useQuery({
    ...orpc.vocabPack.list.queryOptions(),
    enabled: open,
  });
  const importToTemplate = useMutation(orpc.vocabPack.importToTemplate.mutationOptions());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
    }
  }, [open]);

  function toggleSelection(packId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) {
        next.delete(packId);
      } else {
        next.add(packId);
      }
      return next;
    });
  }

  async function handleImport() {
    if (selectedIds.size === 0) return;

    const vocabPackIds = [...selectedIds];

    setPending(true);
    try {
      const result = await importToTemplate.mutateAsync({ templateId, vocabPackIds });

      if (result.added > 0) {
        void queryClient.invalidateQueries(
          orpc.template.getWords.queryOptions({ input: { templateId } }),
        );
        void queryClient.invalidateQueries(orpc.template.listForCurrentUser.queryOptions());
      }

      const addedLabel = result.added === 1 ? "1 word" : `${result.added} words`;
      if (result.added > 0) {
        toast.success(`Imported ${addedLabel} from vocab pack${selectedIds.size === 1 ? "" : "s"}`);
      } else if (result.requestedInsertsCount === 0) {
        toast.info("Selected packs have no words to import");
      } else {
        toast.info("All words from selected packs are already in this template");
      }

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import vocab pack";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const packList = packs.data ?? [];
  const selectedCount = selectedIds.size;
  const selectedWordCount = packList
    .filter((pack) => selectedIds.has(pack.id))
    .reduce((sum, pack) => sum + pack.wordCount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(85vh,700px)] w-full max-w-[min(640px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(640px,calc(100%-2rem))]"
        showCloseButton={!pending}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <DialogTitle className="text-base font-semibold">Import vocab pack</DialogTitle>
          <DialogDescription>
            Select curated vocab packs to copy words into this template.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {packs.isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading vocab packs…</p>
          ) : packList.length > 0 ? (
            <div className="rounded-lg border border-border bg-card">
              {packList.map((pack) => (
                <SelectableVocabPackRow
                  key={pack.id}
                  pack={pack}
                  selected={selectedIds.has(pack.id)}
                  onToggle={() => toggleSelection(pack.id)}
                />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No vocab packs are available yet.
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          {selectedCount > 0 ? (
            <p className="mr-auto text-xs text-muted-foreground">
              {selectedCount} {selectedCount === 1 ? "pack" : "packs"} · up to {selectedWordCount}{" "}
              {selectedWordCount === 1 ? "word" : "words"}
            </p>
          ) : null}
          <DialogClose type="button" disabled={pending}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            disabled={pending || selectedCount === 0}
            aria-busy={pending}
            onClick={() => void handleImport()}
          >
            {pending
              ? "Importing…"
              : selectedCount === 0
                ? "Import"
                : selectedCount === 1
                  ? "Import 1 pack"
                  : `Import ${selectedCount} packs`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
