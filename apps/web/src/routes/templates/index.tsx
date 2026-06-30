import { Button } from "@handeck/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import CreateTemplateDialog from "./-create-template-dialog";
import TemplateCard, { type TemplateListItem } from "./-template-card";
import { requireAuth } from "@/lib/route-auth";
import { getDeckGenerationKuaiCost } from "@/lib/template-placeholders";

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
};

function toTemplateListItems(templates: TemplateListItemSource[]): TemplateListItem[] {
  return templates.map((template) => ({
    _id: template.id,
    name: template.name,
    wordCount: template.wordCount,
    creditCost: getDeckGenerationKuaiCost(template.wordCount),
  }));
}

function TemplatesPageHeader({
  onCreate,
  showButton,
}: {
  onCreate: () => void;
  showButton: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">Templates</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Create and manage reusable setups for submission and card generation.
        </p>
      </div>
      {showButton && (
        <Button
          className="text-base sm:shrink-0 sm:pt-1"
          size="lg"
          type="button"
          onClick={onCreate}
        >
          New template
        </Button>
      )}
    </div>
  );
}

function EmptyTemplatesCTA({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold text-foreground sm:text-xl">No templates yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Create a template, then add words from the dictionary or import vocab packs.
      </p>
      <Button className="text-base" size="lg" type="button" onClick={onCreate}>
        New template
      </Button>
    </div>
  );
}

function Templates() {
  const { orpc } = Route.useRouteContext();
  const { data } = useSuspenseQuery(orpc.template.listForCurrentUser.queryOptions());
  const templates = toTemplateListItems(data);
  const [createOpen, setCreateOpen] = useState(false);
  const hasTemplates = templates.length > 0;

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <TemplatesPageHeader onCreate={() => setCreateOpen(true)} showButton={hasTemplates} />
      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
      {hasTemplates ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard key={template._id} template={template} />
          ))}
        </div>
      ) : (
        <EmptyTemplatesCTA onCreate={() => setCreateOpen(true)} />
      )}
    </div>
  );
}
