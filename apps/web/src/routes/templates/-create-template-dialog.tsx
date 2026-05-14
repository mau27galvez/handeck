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
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@handeck/ui/components/field";
import { Input } from "@handeck/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@handeck/ui/components/select";
import { useMutation, useQuery } from "convex/react";
import { type SubmitEvent, useState } from "react";
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

  const [selectedBaseId, setSelectedBaseId] = useState<
    Id<"baseTemplate"> | undefined
  >(undefined);
  const bases = useQuery(api.baseTemplate.list);
  const createTemplate = useMutation(api.template.create);

  const basesReady = bases !== undefined;
  const hasBases = (bases?.length ?? 0) > 0;

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

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    try {
      const slug = await createTemplate({
        name: name.trim(),
        ...(isFromBase && selectedBaseId != null
          ? { baseTemplateId: selectedBaseId }
          : {}),
      });
      toast.success("Template created");
      if (slug) {
        await navigate({ to: "/templates/$slug", params: { slug } });
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
                  <FieldDescription>Loading bases…</FieldDescription>
                ) : !hasBases ? (
                  <FieldDescription>
                    No base templates yet. Add rows to the baseTemplate table,
                    then try again.
                  </FieldDescription>
                ) : (
                  <Select
                    value={selectedBaseId ?? undefined}
                    onValueChange={(value) => {
                      if (value)
                        setSelectedBaseId(value as Id<"baseTemplate">);
                    }}
                    items={bases!.map((b) => ({
                      value: b._id,
                      label: b.name,
                    }))}
                  >
                    <SelectTrigger id="template-base">
                      <SelectValue placeholder="Choose a base" />
                    </SelectTrigger>
                    <SelectContent>
                      {bases!.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
          </div>

          <DialogFooter>
            <DialogClose type="button">Cancel</DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
