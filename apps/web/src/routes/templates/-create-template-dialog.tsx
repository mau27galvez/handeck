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
import { Field, FieldDescription, FieldLabel } from "@handeck/ui/components/field";
import { Input } from "@handeck/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@handeck/ui/components/select";
import { orpc } from "@/utils/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export type CreateMode = "scratch" | "FromBase";

type CreateTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CreateMode;
};

export default function CreateTemplateDialog({
  open,
  onOpenChange,
  mode,
}: CreateTemplateDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const isFromBase = mode === "FromBase";
  const [pending, setPending] = useState(false);

  const [selectedBaseId, setSelectedBaseId] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const bases = useQuery(orpc.baseTemplate.list.queryOptions());
  const createTemplate = useMutation(orpc.template.create.mutationOptions());
  const nameInputRef = useRef<HTMLInputElement>(null);

  const basesReady = bases.data !== undefined;
  const hasBases = (bases.data?.length ?? 0) > 0;

  const canSubmit =
    name.trim().length > 0 &&
    !pending &&
    (!isFromBase || (basesReady && hasBases && selectedBaseId !== undefined));

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setSelectedBaseId(undefined);
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
      const templateId = await createTemplate.mutateAsync({
        name: name.trim(),
        ...(isFromBase && selectedBaseId != null ? { baseTemplateId: selectedBaseId } : {}),
      });
      void queryClient.invalidateQueries(orpc.template.listForCurrentUser.queryOptions());
      toast.success("Template created");
      if (templateId) {
        await navigate({
          to: "/templates/$id",
          params: { id: templateId },
        });
      }
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
          <DialogDescription>
            {isFromBase
              ? "Enter a name and choose which base template to start from."
              : "Name your new template."}
          </DialogDescription>
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

            {isFromBase && (
              <Field>
                <FieldLabel htmlFor="template-base">Base template</FieldLabel>
                {!basesReady ? (
                  <FieldDescription role="status" aria-live="polite">
                    Loading bases…
                  </FieldDescription>
                ) : !hasBases ? (
                  <FieldDescription>
                    No starter templates are available yet. Check back later or create from scratch.
                  </FieldDescription>
                ) : (
                  <Select
                    value={selectedBaseId ?? undefined}
                    onValueChange={(value) => {
                      if (value) setSelectedBaseId(value);
                    }}
                    items={bases.data!.map((b) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                  >
                    <SelectTrigger id="template-base">
                      <SelectValue placeholder="Choose a base" />
                    </SelectTrigger>
                    <SelectContent>
                      {bases.data!.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
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
