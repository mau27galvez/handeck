import { useDebounce } from "@/hooks/use-debounce";
import { PLACEHOLDER_WORDS } from "@/lib/template-placeholders";
import { api } from "@handeck/backend/convex/_generated/api";
import type { Id } from "@handeck/backend/convex/_generated/dataModel";
import {
  AVAILABLE_SENTENCE_TOPICS,
  type TemplateConfigs,
  sanitizeTemplateConfigs,
  validateTemplateForGeneration,
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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const SENTENCES_PER_WORD_OPTIONS = [1, 2, 3, 4, 5] as const;
const CONFIG_SAVE_DEBOUNCE_MS = 300;

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
  const lastSavedRef = useRef(sanitizeTemplateConfigs(serverConfigs));
  const debouncedDraft = useDebounce(draft, CONFIG_SAVE_DEBOUNCE_MS);

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

  const validation = validateTemplateForGeneration({
    wordsCount: PLACEHOLDER_WORDS.length,
    configs: draft,
  });

  function toggleTopic(topic: string, checked: boolean) {
    setDraft((prev) => {
      const topics = checked ? [...prev.topics, topic] : prev.topics.filter((t) => t !== topic);
      return { ...prev, topics };
    });
  }

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

        {!validation.valid && (
          <div
            role="status"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
          >
            <p className="text-sm font-medium text-destructive">Not ready to generate</p>
            <ul className="mt-1 list-inside list-disc text-sm text-destructive/90">
              {validation.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {saving && (
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            Saving…
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-auto shrink-0 flex-col items-stretch gap-2 border-t sm:flex-row sm:justify-end">
        <Button type="button" disabled={!validation.valid} onClick={() => onGenerate(draft)}>
          Generate
        </Button>
      </CardFooter>
    </Card>
  );
}
