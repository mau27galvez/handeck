import { KuaiBadge } from "@/components/kuai-badge";
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
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type GenerateDeckDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: Id<"templates">;
  wordCount: number;
};

export default function GenerateDeckDialog({
  open,
  onOpenChange,
  templateId,
  wordCount,
}: GenerateDeckDialogProps) {
  const generateDeck = useMutation(api.deckGeneration.generateDeck);
  const [useCachedDecks, setUseCachedDecks] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setUseCachedDecks(false);
    }
  }, [open]);

  async function handleGenerate() {
    setPending(true);
    try {
      await generateDeck({ templateId });
      toast.success("Deck generation started");
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start deck generation";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Generate deck</DialogTitle>
          <DialogDescription>
            Review this template summary before starting deck generation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-md border bg-card px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Words</span>
              <span className="text-sm font-medium">{wordCount}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Kuai</span>
              <KuaiBadge cost={0} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={useCachedDecks}
              disabled={pending}
              onCheckedChange={(checked) => setUseCachedDecks(checked === true)}
            />
            Use cached decks
          </label>
        </div>

        <DialogFooter className="mt-2">
          <DialogClose type="button" disabled={pending}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            disabled={pending || wordCount === 0}
            aria-busy={pending}
            onClick={() => void handleGenerate()}
          >
            {pending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
