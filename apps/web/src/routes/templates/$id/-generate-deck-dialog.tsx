import { KuaiBadge } from "@/components/kuai-badge";
import { getDeckGenerationKuaiCost } from "@/lib/template-placeholders";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@handeck/ui/components/tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Hash, Info, Settings } from "lucide-react";
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
  const estimatedCost = getDeckGenerationKuaiCost(wordCount);

  async function handleGenerate() {
    setPending(true);
    try {
      const deckId = v4();
      await buildDeck.mutateAsync({ deckId, templateId });
      void queryClient.invalidateQueries(orpc.deck.listForCurrentUser.queryOptions());
      void queryClient.invalidateQueries(orpc.billing.getKuaiAccount.queryOptions());
      onOpenChange(false);
      toast.success(`Started generating deck with template ${templateName}`);
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Hash className="size-3" />
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <FileText className="size-3" />
              {wordCount} {wordCount === 1 ? "sentence" : "sentences"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Settings className="size-3" />
              Default configs
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Estimated cost</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label="Why the cost may be lower"
                    className="text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                  >
                    <Info className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    This is the maximum you&rsquo;ll be charged: 1 Kuai per word audio, 1 per
                    sentence, and 1 per sentence audio. The final cost may be lower since audio that
                    was already generated before is reused for free.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">up to</span>
              <KuaiBadge cost={estimatedCost} />
            </div>
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
            {pending ? "Starting..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
