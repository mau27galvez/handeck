import { useDebounce } from "@/hooks/use-debounce";
import { PLACEHOLDER_WORDS, TEMPLATE_WORDS_PANEL_ID } from "@/lib/template-placeholders";
import { api } from "@handeck/backend/convex/_generated/api";
import type { Id } from "@handeck/backend/convex/_generated/dataModel";
import {
  AVAILABLE_SENTENCE_TOPICS,
  type TemplateConfigs,
  getTemplateReadiness,
  hasLegacyTopics,
  sanitizeTemplateConfigs,
} from "@handeck/backend/convex/schemas";
import { Button } from "@handeck/ui/components/button";
import { Checkbox } from "@handeck/ui/components/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@handeck/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@handeck/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@handeck/ui/components/select";
import { useMutation } from "convex/react";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import TemplateReadiness from "./-template-readiness";

const SENTENCES_PER_WORD_OPTIONS = [1, 2, 3, 4, 5] as const;
const CONFIG_SAVE_DEBOUNCE_MS = 300;

function scrollToWordsPanel() {
  document
    .getElementById(TEMPLATE_WORDS_PANEL_ID)
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function configsEqual(a: TemplateConfigs, b: TemplateConfigs): boolean {
  if (a.sentencesPerWord !== b.sentencesPerWord) return false;
  if (a.topics.length !== b.topics.length) return false;
  const sortedA = [...a.topics].sort();
  const sortedB = [...b.topics].sort();
  return sortedA.every((topic, i) => topic === sortedB[i]);
}

type TemplateConfigEditorProps = {
  templateId: Id<"template">;
  configs: TemplateConfigs;
  onGenerate: (configs: TemplateConfigs) => void;
};

export default function TemplateConfigEditor({
  templateId,
  configs: serverConfigs,
  onGenerate,
}: TemplateConfigEditorProps) {
  const updateConfigs = useMutation(api.template.updateConfigs);
  const [draft, setDraft] = useState<TemplateConfigs>(() => sanitizeTemplateConfigs(serverConfigs));
  const [saving, setSaving] = useState(false);
  const [emphasizeIncomplete, setEmphasizeIncomplete] = useState(false);
  const [legacyBannerDismissed, setLegacyBannerDismissed] = useState(false);
  const lastSavedRef = useRef(sanitizeTemplateConfigs(serverConfigs));
  const debouncedDraft = useDebounce(draft, CONFIG_SAVE_DEBOUNCE_MS);
  const showLegacyBanner = !legacyBannerDismissed && hasLegacyTopics(serverConfigs.topics);

  useEffect(() => {
    const sanitized = sanitizeTemplateConfigs(serverConfigs);
    setDraft(sanitized);
    lastSavedRef.current = sanitized;
  }, [serverConfigs]);

  useEffect(() => {
    if (configsEqual(debouncedDraft, lastSavedRef.current)) return;

    let cancelled = false;
    setSaving(true);

    const payload = sanitizeTemplateConfigs(debouncedDraft);

    void updateConfigs({
      templateId,
      configs: payload,
    })
      .then(() => {
        if (cancelled) return;
        lastSavedRef.current = payload;
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to save configuration";
        toast.error(message);
        setDraft(lastSavedRef.current);
      })
      .finally(() => {
        if (!cancelled) setSaving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedDraft, templateId, updateConfigs]);

  const readiness = getTemplateReadiness({
    wordsCount: PLACEHOLDER_WORDS.length,
    configs: draft,
  });

  function toggleTopic(topic: string, checked: boolean) {
    setDraft((prev) => {
      const topics = checked ? [...prev.topics, topic] : prev.topics.filter((t) => t !== topic);
      return { ...prev, topics };
    });
  }

  function handleGenerateClick() {
    if (!readiness.ready || saving) {
      setEmphasizeIncomplete(true);
      return;
    }
    onGenerate(draft);
  }

  const generateDisabled = !readiness.ready || saving;
  const generateTitle = saving
    ? "Saving configuration…"
    : readiness.ready
      ? undefined
      : readiness.issues.join(" · ");

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="shrink-0 border-b pb-4">
        <CardTitle>Configuration</CardTitle>
        <CardDescription>
          Choose how many sentences to generate per word and which topics to use.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pt-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sentences-per-word">Sentences per word</FieldLabel>
            <Select
              value={String(draft.sentencesPerWord)}
              onValueChange={(value) => {
                if (value) {
                  setDraft((prev) => ({
                    ...prev,
                    sentencesPerWord: Number.parseInt(value, 10),
                  }));
                }
              }}
              items={SENTENCES_PER_WORD_OPTIONS.map((n) => ({
                value: String(n),
                label: String(n),
              }))}
            >
              <SelectTrigger id="sentences-per-word" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENTENCES_PER_WORD_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FieldSet data-slot="checkbox-group">
            <FieldLegend variant="label">Sentence topics</FieldLegend>
            <FieldDescription>Select one or more topics for generated sentences.</FieldDescription>
            <div className="flex flex-col gap-2">
              {AVAILABLE_SENTENCE_TOPICS.map((topic) => {
                const checked = draft.topics.includes(topic);
                const id = `topic-${topic.replace(/\s+/g, "-").toLowerCase()}`;
                return (
                  <Field key={topic} orientation="horizontal">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(next) => toggleTopic(topic, next === true)}
                    />
                    <FieldLabel htmlFor={id} className="font-normal">
                      {topic}
                    </FieldLabel>
                  </Field>
                );
              })}
            </div>
          </FieldSet>
        </FieldGroup>

        {showLegacyBanner && (
          <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            <p className="flex-1 text-xs leading-relaxed">
              Some topics from your starter template are no longer available. Pick topics below.
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 rounded-sm p-0.5 opacity-70 hover:opacity-100"
              onClick={() => setLegacyBannerDismissed(true)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <TemplateReadiness
          wordsCount={PLACEHOLDER_WORDS.length}
          configs={draft}
          emphasizeIncomplete={emphasizeIncomplete}
          onWordsPanelClick={scrollToWordsPanel}
        />

        {saving && (
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            Saving…
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-auto shrink-0 flex-col items-stretch gap-2 border-t sm:flex-row sm:justify-end">
        <div className="flex w-full flex-col items-stretch gap-1.5 sm:items-end">
          <span className="relative inline-flex sm:justify-end">
            {generateDisabled && (
              <button
                type="button"
                aria-label={generateTitle ?? "Generate"}
                title={generateTitle}
                className="absolute inset-0 z-10 cursor-not-allowed rounded-md"
                onClick={() => {
                  if (!readiness.ready) setEmphasizeIncomplete(true);
                }}
              />
            )}
            <Button type="button" disabled={generateDisabled} onClick={handleGenerateClick}>
              Generate
            </Button>
          </span>
          {!readiness.ready && !saving && (
            <FieldDescription className="text-center sm:text-right">
              Complete the steps above to generate
            </FieldDescription>
          )}
          {saving && (
            <FieldDescription className="text-center sm:text-right">
              Saving configuration…
            </FieldDescription>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
