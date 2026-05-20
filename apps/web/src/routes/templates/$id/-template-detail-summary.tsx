import { getTemplateReadiness, type TemplateConfigs } from "@handeck/backend/convex/schemas";
import { cn } from "@handeck/ui/lib/utils";
import { AlignLeft, Hash, Tags } from "lucide-react";

type TemplateDetailSummaryProps = {
  wordsCount: number;
  configs: TemplateConfigs;
};

export default function TemplateDetailSummary({ wordsCount, configs }: TemplateDetailSummaryProps) {
  const { ready } = getTemplateReadiness({ wordsCount, configs });
  const { topics, sentencesPerWord } = configs;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
          ready
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-amber-500/10 text-amber-800 dark:text-amber-400",
        )}
      >
        {ready ? "Ready" : "Needs setup"}
      </span>
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Hash className="size-3" />
        {wordsCount} {wordsCount === 1 ? "word" : "words"}
      </span>
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <AlignLeft className="size-3" />
        {sentencesPerWord} sentence{sentencesPerWord === 1 ? "" : "s"} / word
      </span>
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Tags className="size-3" />
        {topics.length} {topics.length === 1 ? "topic" : "topics"}
      </span>
    </div>
  );
}
