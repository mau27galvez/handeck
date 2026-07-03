import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@handeck/ui/components/card";
import { Button } from "@handeck/ui/components/button";
import { Pencil, Hash } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { KuaiBadge } from "@/components/kuai-badge";

export type TemplateListItem = {
  _id: string;
  name: string;
  wordCount: number;
  creditCost?: number;
};

export default function TemplateCard({ template }: { template: TemplateListItem }) {
  const { _id, name, wordCount, creditCost } = template;

  return (
    <Card size="sm" className="flex flex-col">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold leading-snug">
          <Link
            to="/templates/$id"
            params={{ id: _id }}
            className="rounded-sm outline-none hover:underline focus-visible:ring-1 focus-visible:ring-ring"
          >
            {name}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className="mt-auto flex flex-col gap-2 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Hash className="size-3" />
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          {creditCost !== undefined && <KuaiBadge cost={creditCost} />}
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex flex-row items-center justify-end gap-2 border-t px-3 py-2">
        <Button size="sm" className="gap-1.5" asChild>
          <Link to="/templates/$id" params={{ id: _id }}>
            <Pencil className="size-3" />
            Edit
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
