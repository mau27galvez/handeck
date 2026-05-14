import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@handeck/ui/components/card";
import { Button } from "@handeck/ui/components/button";
import { BookOpen, Pencil, Sparkles, AlignLeft, Hash } from "lucide-react";
import { Template } from "./-mock-data";
import { Badge } from "@handeck/ui/components/badge";

export default function TemplateCard({ template }: { template: Template }) {
  const { name, words, configs, creditCost, baseTemplate } = template;
  const { topics, sentences_per_word } = configs;

  return (
    <Card size="sm" className="flex flex-col">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold leading-snug">
          {name}
        </CardTitle>
        {baseTemplate && (
          <CardDescription className="mt-0.5 flex items-center gap-1">
            <BookOpen className="size-3 shrink-0" />
            {baseTemplate}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2 pt-0 mt-auto">
        <div className="flex flex-wrap items-center gap-2">
          {words.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Hash className="size-3" />
              {words.length} words
            </span>
          )}
          {sentences_per_word > 0 && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <AlignLeft className="size-3" />
              {sentences_per_word} sentence
              {sentences_per_word === 1 ? "" : "s"} / word
            </span>
          )}
          {creditCost !== undefined && <KuaiBadge cost={creditCost} />}
        </div>
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic) => (
              <Badge
                key={topic}
                variant="secondary"
                className="capitalize text-xs rounded-sm"
              >
                {topic}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-auto flex flex-row items-center justify-between gap-2 border-t py-2 px-3">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="size-3" />
          Edit
        </Button>
        <Button size="sm" className="gap-1.5 hover:bg-primary/80">
          <Sparkles className="size-3" />
          Generate
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
