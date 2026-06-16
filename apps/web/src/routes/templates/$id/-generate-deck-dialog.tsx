import { KuaiBadge } from "@/components/kuai-badge";
import { KUAI_COST_PLACEHOLDER } from "@/lib/template-placeholders";
import { orpc } from "@/utils/orpc";
import { Button } from "@handeck/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@handeck/ui/components/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Hash, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { v4 } from "uuid";

type GenerateDeckDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  wordCount: number;
};

export default function GenerateDeckDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
  wordCount,
}: GenerateDeckDialogProps) {
  const buildDeck = useMutation(orpc.deck.buildFromTemplate.mutationOptions());
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function handleGenerate() {
    setPending(true);
    try {
      const deckId = v4();
      const result = await buildDeck.mutateAsync({ deckId, templateId });
      void queryClient.invalidateQueries(orpc.deck.listForCurrentUser.queryOptions());
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
            Review the deck that will be generated from &ldquo;{templateName}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm">
          <div>
            <p className="font-medium">{templateName}</p>
            <p className="text-xs text-muted-foreground">
              Sentences, audio, and generation configs will be added later.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Hash className="size-3" />
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <FileText className="size-3" />0 sentences
            </span>
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Settings className="size-3" />
              Default configs
            </span>
            <KuaiBadge cost={KUAI_COST_PLACEHOLDER} />
          </div>
        </div>

        {wordCount === 0 && (
          <p className="text-xs text-muted-foreground">
            Add at least one word before generating a deck.
          </p>
        )}

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
