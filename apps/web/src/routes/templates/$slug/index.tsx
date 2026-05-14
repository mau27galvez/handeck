import { requireAuth } from "@/lib/route-auth";
import { api } from "@handeck/backend/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@handeck/ui/components/card";
import { Button } from "@handeck/ui/components/button";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/templates/$slug/")({
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    const template = await context.queryClient.ensureQueryData(
      convexQuery(api.template.getBySlug, { slug: params.slug }),
    );
    if (template == null) throw notFound();
    return { template };
  },
  component: TemplateDetail,
});

function TemplateDetail() {
  const { template } = Route.useLoaderData();
  const { topics, sentencesPerWord } = template.configs;

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
          <Link to="/templates">
            <ArrowLeft className="size-4" />
            All templates
          </Link>
        </Button>
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">
          {template.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure this template for submission, then preview output before
          generating.
        </p>
      </header>

      <div className="grid min-h-[min(70vh,720px)] gap-4 lg:grid-cols-2 lg:gap-6 lg:min-h-[min(65vh,640px)]">
        <Card className="min-h-0 flex flex-col">
          <CardHeader className="border-b pb-4 shrink-0">
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Topics, sentences per word, base template, and card layout will be
              editable here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-4">
            <p className="text-muted-foreground">
              Current defaults: {topics.length} topic
              {topics.length === 1 ? "" : "s"}, {sentencesPerWord} sentence
              {sentencesPerWord === 1 ? "" : "s"} per word.
            </p>
            <p className="text-muted-foreground">
              Submission settings and validation will live in this panel.
            </p>
          </CardContent>
        </Card>

        <Card className="min-h-0 flex flex-col">
          <CardHeader className="border-b pb-4 shrink-0">
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Generated cards and submission actions will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto pt-4">
            <p className="text-center text-sm text-muted-foreground">
              Preview and submit controls will be wired once generation is
              ready.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
