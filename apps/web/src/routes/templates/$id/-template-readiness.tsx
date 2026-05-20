import { getTemplateReadiness, type TemplateConfigs } from "@handeck/backend/convex/schemas";
import { cn } from "@handeck/ui/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

type TemplateReadinessProps = {
  wordsCount: number;
  configs: TemplateConfigs;
  emphasizeIncomplete?: boolean;
  onWordsPanelClick?: () => void;
};

export default function TemplateReadiness({
  wordsCount,
  configs,
  emphasizeIncomplete = false,
  onWordsPanelClick,
}: TemplateReadinessProps) {
  const { ready, steps } = getTemplateReadiness({ wordsCount, configs });
  const completeCount = steps.filter((step) => step.complete).length;
  const totalCount = steps.length;

  return (
    <div
      role="status"
      className={cn(
        "rounded-md border px-3 py-3",
        ready ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/30",
      )}
    >
      <div className="mb-2.5">
        <p className="text-sm font-medium">{ready ? "Ready to generate" : "Setup progress"}</p>
        {!ready && (
          <p className="text-xs text-muted-foreground">
            {completeCount} of {totalCount} complete
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-2.5 text-sm">
            {step.complete ? (
              <CheckCircle2
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-500"
              />
            ) : (
              <Circle
                aria-hidden
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  emphasizeIncomplete ? "text-destructive" : "text-muted-foreground",
                )}
              />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "leading-snug",
                  !step.complete && emphasizeIncomplete && "text-destructive",
                )}
              >
                {step.label}
              </p>
              {!step.complete && step.hint && (
                <p
                  className={cn(
                    "mt-0.5 text-xs text-muted-foreground",
                    emphasizeIncomplete && "text-destructive/90",
                  )}
                >
                  {step.id === "words" && onWordsPanelClick ? (
                    <>
                      {step.hint.replace(" in the Words panel", "")}{" "}
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-foreground"
                        onClick={onWordsPanelClick}
                      >
                        in the Words panel
                      </button>
                    </>
                  ) : (
                    step.hint
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
