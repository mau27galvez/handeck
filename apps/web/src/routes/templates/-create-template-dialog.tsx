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
import { Field, FieldLabel } from "@handeck/ui/components/field";
import { Input } from "@handeck/ui/components/input";
import { orpc } from "@/utils/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { v4 } from "uuid";

type CreateTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const createTemplate = useMutation(orpc.template.create.mutationOptions());
  const nameInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = name.trim().length > 0 && !pending;

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setPending(false);
    }
    onOpenChange(nextOpen);
  }

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    try {
      const templateId = v4();
      await createTemplate.mutateAsync({
        id: templateId,
        name: name.trim(),
      });
      void queryClient.invalidateQueries(orpc.template.listForCurrentUser.queryOptions());
      toast.success("Template created");
      await navigate({
        to: "/templates/$id",
        params: { id: templateId },
      });
      handleDialogOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      console.error("error:", e);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>Name your new template.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate}>
          <div className="grid gap-4 py-1">
            <Field>
              <FieldLabel htmlFor="template-name">Name</FieldLabel>
              <Input
                ref={nameInputRef}
                id="template-name"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Travel vocabulary"
              />
            </Field>
          </div>

          <DialogFooter className="mt-2">
            <DialogClose type="button">Cancel</DialogClose>
            <Button type="submit" disabled={!canSubmit} aria-busy={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
