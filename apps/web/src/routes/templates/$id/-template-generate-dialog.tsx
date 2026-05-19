import { KuaiBadge } from "@/components/kuai-badge";
import { KUAI_COST_PLACEHOLDER, PLACEHOLDER_WORDS } from "@/lib/template-placeholders";
import type { TemplateConfigs } from "@handeck/backend/convex/schemas";
import { Badge } from "@handeck/ui/components/badge";
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
import { toast } from "sonner";

type TemplateGenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  configs: TemplateConfigs;
};

export default function TemplateGenerateDialog({
  open,
  onOpenChange,
  templateName,
  configs,
}: TemplateGenerateDialogProps) {
  const { topics, sentencesPerWord } = configs;
  const wordCount = PLACEHOLDER_WORDS.length;

  function handleConfirm() {
    toast.info("Generation is not available yet.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate cards</DialogTitle>
          <DialogDescription>
            Confirm generation for &ldquo;{templateName}&rdquo;. This will use the configuration
            below.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Words</dt>
            <dd className="font-medium">{wordCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Sentences per word</dt>
            <dd className="font-medium">{sentencesPerWord}</dd>
          </div>
          <div>
            <dt className="mb-1.5 text-muted-foreground">Topics</dt>
            <dd className="flex flex-wrap gap-1.5">
              {topics.map((topic) => (
                <Badge key={topic} variant="secondary" className="rounded-sm text-xs">
                  {topic}
                </Badge>
              ))}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-3">
            <dt className="font-medium">Kuai to expend</dt>
            <dd>
              <KuaiBadge cost={KUAI_COST_PLACEHOLDER} />
            </dd>
          </div>
        </dl>

        <DialogFooter className="mt-2">
          <DialogClose type="button">Cancel</DialogClose>
          <Button type="button" onClick={handleConfirm}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
