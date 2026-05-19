import { isConvexArgumentValidationError } from "@/lib/convex-errors";
import { requireAuth } from "@/lib/route-auth";
import { api } from "@handeck/backend/convex/_generated/api";
import type { Id } from "@handeck/backend/convex/_generated/dataModel";
import type { TemplateConfigs } from "@handeck/backend/convex/schemas";
import { Button } from "@handeck/ui/components/button";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import DeleteTemplateDialog from "./-delete-template-dialog";
import TemplateConfigEditor from "./-template-config-editor";
import TemplateGenerateDialog from "./-template-generate-dialog";
import TemplateWordsPanel from "./-template-words-panel";

export const Route = createFileRoute("/templates/$id/")({
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    let template;
    try {
      template = await context.queryClient.ensureQueryData(
        convexQuery(api.template.getById, {
          templateId: params.id as Id<"template">,
        }),
      );
    } catch (error) {
      if (isConvexArgumentValidationError(error)) throw notFound();
      throw error;
    }
    if (template == null) throw notFound();
    return { templateId: params.id as Id<"template"> };
  },
  component: TemplateDetail,
});

function TemplateDetail() {
  const { templateId } = Route.useLoaderData();
  const template = useQuery(api.template.getById, { templateId });
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateConfigs, setGenerateConfigs] = useState<TemplateConfigs | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (template === undefined) {
    return (
      <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
        <p className="text-sm text-muted-foreground">Loading template…</p>
      </div>
    );
  }

  if (template === null) {
    throw notFound();
  }

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" asChild>
          <Link to="/templates">
            <ArrowLeft className="size-4" />
            All templates
          </Link>
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={() => setDeleteOpen(true)}>
          Delete
        </Button>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">{template.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure topics and sentences per word, then generate cards when ready.
        </p>
      </header>

      <div className="grid min-h-[min(70vh,720px)] gap-4 lg:min-h-[min(65vh,640px)] lg:grid-cols-2 lg:gap-6">
        <TemplateConfigEditor
          templateId={templateId}
          configs={template.configs}
          onGenerate={(configs) => {
            setGenerateConfigs(configs);
            setGenerateOpen(true);
          }}
        />
        <TemplateWordsPanel />
      </div>

      {generateConfigs && (
        <TemplateGenerateDialog
          open={generateOpen}
          onOpenChange={(open) => {
            setGenerateOpen(open);
            if (!open) setGenerateConfigs(null);
          }}
          templateName={template.name}
          configs={generateConfigs}
        />
      )}
      <DeleteTemplateDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        templateId={templateId}
        templateName={template.name}
      />
    </div>
  );
}
