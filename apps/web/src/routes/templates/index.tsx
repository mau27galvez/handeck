import { Button } from "@handeck/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@handeck/backend/convex/_generated/api";
import CreateTemplateDialog, {
  type CreateMode,
} from "./-create-template-dialog";
import TemplateCard, { type TemplateListItem } from "./-template-card";
import { requireAuth } from "@/lib/route-auth";

// Placeholder kuai cost until real pricing exists
const KUAI_COST_PLACEHOLDER = 0;

export const Route = createFileRoute("/templates/")({
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    const templates = await context.queryClient.ensureQueryData(
      convexQuery(api.template.listForCurrentUser, {}),
    );

    // Map Convex templates to UI shape with hardcoded kuai cost
    const templateListItems: TemplateListItem[] = templates.map(
      (template) => ({
        _id: template._id as string,
        name: template.name,
        words: template.words ?? [],
        configs: template.configs,
        creditCost: KUAI_COST_PLACEHOLDER,
        baseTemplate: template.baseTemplate,
      }),
    );

    return { templates: templateListItems };
  },
  component: Templates,
});

function TemplatesPageHeader({
  onUseBase,
  onCreateScratch,
}: {
  onUseBase: () => void;
  onCreateScratch: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">Templates</h1>
      <div className="flex flex-wrap gap-2">
        <Button className="text-md" size="lg" type="button" onClick={onUseBase}>
          Use a base template
        </Button>
        <Button
          variant="outline"
          className="text-md"
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

type CreateDialogState =
  | { kind: "closed" }
  | { kind: "open"; mode: CreateMode };

function TemplatesShell({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<CreateDialogState>({ kind: "closed" });

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <TemplatesPageHeader
        onUseBase={() => setDialog({ kind: "open", mode: "FromBase" })}
        onCreateScratch={() => setDialog({ kind: "open", mode: "scratch" })}
      />
      <CreateTemplateDialog
        open={dialog.kind === "open"}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        mode={dialog.kind === "open" ? dialog.mode : "scratch"}
      />
      {children}
    </div>
  );
}

function Templates() {
  const { templates } = Route.useLoaderData();

  if (templates.length === 0) {
    return (
      <TemplatesShell>
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <p className="text-center text-2xl font-bold sm:text-3xl lg:text-4xl">
            Create your first template to get started!
          </p>
        </div>
      </TemplatesShell>
    );
  }

  return (
    <TemplatesShell>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard key={template._id} template={template} />
        ))}
      </div>
    </TemplatesShell>
  );
}
