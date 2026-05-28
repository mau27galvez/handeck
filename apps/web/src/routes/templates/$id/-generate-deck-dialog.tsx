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
import { Label } from "@handeck/ui/components/label";
import { useAction, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type GenerateDeckDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: Id<"templates">;
};

export default function GenerateDeckDialog({
  open,
  onOpenChange,
  templateId,
}: GenerateDeckDialogProps) {
  const preview = useQuery(api.deck.getGenerationPreview, open ? { templateId } : "skip");
  const createDeck = useAction(api.deckActions.create);
  const [useCache, setUseCache] = useState(false);
  const [pending, setPending] = useState(false);

  const isLoadingPreview = preview === undefined;
  const canGenerate = preview != null && preview.wordCount > 0;

  async function handleGenerate() {
    if (!canGenerate) return;

    setPending(true);
    try {
      const result = await createDeck({
        templateId,
        useCache,
        mode: "fresh",
      });
      onOpenChange(false);
      toast.success(`Generated deck with ${result.noteCount} notes`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate deck";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate deck</DialogTitle>
          <DialogDescription>
            Create notes and a TSV file for the flashcard pipeline. Sentences will be added in a
            later step.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {isLoadingPreview ? (
            <p className="text-sm text-muted-foreground">Loading preview…</p>
          ) : preview == null ? (
            <p className="text-sm text-muted-foreground">Unable to load preview.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1 text-sm">
                <p>
                  <span className="font-medium">{preview.wordCount}</span>{" "}
                  {preview.wordCount === 1 ? "word" : "words"} →{" "}
                  <span className="font-medium">{preview.noteCount}</span>{" "}
                  {preview.noteCount === 1 ? "note" : "notes"}
                </p>
                <p className="text-muted-foreground">
                  {preview.sentencesPerWord} sentence
                  {preview.sentencesPerWord === 1 ? "" : "s"} per word (stubbed for now)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estimated cost</span>
                <KuaiBadge cost={preview.estimatedKuaiCost} />
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="use-cache-sentences"
                  checked={useCache}
                  onCheckedChange={(checked) => setUseCache(checked === true)}
                  disabled={pending}
                />
                <div className="grid gap-1">
                  <Label htmlFor="use-cache-sentences" className="font-normal leading-snug">
                    Use cached sentences
                  </Label>
                  <p className="text-xs text-muted-foreground">Coming soon — no effect today.</p>
                </div>
              </div>

              {preview.matchingDeckId != null && (
                <p className="text-xs text-muted-foreground">
                  A deck with the same settings already exists ({preview.matchingDeckNoteCount}{" "}
                  {preview.matchingDeckNoteCount === 1 ? "note" : "notes"}).
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-2">
          <DialogClose type="button" disabled={pending}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            className="gap-1.5"
            disabled={pending || !canGenerate}
            aria-busy={pending}
            onClick={() => void handleGenerate()}
          >
            {pending ? (
              "Generating…"
            ) : (
              <>
                Generate
                <Sparkles className="size-3" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
