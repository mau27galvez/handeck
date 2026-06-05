import { Button } from "@handeck/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import CreateTemplateDialog, { type CreateMode } from "./-create-template-dialog";
import TemplateCard, { type TemplateListItem } from "./-template-card";
import { requireAuth } from "@/lib/route-auth";

// Placeholder kuai cost until real pricing exists
const KUAI_COST_PLACEHOLDER = 0;

export const Route = createFileRoute("/templates/")({
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      context.orpc.template.listForCurrentUser.queryOptions(),
    );
  },
  component: Templates,
});

type TemplateListItemSource = {
  id: string;
  name: string;
  wordCount: number;
  baseTemplate?: string;
};

function toTemplateListItems(templates: TemplateListItemSource[]): TemplateListItem[] {
  return templates.map((template) => ({
    _id: template.id,
    name: template.name,
    wordCount: template.wordCount,
    creditCost: KUAI_COST_PLACEHOLDER,
    baseTemplate: template.baseTemplate,
  }));
}

function TemplatesPageHeader({
  onUseBase,
  onCreateScratch,
  showButtons,
}: {
  onUseBase: () => void;
  onCreateScratch: () => void;
  showButtons: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">Templates</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Create and manage reusable setups for submission and card generation.
        </p>
      </div>
      {showButtons && (
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:pt-1">
          <Button className="text-base" size="lg" type="button" onClick={onUseBase}>
            Use a base template
          </Button>
          <Button
            variant="outline"
            className="text-base"
            size="lg"
            type="button"
            onClick={onCreateScratch}
          >
            Create from scratch
          </Button>
        </div>
      )}
    </div>
  );
}

type CreateDialogState = { kind: "closed" } | { kind: "open"; mode: CreateMode };

function EmptyTemplatesCTA({
  onUseBase,
  onCreateScratch,
}: {
  onUseBase: () => void;
  onCreateScratch: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold text-foreground sm:text-xl">No templates yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Start from a base template or an empty template, then add words when you edit.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button className="text-base" size="lg" type="button" onClick={onUseBase}>
          Use a base template
        </Button>
        <Button
          variant="outline"
          className="text-base"
          size="lg"
          type="button"
          onClick={onCreateScratch}
        >
          Create from scratch
        </Button>
      </div>
    </div>
  );
}

function Templates() {
  const { orpc } = Route.useRouteContext();
  const { data } = useSuspenseQuery(orpc.template.listForCurrentUser.queryOptions());
  const templates = toTemplateListItems(data);
  const [dialog, setDialog] = useState<CreateDialogState>({ kind: "closed" });
  const openFromBase = () => setDialog({ kind: "open", mode: "FromBase" });
  const openScratch = () => setDialog({ kind: "open", mode: "scratch" });
  const hasTemplates = templates.length > 0;

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <TemplatesPageHeader
        onUseBase={openFromBase}
        onCreateScratch={openScratch}
        showButtons={hasTemplates}
      />
      <CreateTemplateDialog
        open={dialog.kind === "open"}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        mode={dialog.kind === "open" ? dialog.mode : "scratch"}
      />
      {hasTemplates ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard key={template._id} template={template} />
          ))}
        </div>
      ) : (
        <EmptyTemplatesCTA onUseBase={openFromBase} onCreateScratch={openScratch} />
      )}
    </div>
  );
}
