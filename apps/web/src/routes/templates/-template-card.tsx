import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@handeck/ui/components/card";
import { Button } from "@handeck/ui/components/button";
import { BookOpen, Pencil, AlignLeft, Hash } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@handeck/ui/components/badge";

export type TemplateListItem = {
  _id: string;
  name: string;
  words: string[];
  configs: {
    topics: string[];
    sentencesPerWord: number;
  };
  creditCost?: number;
  baseTemplate?: string;
};

export default function TemplateCard({ template }: { template: TemplateListItem }) {
  const { _id, name, words, configs, creditCost, baseTemplate } = template;
  const { topics, sentencesPerWord } = configs;

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
        {baseTemplate && (
          <CardDescription className="mt-0.5 flex items-center gap-1">
            <BookOpen className="size-3 shrink-0" />
            {baseTemplate}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="mt-auto flex flex-col gap-2 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Hash className="size-3" />
            {words.length} {words.length === 1 ? "word" : "words"}
          </span>
          {sentencesPerWord > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <AlignLeft className="size-3" />
              {sentencesPerWord} sentence
              {sentencesPerWord === 1 ? "" : "s"} / word
            </span>
          ) : (
            <>
              {/* Valid templates should never have 0 sentences per word; this branch is for invalid or legacy data only. */}
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <AlignLeft className="size-3" />
                Sentences per word not set
              </span>
            </>
          )}
          {creditCost !== undefined && <KuaiBadge cost={creditCost} />}
        </div>
        {topics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic) => (
              <Badge key={topic} variant="secondary" className="rounded-sm text-xs">
                {topic}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No topics yet. Add topics when you edit this template.
          </p>
        )}
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

function KuaiBadge({ cost }: { cost: number }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center gap-1 rounded-full bg-[#f5f0e8] px-2 py-0 text-xs font-medium text-[#7a5c2e] dark:bg-[#2a2318] dark:text-[#c8a96e]">
      块 {cost}
    </span>
  );
}
