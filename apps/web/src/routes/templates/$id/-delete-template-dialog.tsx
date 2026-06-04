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
import { orpc } from "@/utils/orpc";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

type DeleteTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
};

export default function DeleteTemplateDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
}: DeleteTemplateDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const removeTemplate = useMutation(orpc.template.remove.mutationOptions());
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      await removeTemplate.mutateAsync({ templateId });
      onOpenChange(false);
      toast.success("Template deleted");
      await navigate({ to: "/templates", replace: true });
      void queryClient.invalidateQueries(orpc.template.listForCurrentUser.queryOptions());
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
