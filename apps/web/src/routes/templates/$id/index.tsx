import { wordIdentityKey } from "@/lib/dictionary-search";
import { isConvexArgumentValidationError } from "@/lib/convex-errors";
import { requireAuth } from "@/lib/route-auth";
import { api } from "@handeck/backend/convex/_generated/api";
import type { Id } from "@handeck/backend/convex/_generated/dataModel";
import { Button } from "@handeck/ui/components/button";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AddWordsFromDictionaryDialog from "./-add-words-from-dictionary-dialog";
import DeleteTemplateDialog from "./-delete-template-dialog";
import TemplateEmptyPanel from "./-template-empty-panel";
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
  const navigate = useNavigate();
  const { templateId } = Route.useLoaderData();
  const template = useQuery(api.template.getById, { templateId });
  const words = useQuery(api.template.getWords, { templateId });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addWordsOpen, setAddWordsOpen] = useState(false);

  const existingWordKeys = useMemo(() => {
    if (!words) return new Set<string>();
    return new Set(
      words.map((word) => wordIdentityKey(word.simplifiedHanzi, word.normalizedPinyin)),
    );
  }, [words]);

  useEffect(() => {
    if (template === null) {
      void navigate({ to: "/templates", replace: true });
    }
  }, [template, navigate]);

  if (template === undefined) {
    return (
      <div className="flex h-full min-h-0 flex-col px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
        <p className="text-sm text-muted-foreground">Loading template…</p>
      </div>
    );
  }

  if (template === null) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <div className="mb-8 flex shrink-0 items-center justify-between gap-4">
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

      <header className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">{template.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage the words included in this template.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 *:min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:gap-6">
        <TemplateEmptyPanel />
        <TemplateWordsPanel
          templateId={templateId}
          words={words}
          onAddWords={() => setAddWordsOpen(true)}
        />
      </div>

      <DeleteTemplateDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        templateId={templateId}
        templateName={template.name}
      />
      <AddWordsFromDictionaryDialog
        open={addWordsOpen}
        onOpenChange={setAddWordsOpen}
        templateId={templateId}
        existingWordKeys={existingWordKeys}
      />
    </div>
  );
}
