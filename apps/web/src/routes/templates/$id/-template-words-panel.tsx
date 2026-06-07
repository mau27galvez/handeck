import { TEMPLATE_WORDS_PANEL_ID } from "@/lib/template-placeholders";
import type { DictionaryEntry } from "@/components/dictionary/dictionary-entry-row";
import { orpc } from "@/utils/orpc";
import { Button } from "@handeck/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@handeck/ui/components/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type TemplateWord = DictionaryEntry;

type TemplateWordsPanelProps = {
  templateId: string;
  words: TemplateWord[] | null | undefined;
  onAddWords: () => void;
  onGenerate: () => void;
};

export default function TemplateWordsPanel({
  templateId,
  words,
  onAddWords,
  onGenerate,
}: TemplateWordsPanelProps) {
  const queryClient = useQueryClient();
  const toggleWordInTemplate = useMutation(orpc.template.toggleWordInTemplate.mutationOptions());
  const [removingWordId, setRemovingWordId] = useState<string | null>(null);
  const isLoading = words === undefined;
  const wordList = words ?? [];
  const isEmpty = !isLoading && wordList.length === 0;

  async function handleRemoveWord(word: TemplateWord) {
    setRemovingWordId(word.id);
    try {
      await toggleWordInTemplate.mutateAsync({
        templateId,
        wordId: word.id,
      });
      void queryClient.invalidateQueries(
        orpc.template.getWords.queryOptions({ input: { templateId } }),
      );
      void queryClient.invalidateQueries(orpc.template.listForCurrentUser.queryOptions());
      toast.success(`Removed ${word.simplifiedHanzi} from template`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove word";
      toast.error(message);
    } finally {
      setRemovingWordId(null);
    }
  }

  return (
    <Card
      id={TEMPLATE_WORDS_PANEL_ID}
      className="flex h-full min-h-0 flex-col overflow-hidden scroll-mt-4"
    >
      <CardHeader className="shrink-0 border-b pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Words</CardTitle>
            <CardDescription>Words included in this template.</CardDescription>
          </div>
          <Button type="button" size="sm" className="shrink-0 gap-1.5" onClick={onAddWords}>
            <Plus className="size-4" />
            Add words
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 pt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading words…</p>
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">No words in this template yet.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onAddWords}
            >
              <Plus className="size-4" />
              Add from dictionary
            </Button>
          </div>
        ) : (
          <>
            <ul className="min-h-0 flex-1 overflow-y-auto divide-y rounded-md border">
              {wordList.map((word) => (
                <li key={word.id} className="flex items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium leading-tight">
                        {word.simplifiedHanzi}
                      </span>
                      <span className="text-sm text-muted-foreground">{word.diacriticPinyin}</span>
                    </div>
                    <span className="text-sm">{word.meaning}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={removingWordId != null}
                    aria-busy={removingWordId === word.id}
                    aria-label={`Remove ${word.simplifiedHanzi} from template`}
                    onClick={() => void handleRemoveWord(word)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
      <CardFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t">
        <p className="text-xs text-muted-foreground">
          {wordList.length} {wordList.length === 1 ? "word" : "words"}
        </p>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onGenerate}>
          <Sparkles className="size-4" />
          Generate
        </Button>
      </CardFooter>
    </Card>
  );
}
