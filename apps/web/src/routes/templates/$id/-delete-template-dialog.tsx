import { api } from "@handeck/backend/convex/_generated/api";
import type { Id } from "@handeck/backend/convex/_generated/dataModel";
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
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

type DeleteTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: Id<"template">;
  templateName: string;
};

export default function DeleteTemplateDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
}: DeleteTemplateDialogProps) {
  const navigate = useNavigate();
  const removeTemplate = useMutation(api.template.remove);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      await removeTemplate({ templateId });
      toast.success("Template deleted");
      onOpenChange(false);
      await navigate({ to: "/templates" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete template";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete template</DialogTitle>
          <DialogDescription>
            Delete &ldquo;{templateName}&rdquo;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <DialogClose type="button" disabled={pending}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void handleDelete()}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
