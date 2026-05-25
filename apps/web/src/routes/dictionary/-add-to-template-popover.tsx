import { api } from "@handeck/backend/convex/_generated/api";
import type { Id } from "@handeck/backend/convex/_generated/dataModel";
import { Button } from "@handeck/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@handeck/ui/components/popover";
import { Spinner } from "@handeck/ui/components/spinner";
import { cn } from "@handeck/ui/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, ListPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";

import { Route as RootRoute } from "@/routes/__root";

type AddToTemplatePopoverProps = {
  wordId: Id<"words">;
  hanzi: string;
};

export function AddToTemplatePopover({ wordId, hanzi }: AddToTemplatePopoverProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useRouteContext({ from: RootRoute.id });
  const [open, setOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<Id<"templates"> | null>(null);

  const membership = useQuery(
    api.template.listMembershipForWord,
    open && isAuthenticated ? { wordId } : "skip",
  );
  const toggleWordInTemplate = useMutation(api.template.toggleWordInTemplate);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !isAuthenticated) {
      void navigate({
        to: "/auth/$path",
        params: { path: "sign-in" },
        search: { redirectTo: "/dictionary" },
      });
      return;
    }
    setOpen(nextOpen);
  }

  async function handleToggle(
    templateId: Id<"templates">,
    templateName: string,
    included: boolean,
  ) {
    setPendingTemplateId(templateId);
    try {
      await toggleWordInTemplate({
        templateId,
        wordId,
      });
      toast.success(included ? `Removed from "${templateName}"` : `Added to "${templateName}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update template";
      toast.error(message);
    } finally {
      setPendingTemplateId(null);
    }
  }

  const isLoading = open && isAuthenticated && membership === undefined;
  const templates = membership ?? [];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-xs"
            aria-label={`Add ${hanzi} to template`}
          />
        }
      >
        <ListPlus className="size-3.5" />
        Add to template
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0" side="bottom" sideOffset={6}>
        <PopoverHeader className="border-b border-border px-3 py-2.5">
          <PopoverTitle className="text-sm">Templates</PopoverTitle>
          <PopoverDescription>Add or remove this word from your templates.</PopoverDescription>
        </PopoverHeader>
        <div className="max-h-56 overflow-y-auto p-1">
          {isLoading ? (
            <p className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Loading templates…
            </p>
          ) : templates.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">No templates yet.</p>
              <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" asChild>
                <Link to="/templates">Create a template</Link>
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {templates.map((template) => {
                const isPending = pendingTemplateId === template.templateId;
                return (
                  <li key={template.templateId}>
                    <button
                      type="button"
                      disabled={isPending}
                      aria-busy={isPending}
                      aria-pressed={template.included}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs outline-none transition-colors",
                        "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                        "disabled:pointer-events-none disabled:opacity-60",
                      )}
                      onClick={() =>
                        void handleToggle(template.templateId, template.name, template.included)
                      }
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                          template.included
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-transparent",
                        )}
                        aria-hidden
                      >
                        {isPending ? (
                          <Spinner className="size-3 text-current" />
                        ) : template.included ? (
                          <Check className="size-3" strokeWidth={3} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{template.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
